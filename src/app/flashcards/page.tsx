"use client";

import { useState, useCallback } from "react";
import { useFlashcards } from "@/hooks/useFlashcards";
import type { ReviewRating } from "@/lib/flashcardStore";
import FlashcardViewer from "@/components/FlashcardViewer";
import FlashcardBrowse from "@/components/FlashcardBrowse";
import FlashcardLearn from "@/components/FlashcardLearn";
import FlashcardMatch from "@/components/FlashcardMatch";

type Mode = "select" | "review" | "browse" | "learn" | "match";

const MODES = [
  {
    id: "review" as const,
    label: "Review",
    description: "Spaced repetition review",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    getSubtitle: (due: number) => `${due} card${due !== 1 ? "s" : ""} due`,
  },
  {
    id: "browse" as const,
    label: "Browse",
    description: "View all your saved words",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    getSubtitle: (_: number, total: number) => `${total} card${total !== 1 ? "s" : ""}`,
  },
  {
    id: "learn" as const,
    label: "Learn",
    description: "Quiz yourself on definitions",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
      </svg>
    ),
    getSubtitle: () => "Type the answer",
  },
  {
    id: "match" as const,
    label: "Match",
    description: "Match words to definitions",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.421 48.421 0 01-4.185-.428.639.639 0 00-.728.576 48.57 48.57 0 00-.06 3.397.64.64 0 00.728.575c1.385-.195 2.79-.322 4.21-.378a.64.64 0 01.657.642v0c0 .355-.186.676-.401.959a1.647 1.647 0 00-.349 1.003c0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.369-.128-.713-.349-1.003-.215-.283-.401-.604-.401-.959v0c0-.372.312-.68.686-.643a48.524 48.524 0 014.006.378.64.64 0 00.728-.575 48.57 48.57 0 00.06-3.397.64.64 0 00-.728-.576 48.32 48.32 0 01-3.977-.428.64.64 0 01-.686-.643v0z" />
      </svg>
    ),
    getSubtitle: () => "Timed game",
  },
];

export default function FlashcardsPage() {
  const { cards: allCards, dueCards, totalCount, loading, removeCard, reviewCard, refresh } = useFlashcards();
  const [mode, setMode] = useState<Mode>("select");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  const handleReview = useCallback(
    (id: string, rating: ReviewRating) => {
      reviewCard(id, rating);
      const newReviewed = reviewedCount + 1;
      setReviewedCount(newReviewed);

      if (currentIndex + 1 < dueCards.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setSessionDone(true);
      }
    },
    [currentIndex, dueCards.length, reviewedCount, reviewCard]
  );

  const handleDelete = useCallback((id: string) => {
    removeCard(id);
  }, [removeCard]);

  function goBack() {
    setMode("select");
    refresh();
    // Reset review state
    setCurrentIndex(0);
    setReviewedCount(0);
    setSessionDone(false);
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600 dark:border-gray-600 dark:border-t-teal-400" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading flashcards...</p>
        </div>
      </main>
    );
  }

  // Empty state — no cards at all
  if (totalCount === 0) {
    return (
      <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <svg className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No flashcards yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Save words from the Home page to start reviewing
          </p>
        </div>
      </main>
    );
  }

  // Mode select screen
  if (mode === "select") {
    return (
      <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Flashcards
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {totalCount} card{totalCount !== 1 ? "s" : ""} saved
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  if (m.id === "review") {
                    setCurrentIndex(0);
                    setReviewedCount(0);
                    setSessionDone(false);
                  }
                  setMode(m.id);
                }}
                className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-5 text-center transition-all hover:border-teal-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-teal-700"
              >
                <div className="mb-3 text-gray-600 dark:text-gray-400">
                  {m.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {m.label}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {m.getSubtitle(dueCards.length, totalCount)}
                </p>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  {m.description}
                </p>
              </button>
            ))}
          </div>

          {/* Terms in this set */}
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Terms in this set ({allCards.length})
            </h2>
            <div className="space-y-2">
              {allCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="w-24 shrink-0">
                    <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {card.word}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{card.pinyin}</p>
                  </div>
                  <div className="h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                  <div className="min-w-0 flex-1">
                    {Object.entries(card.definitions).map(([lang, def]) => (
                      <p key={lang} className="text-sm text-gray-600 dark:text-gray-400">
                        {def}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Active mode — back button + content
  return (
    <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Back button */}
        <button
          onClick={goBack}
          className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to modes
        </button>

        {/* Review mode */}
        {mode === "review" && (
          <>
            {dueCards.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">All caught up!</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No cards due right now
                </p>
              </div>
            ) : sessionDone ? (
              <div className="flex flex-col items-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Session complete!</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    Review
                  </h1>
                </div>
                <div className="mb-8">
                  <div className="mb-1.5 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{currentIndex + 1} of {dueCards.length}</span>
                    <span>{reviewedCount} reviewed</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-all duration-300 dark:bg-teal-400"
                      style={{ width: `${(currentIndex / dueCards.length) * 100}%` }}
                    />
                  </div>
                </div>
                <FlashcardViewer card={dueCards[currentIndex]} onReview={handleReview} />
              </>
            )}
          </>
        )}

        {/* Browse mode */}
        {mode === "browse" && (
          <FlashcardBrowse cards={allCards} onDelete={handleDelete} />
        )}

        {/* Learn mode */}
        {mode === "learn" && (
          <FlashcardLearn cards={allCards} />
        )}

        {/* Match mode */}
        {mode === "match" && (
          allCards.length < 2 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You need at least 2 cards to play Match
              </p>
            </div>
          ) : (
            <FlashcardMatch cards={allCards} />
          )
        )}
      </div>
    </main>
  );
}
