import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
  SchemaType: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY", BOOLEAN: "BOOLEAN" },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ limited: false, retryAfter: 0 }),
}));

import { POST } from "../route";
import { rateLimit } from "@/lib/rateLimit";

const VALID_RESPONSE = {
  sentence: "你好",
  translation: "Hello",
  pattern: "Greeting",
  chunks: [
    { chunk: "你", pinyin: "nǐ", role: "Subject", meaning: "you" },
    { chunk: "好", pinyin: "hǎo", role: "Adjective", meaning: "good" },
  ],
  note: "Common greeting in Chinese.",
  isCorrect: true,
  correction: "",
  correctionPinyin: "",
  feedback: "",
};

const INCORRECT_RESPONSE = {
  sentence: "我吃喜欢苹果",
  translation: "I eat like apples",
  pattern: "Subject + Verb + Object (incorrect order)",
  chunks: [
    { chunk: "我", pinyin: "wǒ", role: "Subject", meaning: "I" },
    { chunk: "吃", pinyin: "chī", role: "Verb", meaning: "eat" },
    { chunk: "喜欢", pinyin: "xǐhuān", role: "Verb", meaning: "like" },
    { chunk: "苹果", pinyin: "píngguǒ", role: "Object", meaning: "apple" },
  ],
  note: "The verb order is incorrect.",
  isCorrect: false,
  correction: "我喜欢吃苹果",
  correctionPinyin: "wǒ xǐhuān chī píngguǒ",
  feedback: "The verb 喜欢 should come before 吃 to express 'like to eat'.",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/analyze-grammar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/analyze-grammar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  it("returns grammar analysis for correct sentence", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(VALID_RESPONSE) },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sentence).toBe("你好");
    expect(json.isCorrect).toBe(true);
    expect(json.correction).toBe("");
    expect(json.feedback).toBe("");
  });

  it("returns correction and feedback for incorrect sentence", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(INCORRECT_RESPONSE) },
    });

    const res = await POST(makeRequest({ text: "我吃喜欢苹果", lang: "en" }) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isCorrect).toBe(false);
    expect(json.correction).toBe("我喜欢吃苹果");
    expect(json.feedback).toContain("喜欢");
  });

  it("returns 503 when GEMINI_API_KEY is not set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 400 for empty text", async () => {
    const res = await POST(makeRequest({ text: "", lang: "en" }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(makeRequest({ lang: "en" }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/required/i);
  });

  it("returns 400 for text exceeding max length", async () => {
    const longText = "你".repeat(201);
    const res = await POST(makeRequest({ text: longText, lang: "en" }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({
      limited: true,
      retryAfter: 30,
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("defaults to English when lang is not vi", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(VALID_RESPONSE) },
    });

    await POST(makeRequest({ text: "你好", lang: "xx" }) as any);

    const prompt = mockGenerateContent.mock.calls[0][0];
    expect(prompt).toContain("English");
  });

  it("uses Vietnamese when lang is vi", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({ ...VALID_RESPONSE, translation: "Xin chào" }),
      },
    });

    await POST(makeRequest({ text: "你好", lang: "vi" }) as any);

    const prompt = mockGenerateContent.mock.calls[0][0];
    expect(prompt).toContain("Vietnamese");
  });

  it("returns 502 for invalid JSON response from Gemini", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "not json" },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/invalid response/i);
  });

  it("returns 502 when Zod validation fails (missing isCorrect)", async () => {
    const { isCorrect: _, ...missingField } = VALID_RESPONSE;
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(missingField),
      },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(502);
  });

  it("returns 502 for structurally invalid response", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ sentence: "你好" }), // missing fields
      },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(502);
  });

  it("returns 502 for response with empty chunks", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({ ...VALID_RESPONSE, chunks: [] }),
      },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(502);
  });

  it("returns 500 when Gemini throws", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API error"));

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/failed/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/analyze-grammar", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid json/i);
  });

  it("strips extra fields from Gemini response via Zod", async () => {
    const withExtra = { ...VALID_RESPONSE, hallucinated_field: "should be stripped" };
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(withExtra) },
    });

    const res = await POST(makeRequest({ text: "你好", lang: "en" }) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.hallucinated_field).toBeUndefined();
  });
});
