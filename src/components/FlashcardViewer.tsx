"use client";

import { useState, useEffect, useCallback } from "react";
import type { Flashcard, ReviewRating } from "@/lib/flashcardStore";
import { useTTS } from "@/hooks/useTTS";
import { SpeakerIcon, SpeakerWaveIcon } from "./Icons";

function SpeakerButton({ speaking, onClick }: { speaking: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
      onClick={onClick}
      disabled={speaking}
      aria-label="Speak word"
    >
      {speaking ? (
        <SpeakerWaveIcon className="h-4 w-4 animate-pulse" />
      ) : (
        <SpeakerIcon className="h-4 w-4" />
      )}
    </button>
  );
}

const RATINGS: { rating: ReviewRating; label: string; key: string; color: string }[] = [
  { rating: "again", label: "Again", key: "1", color: "bg-red-500 hover:bg-red-600" },
  { rating: "hard", label: "Hard", key: "2", color: "bg-orange-500 hover:bg-orange-600" },
  { rating: "good", label: "Good", key: "3", color: "bg-green-500 hover:bg-green-600" },
  { rating: "easy", label: "Easy", key: "4", color: "bg-red-500 hover:bg-red-600" },
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
          className="relative h-80 w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-surface-card p-6"
            style={{ backfaceVisibility: "hidden" }}
          >
            <SpeakerButton speaking={speaking} onClick={(e) => { e.stopPropagation(); speak(card.word); }} />
            <span className="text-5xl font-bold text-text-heading">
              {card.word}
            </span>
            <span className="mt-6 text-sm text-text-muted">
              Click or press Space to reveal
            </span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-surface-card p-6"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <SpeakerButton speaking={speaking} onClick={(e) => { e.stopPropagation(); speak(card.word); }} />
            <span className="text-4xl font-bold text-text-heading">
              {card.word}
            </span>
            <span className="mt-2 text-lg text-text-secondary">
              {card.pinyin}
            </span>
            <div className="mt-4 w-full space-y-2 text-center">
              {Object.entries(card.definitions).map(([lang, def]) => (
                <div key={lang}>
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {lang === "en" ? "English" : lang === "vi" ? "Tiếng Việt" : lang}
                  </span>
                  <p className="text-sm text-text-label">{def}</p>
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
              className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${r.color}`}
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
