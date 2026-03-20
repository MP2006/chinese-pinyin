import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

interface PoolEntry {
  client: MsEdgeTTS;
  active: number;
  ready: boolean;
}

const POOL_SIZE = 3;
const pool: PoolEntry[] = [];
let initPromise: Promise<void> | null = null;

async function createEntry(): Promise<PoolEntry> {
  const client = new MsEdgeTTS();
  await client.setMetadata(
    "zh-CN-XiaoxiaoNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );
  return { client, active: 0, ready: true };
}

async function initPool(): Promise<void> {
  const entries = await Promise.all(
    Array.from({ length: POOL_SIZE }, () => createEntry())
  );
  pool.push(...entries);
}

async function ensurePool(): Promise<void> {
  if (pool.length > 0) return;
  if (!initPromise) {
    initPromise = initPool();
  }
  await initPromise;
}

function leastLoaded(): PoolEntry {
  let best: PoolEntry | null = null;
  for (const entry of pool) {
    if (!entry.ready) continue;
    if (!best || entry.active < best.active) {
      best = entry;
    }
  }
  if (!best) {
    throw new Error("No healthy TTS pool entries available");
  }
  return best;
}

function recreateEntry(entry: PoolEntry): void {
  entry.ready = false;
  createEntry()
    .then((fresh) => {
      const idx = pool.indexOf(entry);
      if (idx !== -1) {
        pool[idx] = fresh;
      }
    })
    .catch(() => {
      // Retry recreation after a delay
      setTimeout(() => recreateEntry(entry), 5000);
    });
}

export async function synthesize(
  text: string
): Promise<{ audioStream: AsyncIterable<Uint8Array> }> {
  await ensurePool();
  const entry = leastLoaded();
  entry.active++;
  try {
    const result = entry.client.toStream(text, { rate: 0.9 });
    return result;
  } catch (err) {
    recreateEntry(entry);
    throw err;
  } finally {
    entry.active--;
  }
}

/** Visible for testing — resets the pool to empty state */
export function _resetPool(): void {
  pool.length = 0;
  initPromise = null;
}

/** Visible for testing */
export { pool as _pool, POOL_SIZE };
