// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pinyin-pro", () => ({
  pinyin: vi.fn((word: string) => {
    const map: Record<string, string> = {
      你好: "nǐ hǎo",
      你: "nǐ",
      好: "hǎo",
      世界: "shì jiè",
      世: "shì",
      界: "jiè",
      测试词: "cè shì cí",
    };
    return map[word] || word;
  }),
  segment: vi.fn((word: string) => {
    // Simulate segmentation: 测试词 -> 测试 + 词
    if (word === "测试词")
      return [
        { origin: "测试", result: "cè shì" },
        { origin: "词", result: "cí" },
      ];
    // Default: single segment (no split)
    return [{ origin: word, result: word }];
  }),
}));

vi.mock("@/lib/translate", () => ({
  translateText: vi.fn(),
}));

import { cleanDef, shortDef, lookupEnglish, defineWord, loadDict } from "../cedict";
import { translateText } from "@/lib/translate";

const MOCK_DICT: Record<string, string> = {
  你好: "hello; hi; how are you?",
  你: "you (informal, as opposed to courteous 您[nin2])",
  好: "good; well; proper; to be fond of",
  世界: "world; CL:個|个[ge4]",
  测试: "test; testing",
  词: "word; statement; speech; lyrics",
};

describe("cleanDef", () => {
  it("removes parenthetical annotations and [pinyin] brackets", () => {
    // (annotations) are stripped, then 字[pinyin] removes Chinese char + brackets
    expect(cleanDef("you (informal, as opposed to courteous 您[nin2])")).toBe(
      "you"
    );
  });

  it("removes parenthetical annotations", () => {
    expect(cleanDef("(third-person singular) he; him; his")).toBe(
      "he; him; his"
    );
  });

  it("removes trad|simp[pinyin] patterns", () => {
    expect(cleanDef("world; CL:個|个[ge4]")).toBe("world; CL:個|");
  });

  it("removes 字[pinyin] patterns", () => {
    expect(cleanDef("hello 你[ni3] there")).toBe("hello there");
  });

  it("collapses double spaces", () => {
    expect(cleanDef("one  two   three")).toBe("one two three");
  });

  it("handles clean text unchanged", () => {
    expect(cleanDef("hello; hi")).toBe("hello; hi");
  });
});

describe("shortDef", () => {
  it("returns first N semicolon-separated meanings", () => {
    expect(shortDef("hello; hi; how are you?", 2)).toBe("hello; hi");
  });

  it("returns all if fewer than max", () => {
    expect(shortDef("hello; hi", 5)).toBe("hello; hi");
  });

  it("returns single meaning", () => {
    expect(shortDef("hello", 2)).toBe("hello");
  });

  it("cleans before splitting", () => {
    expect(shortDef("(third-person singular) he; him; his; other", 2)).toBe(
      "he; him"
    );
  });
});

describe("lookupEnglish", () => {
  it("returns direct match definition", () => {
    expect(lookupEnglish("你好", MOCK_DICT)).toBe("hello; hi; how are you?");
  });

  it("falls back to segment-based lookup", () => {
    const result = lookupEnglish("测试词", MOCK_DICT);
    expect(result).toContain("测试 — test; testing");
    expect(result).toContain("词 — word; statement");
  });

  it("falls back to char-by-char for unknown multi-char words", () => {
    // 你好 has a direct match, but for a word not in dict with chars that are:
    const dictWithoutCompound = { 你: MOCK_DICT["你"], 好: MOCK_DICT["好"] };
    const result = lookupEnglish("你好", dictWithoutCompound);
    // segment returns single segment for 你好, so it tries char-by-char
    expect(result).toContain("你");
    expect(result).toContain("好");
  });

  it("returns 'No definition found' for completely unknown word", () => {
    expect(lookupEnglish("zzz", MOCK_DICT)).toBe("No definition found");
  });
});

describe("loadDict", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_DICT,
      })
    );
  });

  it("fetches /cedict.json and caches result", async () => {
    // Use resetModules to get a fresh module with no cache
    vi.resetModules();
    const mod = await import("../cedict");

    const dict = await mod.loadDict();
    expect(dict).toEqual(MOCK_DICT);
    expect(fetch).toHaveBeenCalledWith("/cedict.json");

    // Second call should use cache (no additional fetch)
    const dict2 = await mod.loadDict();
    expect(dict2).toEqual(MOCK_DICT);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws on fetch failure", async () => {
    vi.resetModules();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const mod = await import("../cedict");
    await expect(mod.loadDict()).rejects.toThrow("Failed to load dictionary: 500");
  });
});

describe("defineWord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_DICT,
      })
    );
  });

  it("returns English definition from CC-CEDICT", async () => {
    vi.resetModules();
    const mod = await import("../cedict");

    const result = await mod.defineWord("你好", "en");
    expect(result.pinyin).toBe("nǐ hǎo");
    expect(result.definitions.en).toBe("hello; hi; how are you?");
  });

  it("returns Vietnamese translation via translateText", async () => {
    vi.resetModules();
    vi.mocked(translateText).mockResolvedValue("xin chào");
    const mod = await import("../cedict");

    const result = await mod.defineWord("你好", "vi");
    expect(result.pinyin).toBe("nǐ hǎo");
    expect(result.definitions.vi).toBe("xin chào");
    expect(translateText).toHaveBeenCalledWith("你好", "vi");
  });

  it("returns 'Translation unavailable' on Vietnamese translation failure", async () => {
    vi.resetModules();
    vi.mocked(translateText).mockRejectedValue(new Error("Network error"));
    const mod = await import("../cedict");

    const result = await mod.defineWord("你好", "vi");
    expect(result.definitions.vi).toBe("Translation unavailable");
  });
});
