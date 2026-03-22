import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, _resetStore } from "../rateLimit";

describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    _resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
      expect(result.limited).toBe(false);
    }
  });

  it("blocks requests over the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
    }
    const result = await rateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window expires", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
    }

    // Advance past the window
    vi.advanceTimersByTime(60_001);

    const result = await rateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.limited).toBe(false);
  });

  it("tracks different keys independently", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit("key-a", { maxRequests: 5, windowMs: 60_000 });
    }
    const resultA = await rateLimit("key-a", { maxRequests: 5, windowMs: 60_000 });
    const resultB = await rateLimit("key-b", { maxRequests: 5, windowMs: 60_000 });

    expect(resultA.limited).toBe(true);
    expect(resultB.limited).toBe(false);
  });

  it("returns correct retryAfter in seconds", async () => {
    const opts = { maxRequests: 2, windowMs: 10_000 };
    await rateLimit("test-key", opts);

    vi.advanceTimersByTime(3_000);
    await rateLimit("test-key", opts);

    const result = await rateLimit("test-key", opts);
    expect(result.limited).toBe(true);
    // Oldest timestamp was at t=0, window is 10s, current time is ~3s
    // retryAfter = ceil((0 + 10000 - 3000) / 1000) = 7
    expect(result.retryAfter).toBe(7);
  });
});

describe("rateLimit (Upstash Redis)", () => {
  const mockLimit = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockReset();

    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");

    vi.doMock("@upstash/redis", () => ({
      Redis: class MockRedis {},
    }));
    vi.doMock("@upstash/ratelimit", () => {
      class MockRatelimit {
        limit = mockLimit;
        static slidingWindow = vi.fn();
      }
      return { Ratelimit: MockRatelimit };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests when Upstash returns success", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });

    const { rateLimit: rl } = await import("../rateLimit");
    const result = await rl("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.limited).toBe(false);
    expect(result.retryAfter).toBe(0);
  });

  it("blocks requests when Upstash returns failure", async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 30_000 });

    const { rateLimit: rl } = await import("../rateLimit");
    const result = await rl("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("returns retryAfter of at least 1 second", async () => {
    // reset is in the past (edge case), retryAfter would be negative but clamped to 1
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() - 500 });

    const { rateLimit: rl } = await import("../rateLimit");
    const result = await rl("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBe(1);
  });

  it("reuses limiter for multiple requests with same config", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });

    const mod = await import("../rateLimit");
    const r1 = await mod.rateLimit("key-a", { maxRequests: 5, windowMs: 60_000 });
    const r2 = await mod.rateLimit("key-b", { maxRequests: 5, windowMs: 60_000 });

    // Both calls use the same cached limiter, both succeed
    expect(r1.limited).toBe(false);
    expect(r2.limited).toBe(false);
    // mockLimit was called twice (once per rateLimit call)
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });
});
