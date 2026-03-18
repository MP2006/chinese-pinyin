import { describe, it, expect } from "vitest";
import { stripNonChinese, compareChineseText } from "../compareText";

describe("stripNonChinese", () => {
  it("keeps CJK characters only", () => {
    expect(stripNonChinese("你好world")).toBe("你好");
  });

  it("strips ASCII, punctuation, spaces", () => {
    expect(stripNonChinese("Hello, 世界！ 123")).toBe("世界");
  });

  it("returns empty string when no CJK present", () => {
    expect(stripNonChinese("hello world")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(stripNonChinese("")).toBe("");
  });

  it("preserves CJK extension B characters", () => {
    expect(stripNonChinese("𠀀")).toBe(""); // Extension B is outside U+4E00-9FFF / U+3400-4DBF
  });

  it("handles mixed Chinese punctuation and characters", () => {
    expect(stripNonChinese("你好，世界。")).toBe("你好世界");
  });
});

describe("compareChineseText", () => {
  it("returns 100% accuracy for perfect match", () => {
    const result = compareChineseText("你好世界", "你好世界");
    expect(result.accuracy).toBe(100);
    expect(result.chars.every((c) => c.status === "correct")).toBe(true);
  });

  it("returns 0% accuracy for completely wrong input", () => {
    const result = compareChineseText("你好", "世界");
    expect(result.accuracy).toBe(0);
  });

  it("detects missing characters", () => {
    const result = compareChineseText("你好世界", "你好");
    expect(result.chars.filter((c) => c.status === "missing")).toHaveLength(2);
    expect(result.accuracy).toBe(50);
  });

  it("detects extra characters", () => {
    const result = compareChineseText("你好", "你好世界");
    expect(result.chars.filter((c) => c.status === "extra")).toHaveLength(2);
    // Accuracy based on expected length (2), 2 correct out of 2
    expect(result.accuracy).toBe(100);
  });

  it("detects substitutions", () => {
    const result = compareChineseText("你好", "你坏");
    expect(result.chars[0]).toMatchObject({ status: "correct", expected: "你" });
    expect(result.chars[1]).toMatchObject({ status: "wrong", expected: "好", actual: "坏" });
    expect(result.accuracy).toBe(50);
  });

  it("returns 0% when expected is empty", () => {
    const result = compareChineseText("", "你好");
    expect(result.accuracy).toBe(0);
    expect(result.chars.every((c) => c.status === "extra")).toBe(true);
  });

  it("returns 0% when actual is empty", () => {
    const result = compareChineseText("你好", "");
    expect(result.accuracy).toBe(0);
    expect(result.chars.every((c) => c.status === "missing")).toBe(true);
  });

  it("returns empty chars when both inputs empty", () => {
    const result = compareChineseText("", "");
    expect(result.chars).toHaveLength(0);
    expect(result.accuracy).toBe(0);
  });

  it("ignores non-Chinese characters in both inputs", () => {
    const result = compareChineseText("你好 world", "你好！");
    expect(result.accuracy).toBe(100);
  });
});
