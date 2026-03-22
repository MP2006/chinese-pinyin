"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { Flashcard } from "@/lib/flashcardStore";
import { useTranslation } from "@/locales";
import { CheckCircleIcon } from "./Icons";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Tile {
  id: string;
  cardId: string;
  text: string;
  type: "word" | "definition";
}

interface FlashcardMatchProps {
  cards: Flashcard[];
}

export default function FlashcardMatch({ cards }: FlashcardMatchProps) {
  const t = useTranslation();
  const [round, setRound] = useState(0);

  const gameCards = useMemo(() => {
    const shuffledCards = shuffle(cards);
    return shuffledCards.slice(0, 6);
  }, [cards, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = useMemo(() => {
    const t: Tile[] = [];
    gameCards.forEach((card) => {
      t.push({ id: `w-${card.id}`, cardId: card.id, text: card.word, type: "word" });
      const def = Object.values(card.definitions)[0] || card.pinyin;
      t.push({ id: `d-${card.id}`, cardId: card.id, text: def, type: "definition" });
    });
    return shuffle(t);
  }, [gameCards]);

  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [shaking, setShaking] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [complete, setComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Check completion
  useEffect(() => {
    if (matched.size === tiles.length && tiles.length > 0) {
      setComplete(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [matched.size, tiles.length]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function handleTileClick(tile: Tile) {
    if (matched.has(tile.id) || shaking.size > 0) return;

    if (!selected) {
      setSelected(tile.id);
      return;
    }

    if (selected === tile.id) {
      setSelected(null);
      return;
    }

    const selectedTile = tiles.find((t) => t.id === selected)!;

    // Must be different types (word + definition) and same card
    if (selectedTile.cardId === tile.cardId && selectedTile.type !== tile.type) {
      // Match!
      setMatched((prev) => new Set([...prev, selectedTile.id, tile.id]));
      setSelected(null);
    } else {
      // Mismatch
      const shakingIds = new Set([selected, tile.id]);
      setShaking(shakingIds);
      setSelected(null);
      setTimeout(() => setShaking(new Set()), 500);
    }
  }

  function playAgain() {
    setRound((r) => r + 1);
    setSelected(null);
    setMatched(new Set());
    setShaking(new Set());
    setElapsed(0);
    setComplete(false);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  }

  if (complete) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircleIcon className="mb-4 h-12 w-12 text-green-400" />
        <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.allMatched}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {t.flashcards.time(formatTime(elapsed))}
        </p>
        <button
          onClick={playAgain}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t.flashcards.playAgain}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Timer */}
      <div className="mb-6 text-center">
        <span className="font-mono text-lg text-text-body">
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.id);
          const isSelected = selected === tile.id;
          const isShaking = shaking.has(tile.id);

          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile)}
              disabled={isMatched}
              className={`flex h-28 items-center justify-center rounded-xl border p-4 text-center transition-all duration-200 ${
                isMatched
                  ? "scale-90 border-green-300 bg-green-50 opacity-40 dark:border-green-700 dark:bg-green-900/20"
                  : isSelected
                    ? "border-primary bg-primary-soft shadow-md"
                    : isShaking
                      ? "animate-shake border-red-300 bg-primary-soft dark:border-red-700"
                      : "border-border bg-surface-card hover:border-gray-300 hover:shadow-sm dark:hover:border-gray-600"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  isMatched
                    ? "text-success"
                    : "text-text-heading"
                } ${tile.type === "word" ? "text-lg" : ""}`}
              >
                {tile.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
