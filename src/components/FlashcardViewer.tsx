"use client";

import { useState, useEffect, useCallback } from "react";
import type { Flashcard, ReviewRating } from "@/lib/flashcardStore";
import { useTTS } from "@/hooks/useTTS";

function SpeakerButton({ speaking, onClick }: { speaking: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      onClick={onClick}
      disabled={speaking}
      aria-label="Speak word"
    >
      {speaking ? (
        <svg className="h-4 w-4 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
      )}
    </button>
  );
}

const RATINGS: { rating: ReviewRating; label: string; key: string; color: string }[] = [
  { rating: "again", label: "Again", key: "1", color: "bg-red-500 hover:bg-red-600" },
  { rating: "hard", label: "Hard", key: "2", color: "bg-orange-500 hover:bg-orange-600" },
  { rating: "good", label: "Good", key: "3", color: "bg-green-500 hover:bg-green-600" },
  { rating: "easy", label: "Easy", key: "4", color: "bg-blue-500 hover:bg-blue-600" },
];

interface FlashcardViewerProps {
  card: Flashcard;
  onReview: (id: string, rating: ReviewRating) => void;
}

export default function FlashcardViewer({ card, onReview }: FlashcardViewerProps) {
  const [flipped, setFlipped] = useState(false);
  const { speak, speaking } = useTTS();

  // Reset to front when card changes
  useEffect(() => {
    setFlipped(false);
  }, [card.id]);

  const handleFlip = useCallback(() => {
    if (!flipped) setFlipped(true);
  }, [flipped]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === " ") {
        e.preventDefault();
        handleFlip();
      } else if (flipped && e.key >= "1" && e.key <= "4") {
        const idx = parseInt(e.key) - 1;
        onReview(card.id, RATINGS[idx].rating);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flipped, card.id, onReview, handleFlip]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card */}
      <div
        className="w-full max-w-md cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleFlip}
      >
        <div
          className="relative h-72 w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ backfaceVisibility: "hidden" }}
          >
            <SpeakerButton speaking={speaking} onClick={(e) => { e.stopPropagation(); speak(card.word); }} />
            <span className="text-5xl font-bold text-gray-900 dark:text-gray-100">
              {card.word}
            </span>
            <span className="mt-6 text-sm text-gray-400 dark:text-gray-500">
              Click or press Space to reveal
            </span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <SpeakerButton speaking={speaking} onClick={(e) => { e.stopPropagation(); speak(card.word); }} />
            <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {card.word}
            </span>
            <span className="mt-2 text-lg text-gray-500 dark:text-gray-400">
              {card.pinyin}
            </span>
            <div className="mt-4 w-full space-y-2 text-center">
              {Object.entries(card.definitions).map(([lang, def]) => (
                <div key={lang}>
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {lang === "en" ? "English" : lang === "vi" ? "Tiếng Việt" : lang}
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{def}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Review buttons */}
      {flipped && (
        <div className="flex gap-3">
          {RATINGS.map((r) => (
            <button
              key={r.rating}
              onClick={() => onReview(card.id, r.rating)}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${r.color}`}
            >
              {r.label}
              <span className="ml-1.5 text-xs opacity-70">({r.key})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
