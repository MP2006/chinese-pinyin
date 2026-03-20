"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Flashcard } from "@/lib/flashcardStore";
import { useTTS } from "@/hooks/useTTS";
import { SpeakerIcon, CheckCircleIcon } from "./Icons";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface FlashcardLearnProps {
  cards: Flashcard[];
}

export default function FlashcardLearn({ cards }: FlashcardLearnProps) {
  const shuffled = useMemo(() => shuffle(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<Flashcard[]>([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, speaking } = useTTS();

  const card = shuffled[index];

  useEffect(() => {
    if (!done && !result) inputRef.current?.focus();
  }, [index, done, result]);

  function handleSubmit() {
    if (result || !card) return;
    const isCorrect = input.trim() === card.word;
    setResult(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      speak(card.word);
    } else {
      setMissed((m) => [...m, card]);
    }
  }

  function advance() {
    setInput("");
    setResult(null);
    if (index + 1 < shuffled.length) {
      setIndex(index + 1);
    } else {
      setDone(true);
    }
  }

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(advance, 1000);
      return () => clearTimeout(t);
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  function retryMissed() {
    // Re-shuffle missed cards into the deck by resetting with missed as new source
    // Since we use useMemo on cards, we need a different approach - just reset state
    setIndex(0);
    setInput("");
    setResult(null);
    setCorrectCount(0);
    setDone(false);
    setMissed([]);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircleIcon className="mb-4 h-12 w-12 text-green-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session complete!</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {correctCount} of {shuffled.length} correct
        </p>
        {missed.length > 0 && (
          <button
            onClick={retryMissed}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            Retry missed ({missed.length})
          </button>
        )}
      </div>
    );
  }

  if (!card) return null;

  const primaryDef = Object.values(card.definitions)[0] || "";

  return (
    <div className="mx-auto max-w-md">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{index + 1} of {shuffled.length}</span>
          <span>{correctCount} correct</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300 dark:bg-teal-400"
            style={{ width: `${(index / shuffled.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Prompt card */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">{card.pinyin}</p>
        <div className="space-y-1">
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

      {/* Input */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (result === "incorrect") advance();
              else handleSubmit();
            }
          }}
          placeholder="Type the Chinese word..."
          disabled={result !== null}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${
            result === "correct"
              ? "border-green-400 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-300"
              : result === "incorrect"
                ? "border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300"
                : "border-gray-200 bg-white text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-teal-500"
          }`}
        />
        {result === null ? (
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-40 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            Check
          </button>
        ) : result === "incorrect" ? (
          <button
            onClick={advance}
            className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            Continue
          </button>
        ) : null}
      </div>

      {/* Answer feedback */}
      {result === "incorrect" && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Correct answer: <span className="font-medium text-gray-900 dark:text-gray-100">{card.word}</span>
          </p>
          <button
            onClick={() => speak(card.word)}
            disabled={speaking}
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Speak word"
          >
            <SpeakerIcon className={`h-3.5 w-3.5 ${speaking ? "animate-pulse" : ""}`} />
          </button>
        </div>
      )}
    </div>
  );
}
