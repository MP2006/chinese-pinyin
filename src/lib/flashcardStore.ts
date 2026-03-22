export interface Flashcard {
  id: string;
  word: string;
  pinyin: string;
  definitions: Record<string, string>;
  createdAt: string;
  nextReview: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  lastRating?: ReviewRating;
}

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface SM2Result {
  interval: number;
  easeFactor: number;
  reviewCount: number;
  nextReview: string;
}

export function computeSM2(
  card: Pick<Flashcard, "interval" | "easeFactor" | "reviewCount">,
  rating: ReviewRating
): SM2Result {
  let interval = card.interval;
  let easeFactor = card.easeFactor;
  const reviewCount = card.reviewCount + 1;
  const isNew = interval === 0;

  switch (rating) {
    case "again":
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;
    case "hard":
      interval = isNew ? 1 : Math.max(1, Math.round(interval * 1.2));
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;
    case "good":
      interval = isNew ? 1 : Math.max(1, Math.round(interval * easeFactor));
      break;
    case "easy":
      interval = isNew
        ? 4
        : Math.max(1, Math.round(interval * easeFactor * 1.3));
      easeFactor += 0.15;
      break;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval);
  const nextReview = next.toISOString().slice(0, 10);

  return { interval, easeFactor, reviewCount, nextReview };
}
