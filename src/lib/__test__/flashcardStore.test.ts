import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeSM2 } from "../flashcardStore";

// --- computeSM2 (pure function) ---

describe("computeSM2", () => {
  const newCard = { interval: 0, easeFactor: 2.5, reviewCount: 0 };
  const reviewedCard = { interval: 5, easeFactor: 2.5, reviewCount: 3 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  it("new card + again → interval 1, ease drops", () => {
    const r = computeSM2(newCard, "again");
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBe(2.3);
    expect(r.reviewCount).toBe(1);
    expect(r.nextReview).toBe("2024-06-16");
  });

  it("new card + hard → interval 1, ease drops slightly", () => {
    const r = computeSM2(newCard, "hard");
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBe(2.35);
    expect(r.reviewCount).toBe(1);
  });

  it("new card + good → interval 1, ease unchanged", () => {
    const r = computeSM2(newCard, "good");
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBe(2.5);
    expect(r.reviewCount).toBe(1);
  });

  it("new card + easy → interval 4, ease increases", () => {
    const r = computeSM2(newCard, "easy");
    expect(r.interval).toBe(4);
    expect(r.easeFactor).toBe(2.65);
    expect(r.reviewCount).toBe(1);
    expect(r.nextReview).toBe("2024-06-19");
  });

  it("reviewed card + again → interval 1, ease drops", () => {
    const r = computeSM2(reviewedCard, "again");
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBe(2.3);
    expect(r.reviewCount).toBe(4);
  });

  it("reviewed card + hard → interval * 1.2", () => {
    const r = computeSM2(reviewedCard, "hard");
    expect(r.interval).toBe(6); // round(5 * 1.2) = 6
    expect(r.easeFactor).toBe(2.35);
  });

  it("reviewed card + good → interval * easeFactor", () => {
    const r = computeSM2(reviewedCard, "good");
    expect(r.interval).toBe(13); // round(5 * 2.5) = 13
    expect(r.easeFactor).toBe(2.5);
  });

  it("reviewed card + easy → interval * easeFactor * 1.3", () => {
    const r = computeSM2(reviewedCard, "easy");
    expect(r.interval).toBe(16); // round(5 * 2.5 * 1.3) = 16
    expect(r.easeFactor).toBe(2.65);
  });

  it("ease factor never drops below 1.3", () => {
    const lowEase = { interval: 5, easeFactor: 1.3, reviewCount: 10 };
    const r = computeSM2(lowEase, "again");
    expect(r.easeFactor).toBe(1.3);
  });

  it("nextReview is a valid YYYY-MM-DD string", () => {
    const r = computeSM2(newCard, "good");
    expect(r.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  vi.useRealTimers();
});
