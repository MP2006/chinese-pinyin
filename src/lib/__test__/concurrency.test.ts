import { describe, it, expect } from "vitest";
import { pMap } from "../concurrency";

describe("pMap", () => {
  it("returns results in original order", async () => {
    const items = [3, 1, 2];
    const results = await pMap(
      items,
      async (n) => {
        await new Promise((r) => setTimeout(r, n * 10));
        return n * 10;
      },
      3
    );
    expect(results).toEqual([30, 10, 20]);
  });

  it("respects concurrency limit", async () => {
    let running = 0;
    let maxRunning = 0;

    const items = Array.from({ length: 10 }, (_, i) => i);
    await pMap(
      items,
      async (n) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        return n;
      },
      3
    );

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("handles empty array", async () => {
    const results = await pMap([], async (n: number) => n, 5);
    expect(results).toEqual([]);
  });

  it("propagates errors", async () => {
    await expect(
      pMap([1, 2, 3], async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      }, 2)
    ).rejects.toThrow("fail");
  });
});
