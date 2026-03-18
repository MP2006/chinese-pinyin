// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { logApiCall, getUsageStats, clearUsageStats } from "../apiUsage";

describe("apiUsage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    localStorage.clear();
  });

  it("logApiCall + getUsageStats records an entry", () => {
    logApiCall("/api/translate", 50);
    const stats = getUsageStats();
    expect(stats.totals["/api/translate"]).toEqual({ calls: 1, chars: 50 });
  });

  it("aggregates multiple calls to same endpoint", () => {
    logApiCall("/api/translate", 50);
    logApiCall("/api/translate", 30);
    const stats = getUsageStats();
    expect(stats.totals["/api/translate"]).toEqual({ calls: 2, chars: 80 });
  });

  it("tracks separate endpoints independently", () => {
    logApiCall("/api/translate", 50);
    logApiCall("/api/define", 10);
    const stats = getUsageStats();
    expect(stats.totals["/api/translate"]).toEqual({ calls: 1, chars: 50 });
    expect(stats.totals["/api/define"]).toEqual({ calls: 1, chars: 10 });
  });

  it("groups daily stats and sorts newest first", () => {
    logApiCall("/api/translate", 50);
    vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));
    logApiCall("/api/translate", 30);

    const stats = getUsageStats();
    expect(stats.daily).toHaveLength(2);
    expect(stats.daily[0].date).toBe("2024-06-16");
    expect(stats.daily[1].date).toBe("2024-06-15");
  });

  it("prunes entries older than 30 days", () => {
    // Log an old entry
    vi.setSystemTime(new Date("2024-05-01T12:00:00Z"));
    logApiCall("/api/translate", 100);

    // Log a recent entry
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    logApiCall("/api/translate", 50);

    const stats = getUsageStats();
    // The old entry should be pruned
    expect(stats.totals["/api/translate"]).toEqual({ calls: 1, chars: 50 });
    expect(stats.daily).toHaveLength(1);
  });

  it("clearUsageStats empties everything", () => {
    logApiCall("/api/translate", 50);
    clearUsageStats();
    const stats = getUsageStats();
    expect(stats.totals).toEqual({});
    expect(stats.daily).toEqual([]);
  });

  it("getUsageStats returns empty when no data", () => {
    const stats = getUsageStats();
    expect(stats.totals).toEqual({});
    expect(stats.daily).toEqual([]);
  });

  it("returns empty array for corrupt localStorage data", () => {
    localStorage.setItem("api_usage", "not valid json{{{");
    const stats = getUsageStats();
    expect(stats.totals).toEqual({});
    expect(stats.daily).toEqual([]);
  });

  vi.useRealTimers();
});
