import type { Flashcard, ReviewRating } from "@/lib/flashcardStore";

export interface FlashcardRow {
  id: string;
  user_id: string;
  word: string;
  pinyin: string;
  definitions: Record<string, string>;
  created_at: string;
  next_review: string;
  interval: number;
  ease_factor: number;
  review_count: number;
  last_rating: string | null;
}

export function mapDbToFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    word: row.word,
    pinyin: row.pinyin,
    definitions: row.definitions,
    createdAt: row.created_at,
    nextReview: row.next_review,
    interval: row.interval,
    easeFactor: row.ease_factor,
    reviewCount: row.review_count,
    lastRating: (row.last_rating as ReviewRating) ?? undefined,
  };
}
