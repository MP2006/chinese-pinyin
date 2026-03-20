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
}

export type ReviewRating = "again" | "hard" | "good" | "easy";

const STORAGE_KEY = "flashcards";

import { todayStr } from "./dateUtils";

function readStore(): Flashcard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(cards: Flashcard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function getFlashcards(): Flashcard[] {
  return readStore();
}

export function addFlashcard(
  word: string,
  pinyin: string,
  definitions: Record<string, string>
): Flashcard {
  const cards = readStore();
  const existing = cards.find((c) => c.word === word);

  if (existing) {
    existing.definitions = { ...existing.definitions, ...definitions };
    writeStore(cards);
    return existing;
  }

  const card: Flashcard = {
    id: crypto.randomUUID(),
    word,
    pinyin,
    definitions,
    createdAt: new Date().toISOString(),
    nextReview: todayStr(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  };
  cards.push(card);
  writeStore(cards);
  return card;
}

export function removeFlashcard(id: string) {
  const cards = readStore().filter((c) => c.id !== id);
  writeStore(cards);
}

export function hasFlashcard(word: string): boolean {
  return readStore().some((c) => c.word === word);
}

export function getDueCards(): Flashcard[] {
  const today = todayStr();
  return readStore()
    .filter((c) => c.nextReview <= today)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
}

export function getTotalCardCount(): number {
  return readStore().length;
}

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

export function reviewCard(id: string, rating: ReviewRating) {
  const cards = readStore();
  const card = cards.find((c) => c.id === id);
  if (!card) return;

  const result = computeSM2(card, rating);
  card.interval = result.interval;
  card.easeFactor = result.easeFactor;
  card.reviewCount = result.reviewCount;
  card.nextReview = result.nextReview;

  writeStore(cards);
}
