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
