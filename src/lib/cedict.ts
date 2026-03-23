import { pinyin, segment } from "pinyin-pro";
import { translateText } from "@/lib/translate";

let dictCache: Record<string, string> | null = null;

export async function loadDict(): Promise<Record<string, string>> {
  if (dictCache) return dictCache;
  const res = await fetch("/cedict.json");
  if (!res.ok) throw new Error(`Failed to load dictionary: ${res.status}`);
  dictCache = await res.json();
  return dictCache!;
}

// Clean raw CC-CEDICT formatting:
// - Remove parenthetical annotations like (third-person singular), (bound form)
// - Remove pinyin brackets like [nin2], [pi2 ge5 de5]
// - Remove traditional|simplified pairs like 跑堂兒的|跑堂儿的[...]
// - Clean up double spaces and trailing punctuation left behind
export function cleanDef(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)/g, "") // (annotations)
    .replace(/\s*\w+\|[\u4e00-\u9fff\u3400-\u4dbf]+\[[^\]]*\]/g, "") // trad|simp[pinyin]
    .replace(/\s*[\u4e00-\u9fff\u3400-\u4dbf]+\[[^\]]*\]/g, "") // 字[pinyin]
    .replace(/\[[^\]]*\]/g, "") // remaining [pinyin]
    .replace(/\s{2,}/g, " ")
    .replace(/^[;,\s]+/, "") // leading punctuation
    .replace(/[;,\s]+$/, "") // trailing punctuation
    .trim();
}

// Get first N semicolon-separated meanings from a definition
export function shortDef(raw: string, max: number): string {
  const cleaned = cleanDef(raw);
  const parts = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, max).join("; ");
}

export function lookupEnglish(
  word: string,
  dict: Record<string, string>
): string {
  // Direct match — return first 4 meanings
  if (dict[word]) return shortDef(dict[word], 4);

  // Try segmenting into sub-words via pinyin-pro
  const segments = segment(word) as { origin: string; result: string }[];
  if (segments.length > 1) {
    const parts = segments
      .map((s) => {
        const def = dict[s.origin];
        return def ? `${s.origin} — ${shortDef(def, 2)}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("\n");
  }

  // Fall back to character-by-character
  if (word.length > 1) {
    const charDefs = Array.from(word)
      .map((ch) => {
        const def = dict[ch];
        return def ? `${ch} — ${shortDef(def, 2)}` : null;
      })
      .filter(Boolean);
    if (charDefs.length > 0) return charDefs.join("\n");
  }

  return "No definition found";
}

interface WordDefinitionResult {
  pinyin: string;
  definitions: Record<string, string>;
}

export async function defineWord(
  word: string,
  lang: string
): Promise<WordDefinitionResult> {
  const wordPinyin = pinyin(word, { toneType: "symbol" });
  const definitions: Record<string, string> = {};

  if (lang === "en") {
    const dict = await loadDict();
    definitions.en = lookupEnglish(word, dict);
  } else if (lang === "vi") {
    try {
      definitions.vi = await translateText(word, "vi");
    } catch {
      definitions.vi = "Translation unavailable";
    }
  }

  return { pinyin: wordPinyin, definitions };
}
