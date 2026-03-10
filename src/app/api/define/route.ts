import { NextRequest, NextResponse } from "next/server";
import { pinyin, segment } from "pinyin-pro";
import { translateText } from "@/lib/translate";
import { readFileSync } from "fs";
import { join } from "path";

let dict: Record<string, string> | null = null;

function getDict(): Record<string, string> {
  if (!dict) {
    const filePath = join(process.cwd(), "src", "data", "cedict.json");
    dict = JSON.parse(readFileSync(filePath, "utf-8"));
  }
  return dict!;
}

// Clean raw CC-CEDICT formatting:
// - Remove pinyin brackets like [nin2], [pi2 ge2 de5]
// - Remove traditional|simplified pairs like 跑堂兒的|跑堂儿的[...]
// - Clean up double spaces left behind
function cleanDef(raw: string): string {
  return raw
    .replace(/\s*\w+\|[\u4e00-\u9fff\u3400-\u4dbf]+\[[^\]]*\]/g, "")   // trad|simp[pinyin]
    .replace(/\s*[\u4e00-\u9fff\u3400-\u4dbf]+\[[^\]]*\]/g, "")          // 字[pinyin]
    .replace(/\[[^\]]*\]/g, "")                                            // remaining [pinyin]
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Get first N semicolon-separated meanings from a definition
function shortDef(raw: string, max: number): string {
  const cleaned = cleanDef(raw);
  const parts = cleaned.split(";").map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, max).join("; ");
}

function lookupEnglish(word: string): string {
  const d = getDict();

  // Direct match — return cleaned full definition
  if (d[word]) return cleanDef(d[word]);

  // Try segmenting into sub-words via pinyin-pro
  const segments = segment(word) as { origin: string; result: string }[];
  if (segments.length > 1) {
    const parts = segments
      .map((s) => {
        const def = d[s.origin];
        return def ? `${s.origin} — ${shortDef(def, 2)}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("\n");
  }

  // Fall back to character-by-character
  if (word.length > 1) {
    const charDefs = Array.from(word)
      .map((ch) => {
        const def = d[ch];
        return def ? `${ch} — ${shortDef(def, 2)}` : null;
      })
      .filter(Boolean);
    if (charDefs.length > 0) return charDefs.join("\n");
  }

  return "No definition found";
}

export async function POST(request: NextRequest) {
  const { word, langs } = (await request.json()) as {
    word: string;
    langs: string[];
  };

  if (!word || typeof word !== "string" || !Array.isArray(langs)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const wordPinyin = pinyin(word, { toneType: "symbol" });
  const definitions: Record<string, string> = {};

  const tasks: Promise<void>[] = [];

  if (langs.includes("en")) {
    definitions.en = lookupEnglish(word);
  }

  if (langs.includes("vi")) {
    tasks.push(
      translateText(word, "vi")
        .then((t) => {
          definitions.vi = t;
        })
        .catch(() => {
          definitions.vi = "Translation unavailable";
        })
    );
  }

  await Promise.all(tasks);

  return NextResponse.json({ word, pinyin: wordPinyin, definitions });
}
