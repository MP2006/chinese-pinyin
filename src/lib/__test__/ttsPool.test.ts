import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetMetadata = vi.fn().mockResolvedValue(undefined);
const mockToStream = vi.fn();

vi.mock("msedge-tts", () => ({
  MsEdgeTTS: class MockMsEdgeTTS {
    setMetadata = mockSetMetadata;
    toStream = mockToStream;
  },
  OUTPUT_FORMAT: {
    AUDIO_24KHZ_96KBITRATE_MONO_MP3: "audio-24khz-96kbitrate-mono-mp3",
  },
}));

function makeAsyncIterable(chunks: Buffer[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

describe("ttsPool", () => {
  let synthesize: typeof import("../ttsPool").synthesize;
  let _resetPool: typeof import("../ttsPool")._resetPool;
  let _pool: typeof import("../ttsPool")._pool;
  let POOL_SIZE: number;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Restore default mock implementations after resetAllMocks clears them
    mockSetMetadata.mockResolvedValue(undefined);

    const mod = await import("../ttsPool");
    synthesize = mod.synthesize;
    _resetPool = mod._resetPool;
    _pool = mod._pool;
    POOL_SIZE = mod.POOL_SIZE;

    mockToStream.mockReturnValue({
      audioStream: makeAsyncIterable([Buffer.from("audio")]),
    });
  });

  it("initializes pool on first synthesize call", async () => {
    expect(_pool).toHaveLength(0);

    await synthesize("你好");

    expect(_pool).toHaveLength(POOL_SIZE);
    expect(mockSetMetadata).toHaveBeenCalledTimes(POOL_SIZE);
    expect(mockSetMetadata).toHaveBeenCalledWith(
      "zh-CN-XiaoxiaoNeural",
      "audio-24khz-96kbitrate-mono-mp3"
    );
  });

  it("distributes calls to least-loaded entry", async () => {
    await synthesize("init");

    // Manually set active counts to test least-loaded selection
    _pool[0].active = 5;
    _pool[1].active = 2;
    _pool[2].active = 8;

    // Track which client gets the call
    const clients = _pool.map((e) => e.client);
    let calledClient: unknown = null;
    mockToStream.mockImplementation(function (this: unknown) {
      calledClient = this;
      return { audioStream: makeAsyncIterable([Buffer.from("audio")]) };
    });

    await synthesize("test");

    // Should pick pool[1] (lowest active count = 2)
    expect(calledClient).toBe(clients[1]);
  });

  it("recreates entry on error without affecting others", async () => {
    // Init pool normally first
    await synthesize("init");

    // Now block recreation so the failed entry stays as not-ready
    mockSetMetadata.mockImplementation(
      () => new Promise<void>(() => {}) // never resolves
    );

    // Make first entry's toStream throw
    const failClient = _pool[0].client;

    mockToStream.mockImplementation(function (this: unknown) {
      if (this === failClient) {
        throw new Error("WebSocket closed");
      }
      return { audioStream: makeAsyncIterable([Buffer.from("audio")]) };
    });

    // Force selection of the failing entry
    _pool[0].active = 0;
    _pool[1].active = 10;
    _pool[2].active = 10;

    await expect(synthesize("test")).rejects.toThrow("WebSocket closed");

    // The failed entry should be marked not ready (recreation is pending/blocked)
    expect(_pool[0].ready).toBe(false);

    // Other entries still work — force selection of pool[1]
    _pool[1].active = 0;
    const result = await synthesize("ok");
    expect(result.audioStream).toBeDefined();
  });

  it("handles concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => synthesize("concurrent"))
    );

    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r.audioStream).toBeDefined());
  });

  it("skips unhealthy entries during selection", async () => {
    await synthesize("init");

    // Mark all but one entry as unhealthy
    _pool[0].ready = false;
    _pool[1].ready = false;
    _pool[2].active = 0;

    const client2 = _pool[2].client;
    let calledClient: unknown = null;
    mockToStream.mockImplementation(function (this: unknown) {
      calledClient = this;
      return { audioStream: makeAsyncIterable([Buffer.from("audio")]) };
    });

    await synthesize("healthy-only");

    expect(calledClient).toBe(client2);
  });

  it("throws when all entries are unhealthy", async () => {
    await synthesize("init");

    _pool[0].ready = false;
    _pool[1].ready = false;
    _pool[2].ready = false;

    await expect(synthesize("fail")).rejects.toThrow(
      "No healthy TTS pool entries available"
    );
  });
});
