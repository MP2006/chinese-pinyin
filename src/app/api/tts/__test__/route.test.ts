import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSynthesize = vi.fn();

vi.mock("@/lib/ttsPool", () => ({
  synthesize: (...args: unknown[]) => mockSynthesize(...args),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ limited: false, retryAfter: 0 }),
}));

import { POST } from "../route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeAsyncIterable(chunks: Buffer[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSynthesize.mockResolvedValue({
      audioStream: makeAsyncIterable([Buffer.from("fake-audio-data")]),
    });
  });

  it("returns 200 with audio/mpeg for valid text", async () => {
    const res = await POST(makeRequest({ text: "你好" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Transfer-Encoding")).toBe("chunked");

    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("returns 400 for empty text", async () => {
    const res = await POST(makeRequest({ text: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No text provided");
  });

  it("returns 400 for missing text field", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No text provided");
  });

  it("returns 400 for text > 500 chars", async () => {
    const longText = "中".repeat(501);
    const res = await POST(makeRequest({ text: longText }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Text too long");
  });

  it("returns 400 for non-string text", async () => {
    const res = await POST(makeRequest({ text: 123 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No text provided");
  });

  it("returns 400 for whitespace-only text", async () => {
    const res = await POST(makeRequest({ text: "   " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No text provided");
  });

  it("returns 500 on TTS synthesis error", async () => {
    mockSynthesize.mockRejectedValueOnce(new Error("Pool error"));

    const res = await POST(makeRequest({ text: "你好" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("TTS generation failed");
  });

  it("returns errored stream on TTS stream failure", async () => {
    mockSynthesize.mockResolvedValueOnce({
      audioStream: {
        async *[Symbol.asyncIterator]() {
          throw new Error("Stream failed");
        },
      },
    });

    const res = await POST(makeRequest({ text: "你好" }));
    // Response is returned immediately as 200 (streaming), but the body errors
    expect(res.status).toBe(200);
    await expect(res.arrayBuffer()).rejects.toThrow();
  });

  it("passes text to synthesize", async () => {
    await POST(makeRequest({ text: "你好世界" }));
    expect(mockSynthesize).toHaveBeenCalledWith("你好世界");
  });
});
