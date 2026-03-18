import { describe, it, expect } from "vitest";
import { mapDbToFlashcard, type FlashcardRow } from "../types";

describe("mapDbToFlashcard", () => {
  const row: FlashcardRow = {
    id: "abc-123",
    user_id: "user-456",
    word: "你好",
    pinyin: "nǐ hǎo",
    definitions: { en: "hello", vi: "xin chào" },
    created_at: "2024-01-15T10:30:00Z",
    next_review: "2024-01-16",
    interval: 3,
    ease_factor: 2.5,
    review_count: 5,
  };

  it("maps snake_case to camelCase", () => {
    const card = mapDbToFlashcard(row);
    expect(card).toEqual({
      id: "abc-123",
      word: "你好",
      pinyin: "nǐ hǎo",
      definitions: { en: "hello", vi: "xin chào" },
      createdAt: "2024-01-15T10:30:00Z",
      nextReview: "2024-01-16",
      interval: 3,
      easeFactor: 2.5,
      reviewCount: 5,
    });
  });

  it("does not include user_id in output", () => {
    const card = mapDbToFlashcard(row);
    expect(card).not.toHaveProperty("user_id");
    expect(card).not.toHaveProperty("userId");
  });

  it("preserves complex definitions object", () => {
    const card = mapDbToFlashcard(row);
    expect(card.definitions).toEqual({ en: "hello", vi: "xin chào" });
  });
});
