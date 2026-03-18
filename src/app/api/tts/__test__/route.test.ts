import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock msedge-tts
const mockSetMetadata = vi.fn().mockResolvedValue(undefined);
const mockToStream = vi.fn();

vi.mock("msedge-tts", () => {
  return {
    MsEdgeTTS: class MockMsEdgeTTS {
      setMetadata = mockSetMetadata;
      toStream = mockToStream;
    },
    OUTPUT_FORMAT: {
      AUDIO_24KHZ_96KBITRATE_MONO_MP3: "audio-24khz-96kbitrate-mono-mp3",
    },
  };
});

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
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module so ttsClient is null each test
    vi.resetModules();
    const mod = await import("../route");
    POST = mod.POST;

    // Default: return small audio buffer
    mockToStream.mockReturnValue({
      audioStream: makeAsyncIterable([Buffer.from("fake-audio-data")]),
    });
  });

  it("returns 200 with audio/mpeg for valid text", async () => {
    const res = await POST(makeRequest({ text: "你好" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBeTruthy();

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

  it("returns 500 on TTS stream error and resets client", async () => {
    mockToStream.mockReturnValueOnce({
      audioStream: {
        async *[Symbol.asyncIterator]() {
          throw new Error("Stream failed");
        },
      },
    });

    const res = await POST(makeRequest({ text: "你好" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("TTS generation failed");

    // Next request should re-create client (setMetadata called again)
    mockSetMetadata.mockClear();
    mockToStream.mockReturnValue({
      audioStream: makeAsyncIterable([Buffer.from("audio")]),
    });
    const res2 = await POST(makeRequest({ text: "好" }));
    expect(res2.status).toBe(200);
    expect(mockSetMetadata).toHaveBeenCalledTimes(1);
  });
});
