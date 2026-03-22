"use client";

import { useState, useEffect, useCallback } from "react";
import type { Flashcard } from "@/lib/flashcardStore";
import { useTTS } from "@/hooks/useTTS";
import { useTranslation } from "@/locales";
import { SpeakerIcon, SpeakerWaveIcon } from "./Icons";

interface FlashcardPracticeProps {
  cards: Flashcard[];
}

export default function FlashcardPractice({ cards }: FlashcardPracticeProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const { speak, speaking } = useTTS();
  const t = useTranslation();

  const card = cards[index];

  // Reset flip when card changes
  useEffect(() => {
    setFlipped(false);
  }, [index]);

  const goNext = useCallback(() => {
    if (index + 1 < cards.length) {
      setIndex((prev) => prev + 1);
    } else {
      setDone(true);
    }
  }, [index, cards.length]);

  const goPrev = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (done) return;

      if (e.key === " ") {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [done, toggleFlip, goNext, goPrev]);

  if (done) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.practiceComplete}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {t.flashcards.wentThrough(cards.length)}
        </p>
        <button
          onClick={() => { setIndex(0); setDone(false); }}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t.flashcards.startOver}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-text-heading">{t.flashcards.practice}</h1>
      </div>

      {/* Progress */}
      <div className="w-full max-w-md">
        <div className="mb-1.5 flex items-center justify-between text-sm text-text-secondary">
          <span>{t.flashcards.xOfY(index + 1, cards.length)}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((index + 1) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={toggleFlip}
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
            <button
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); speak(card.word); }}
              disabled={speaking}
              aria-label={t.flashcards.speakWord}
            >
              {speaking ? (
                <SpeakerWaveIcon className="h-4 w-4 animate-pulse" />
              ) : (
                <SpeakerIcon className="h-4 w-4" />
              )}
            </button>
            <span className="text-5xl font-bold text-text-heading">
              {card.word}
            </span>
            <span className="mt-6 text-sm text-text-muted">
              {t.flashcards.clickToFlip}
            </span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-surface-card p-6"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <button
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); speak(card.word); }}
              disabled={speaking}
              aria-label={t.flashcards.speakWord}
            >
              {speaking ? (
                <SpeakerWaveIcon className="h-4 w-4 animate-pulse" />
              ) : (
                <SpeakerIcon className="h-4 w-4" />
              )}
            </button>
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
                    {lang === "en" ? t.common.langNameEn : lang === "vi" ? t.common.langNameVi : lang}
                  </span>
                  <p className="text-sm text-text-label">{def}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-body transition-colors hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {t.flashcards.prev}
        </button>
        <button
          onClick={goNext}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-body transition-colors hover:bg-surface-hover"
        >
          {t.flashcards.next}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-text-muted">
        {t.flashcards.keyboardHint}
      </p>
    </div>
  );
}
