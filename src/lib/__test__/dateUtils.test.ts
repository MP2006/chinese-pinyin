import { describe, it, expect, vi, afterEach } from "vitest";
import { todayStr } from "../dateUtils";

describe("todayStr", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD format for the current date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-15T14:30:00Z"));

    expect(todayStr()).toBe("2025-03-15");
  });
});
