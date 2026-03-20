import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/translate", () => ({
  translateText: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ limited: false, retryAfter: 0 }),
}));

import { POST } from "../route";
import { translateText } from "@/lib/translate";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns translation for valid request", async () => {
    vi.mocked(translateText).mockResolvedValue("hello");

    const res = await POST(makeRequest({ text: "你好", targetLang: "en" }) as any);
    const json = await res.json();

    expect(json.translation).toBe("hello");
    expect(translateText).toHaveBeenCalledWith("你好", "en");
  });

  it("returns empty string for empty text", async () => {
    const res = await POST(makeRequest({ text: "", targetLang: "en" }) as any);
    const json = await res.json();
    expect(json.translation).toBe("");
  });

  it("returns empty string for whitespace-only text", async () => {
    const res = await POST(makeRequest({ text: "   ", targetLang: "en" }) as any);
    const json = await res.json();
    expect(json.translation).toBe("");
  });

  it("defaults to en for invalid language", async () => {
    vi.mocked(translateText).mockResolvedValue("hello");

    await POST(makeRequest({ text: "你好", targetLang: "xx" }) as any);

    expect(translateText).toHaveBeenCalledWith("你好", "en");
  });

  it("translates each line separately for multi-line text", async () => {
    vi.mocked(translateText)
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("world");

    const res = await POST(
      makeRequest({ text: "你好\n世界", targetLang: "en" }) as any
    );
    const json = await res.json();

    expect(json.translation).toBe("hello\nworld");
    expect(translateText).toHaveBeenCalledTimes(2);
  });

  it("preserves empty lines in multi-line text", async () => {
    vi.mocked(translateText).mockResolvedValueOnce("hello");

    const res = await POST(
      makeRequest({ text: "你好\n\n", targetLang: "en" }) as any
    );
    const json = await res.json();

    // Empty lines get Promise.resolve(""), so: "hello\n\n"
    expect(json.translation).toBe("hello\n\n");
    expect(translateText).toHaveBeenCalledTimes(1); // Only non-empty line
  });

  it('returns "Translation unavailable" on translation failure', async () => {
    vi.mocked(translateText).mockRejectedValue(new Error("All APIs failed"));

    const res = await POST(makeRequest({ text: "你好", targetLang: "en" }) as any);
    const json = await res.json();

    expect(json.translation).toBe("Translation unavailable");
  });

  it("rejects text exceeding 10,000 characters", async () => {
    const longText = "你".repeat(10_001);
    const res = await POST(makeRequest({ text: longText, targetLang: "en" }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
  });

  it("maintains line order with many lines", async () => {
    const lineCount = 20;
    const lines = Array.from({ length: lineCount }, (_, i) => `行${i}`);
    const text = lines.join("\n");

    vi.mocked(translateText).mockImplementation(async (line: string) => {
      // Simulate varying response times
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      return `translated:${line}`;
    });

    const res = await POST(makeRequest({ text, targetLang: "en" }) as any);
    const json = await res.json();

    const resultLines = json.translation.split("\n");
    expect(resultLines).toHaveLength(lineCount);
    lines.forEach((line, i) => {
      expect(resultLines[i]).toBe(`translated:${line}`);
    });
  });

  it("rejects text exceeding 100 lines", async () => {
    const manyLines = Array(101).fill("你好").join("\n");
    const res = await POST(makeRequest({ text: manyLines, targetLang: "en" }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too many lines/i);
  });
});
