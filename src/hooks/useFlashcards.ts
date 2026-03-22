"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { mapDbToFlashcard, type FlashcardRow } from "@/lib/supabase/types";
import {
  computeSM2,
  type Flashcard,
  type ReviewRating,
} from "@/lib/flashcardStore";

import { todayStr } from "@/lib/dateUtils";

// Module-level singleton — stable reference, never in dependency arrays
const supabase = createClient();

export function useFlashcards() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Ref always holds the latest cards — avoids stale closures in callbacks
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  // --- Full fetch: only on mount, auth change, or explicit refresh ---
  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCards((data as FlashcardRow[]).map(mapDbToFlashcard));
    }
    setLoading(false);
  }, [user, authLoading]);

  // --- Initial load ---
  useEffect(() => {
    refresh();
  }, [refresh]);

  // --- Memoized derived state ---
  const dueCards = useMemo(() => {
    const today = todayStr();
    return cards
      .filter((c) => c.nextReview <= today)
      .sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  }, [cards]);

  const totalCount = cards.length;

  // --- Optimistic mutations ---

  const addCard = useCallback(
    async (word: string, pinyin: string, definitions: Record<string, string>) => {
      if (!user) return;

      setSyncError(null);

      // Read current state from ref to avoid stale closure
      const existing = cardsRef.current.find((c) => c.word === word);

      if (existing) {
        const mergedDefs = { ...existing.definitions, ...definitions };
        // Optimistic update
        setCards((prev) =>
          prev.map((c) =>
            c.word === word ? { ...c, definitions: mergedDefs } : c
          )
        );
        // Background sync
        const { error } = await supabase
          .from("flashcards")
          .update({ definitions: mergedDefs })
          .eq("id", existing.id)
          .eq("user_id", user.id);
        if (error) {
          setSyncError(`Failed to save card: ${error.message}`);
          refresh();
        }
      } else {
        const newId = crypto.randomUUID();
        // Optimistic update
        setCards((prev) => [
          {
            id: newId,
            word,
            pinyin,
            definitions,
            createdAt: new Date().toISOString(),
            nextReview: todayStr(),
            interval: 0,
            easeFactor: 2.5,
            reviewCount: 0,
          },
          ...prev,
        ]);
        // Background sync
        const { error } = await supabase.from("flashcards").insert({
          id: newId,
          user_id: user.id,
          word,
          pinyin,
          definitions,
        });
        if (error) {
          setSyncError(`Failed to save card: ${error.message}`);
          refresh();
        }
      }
    },
    [user, refresh]
  );

  const removeCard = useCallback(
    async (id: string) => {
      if (!user) return;

      setSyncError(null);

      // Optimistic: remove from local state immediately
      setCards((prev) => prev.filter((c) => c.id !== id));

      // Background sync
      const { error } = await supabase.from("flashcards").delete().eq("id", id).eq("user_id", user.id);
      if (error) {
        setSyncError(`Failed to delete card: ${error.message}`);
        refresh();
      }
    },
    [user, refresh]
  );

  const hasCard = useCallback(
    (word: string): boolean => {
      if (!user) return false;
      return cards.some((c) => c.word === word);
    },
    [user, cards]
  );

  const reviewCardAction = useCallback(
    async (id: string, rating: ReviewRating) => {
      if (!user) return;

      setSyncError(null);

      // Read current card from ref to avoid stale closure
      const card = cardsRef.current.find((c) => c.id === id);
      if (!card) return;

      const sm2 = computeSM2(card, rating);

      // Optimistic update
      setCards((prev) =>
        prev.map((c) =>
          c.id !== id
            ? c
            : {
                ...c,
                interval: sm2.interval,
                easeFactor: sm2.easeFactor,
                reviewCount: sm2.reviewCount,
                nextReview: sm2.nextReview,
                lastRating: rating,
              }
        )
      );

      // Background sync
      const { error } = await supabase
        .from("flashcards")
        .update({
          interval: sm2.interval,
          ease_factor: sm2.easeFactor,
          review_count: sm2.reviewCount,
          next_review: sm2.nextReview,
          last_rating: rating,
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) {
        setSyncError(`Failed to save review: ${error.message}`);
        refresh();
      }
    },
    [user, refresh]
  );

  const clearSyncError = useCallback(() => setSyncError(null), []);

  return {
    cards,
    dueCards,
    totalCount,
    loading: loading || authLoading,
    syncError,
    clearSyncError,
    addCard,
    removeCard,
    hasCard,
    reviewCard: reviewCardAction,
    refresh,
  };
}
