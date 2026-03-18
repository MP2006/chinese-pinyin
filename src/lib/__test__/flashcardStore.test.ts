// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  computeSM2,
  getFlashcards,
  addFlashcard,
  removeFlashcard,
  hasFlashcard,
  getDueCards,
  getTotalCardCount,
  reviewCard,
  type Flashcard,
} from "../flashcardStore";

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

// --- localStorage CRUD ---

describe("flashcardStore localStorage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
    localStorage.clear();
  });

  it("getFlashcards returns empty array initially", () => {
    expect(getFlashcards()).toEqual([]);
  });

  it("addFlashcard creates a new card", () => {
    const card = addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    expect(card.word).toBe("你好");
    expect(card.pinyin).toBe("nǐ hǎo");
    expect(card.definitions).toEqual({ en: "hello" });
    expect(card.interval).toBe(0);
    expect(card.easeFactor).toBe(2.5);
    expect(card.reviewCount).toBe(0);
    expect(card.nextReview).toBe("2024-06-15");
    expect(getFlashcards()).toHaveLength(1);
  });

  it("addFlashcard merges definitions for duplicate word", () => {
    addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    const updated = addFlashcard("你好", "nǐ hǎo", { vi: "xin chào" });
    expect(updated.definitions).toEqual({ en: "hello", vi: "xin chào" });
    expect(getFlashcards()).toHaveLength(1);
  });

  it("removeFlashcard removes the card", () => {
    const card = addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    removeFlashcard(card.id);
    expect(getFlashcards()).toHaveLength(0);
  });

  it("hasFlashcard returns true/false correctly", () => {
    expect(hasFlashcard("你好")).toBe(false);
    addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    expect(hasFlashcard("你好")).toBe(true);
  });

  it("getDueCards returns cards due today or earlier", () => {
    addFlashcard("你好", "nǐ hǎo", { en: "hello" }); // nextReview = today
    const due = getDueCards();
    expect(due).toHaveLength(1);
  });

  it("getDueCards excludes future cards", () => {
    const card = addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    // Review with "easy" sets nextReview to future
    reviewCard(card.id, "easy");
    const due = getDueCards();
    expect(due).toHaveLength(0);
  });

  it("getTotalCardCount returns correct count", () => {
    expect(getTotalCardCount()).toBe(0);
    addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    addFlashcard("世界", "shì jiè", { en: "world" });
    expect(getTotalCardCount()).toBe(2);
  });

  it("reviewCard updates card in storage", () => {
    const card = addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    reviewCard(card.id, "good");
    const updated = getFlashcards()[0];
    expect(updated.reviewCount).toBe(1);
    expect(updated.interval).toBe(1);
    expect(updated.nextReview).toBe("2024-06-16");
  });

  it("readStore returns empty array for corrupt localStorage", () => {
    localStorage.setItem("flashcards", "not valid json{{{");
    expect(getFlashcards()).toEqual([]);
  });

  it("getDueCards sorts by nextReview ascending", () => {
    // Add two cards, manually set different review dates
    addFlashcard("世界", "shì jiè", { en: "world" });
    addFlashcard("你好", "nǐ hǎo", { en: "hello" });

    // Both due today, but modify one to have an earlier nextReview
    const cards = getFlashcards();
    cards[0].nextReview = "2024-06-14";
    cards[1].nextReview = "2024-06-13";
    localStorage.setItem("flashcards", JSON.stringify(cards));

    const due = getDueCards();
    expect(due).toHaveLength(2);
    expect(due[0].nextReview).toBe("2024-06-13");
    expect(due[1].nextReview).toBe("2024-06-14");
  });

  it("reviewCard does nothing for non-existent id", () => {
    addFlashcard("你好", "nǐ hǎo", { en: "hello" });
    reviewCard("non-existent-id", "good");
    // Card should be unchanged
    const cards = getFlashcards();
    expect(cards).toHaveLength(1);
    expect(cards[0].reviewCount).toBe(0);
  });

  vi.useRealTimers();
});
