import { createWriteStream } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createInterface } from "readline";
import { createReadStream } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "src", "data", "cedict.json");
const CEDICT_URL =
  "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";

async function download() {
  console.log("Downloading CC-CEDICT...");
  const res = await fetch(CEDICT_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const tmpPath = join(tmpdir(), "cedict_raw.txt");
  const gunzip = createGunzip();
  const out = createWriteStream(tmpPath);

  await pipeline(res.body, gunzip, out);
  console.log("Downloaded and decompressed.");
  return tmpPath;
}

function parseLine(line) {
  // Format: Traditional Simplified [pin1 yin1] /def1/def2/
  if (line.startsWith("#") || !line.trim()) return null;

  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) return null;

  const [, , simplified, , rawDefs] = match;
  const defs = rawDefs
    .split("/")
    .filter((d) => !d.startsWith("CL:") && d.trim());
  if (defs.length === 0) return null;

  return { simplified, definition: defs.join("; ") };
}

async function build() {
  const tmpPath = await download();

  console.log("Parsing entries...");
  const dict = {};
  const rl = createInterface({ input: createReadStream(tmpPath) });

  for await (const line of rl) {
    const entry = parseLine(line);
    if (entry && !dict[entry.simplified]) {
      dict[entry.simplified] = entry.definition;
    }
  }

  const count = Object.keys(dict).length;
  console.log(`Parsed ${count} entries.`);

  await writeFile(OUT_PATH, JSON.stringify(dict), "utf-8");
  console.log(`Written to ${OUT_PATH}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
