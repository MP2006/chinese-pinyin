"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useFlashcards } from "@/hooks/useFlashcards";
import { useAuth } from "@/contexts/AuthContext";
import { useTTS } from "@/hooks/useTTS";
import type { Flashcard, ReviewRating } from "@/lib/flashcardStore";
import FlashcardViewer from "@/components/FlashcardViewer";
import FlashcardBrowse from "@/components/FlashcardBrowse";
import FlashcardLearn from "@/components/FlashcardLearn";
import FlashcardMatch from "@/components/FlashcardMatch";
import { CloseIcon, SpeakerIcon, TrashIcon, PlusIcon } from "@/components/Icons";

type Mode = "select" | "review" | "browse" | "learn" | "match";

type MasteryLevel = "new" | "learning" | "mastered";

function getMasteryLevel(card: Flashcard): MasteryLevel {
  if (card.interval < 3 || card.easeFactor < 1.8) return "new";
  if (card.interval >= 21) return "mastered";
  return "learning";
}

function masteryColor(level: MasteryLevel): string {
  if (level === "mastered") return "bg-green-500";
  if (level === "learning") return "bg-yellow-500";
  return "bg-red-500";
}

function masteryLabel(level: MasteryLevel): string {
  if (level === "mastered") return "Mastered";
  if (level === "learning") return "Learning";
  return "New";
}

const MODES = [
  {
    id: "review" as const,
    label: "Review",
    description: "Spaced repetition review",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.421 48.421 0 01-4.185-.428.639.639 0 00-.728.576 48.57 48.57 0 00-.06 3.397.64.64 0 00.728.575c1.385-.195 2.79-.322 4.21-.378a.64.64 0 01.657.642v0c0 .355-.186.676-.401.959a1.647 1.647 0 00-.349 1.003c0 1.035 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875c0-.369-.128-.713-.349-1.003-.215-.283-.401-.604-.401-.959v0c0-.372.312-.68.686-.643a48.524 48.524 0 014.006.378.64.64 0 00.728-.575 48.57 48.57 0 00.06-3.397.64.64 0 00-.728-.576 48.32 48.32 0 01-3.977-.428.64.64 0 01-.686-.643v0z" />
      </svg>
    ),
    getSubtitle: () => "Timed game",
  },
];

export default function FlashcardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { cards: allCards, dueCards, totalCount, loading, syncError, clearSyncError, addCard, removeCard, reviewCard, refresh } = useFlashcards();
  const { speak, speaking } = useTTS();
  const [mode, setMode] = useState<Mode>("select");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ word: "", pinyin: "", definition: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    if (!search) return allCards;
    const q = search.toLowerCase();
    return allCards.filter(
      (card) =>
        card.word.includes(search) ||
        card.pinyin.toLowerCase().includes(q) ||
        Object.values(card.definitions).some((d) => d.toLowerCase().includes(q))
    );
  }, [allCards, search]);

  // Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAddModal(false);
    }
    if (showAddModal) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [showAddModal]);

  // Reset confirmDeleteId when search changes
  useEffect(() => {
    setConfirmDeleteId(null);
  }, [search]);

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
    setCurrentIndex(0);
    setReviewedCount(0);
    setSessionDone(false);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.word.trim() || !addForm.pinyin.trim() || !addForm.definition.trim()) return;
    addCard(addForm.word.trim(), addForm.pinyin.trim(), { en: addForm.definition.trim() });
    setAddForm({ word: "", pinyin: "", definition: "" });
    setShowAddModal(false);
  }

  const addCardModal = showAddModal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setShowAddModal(false)}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-border bg-surface-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-heading">Add Card</h3>
          <button
            onClick={() => setShowAddModal(false)}
            className="text-text-muted hover:text-text-body dark:hover:text-text-label"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              Word
            </label>
            <input
              type="text"
              value={addForm.word}
              onChange={(e) => setAddForm((f) => ({ ...f, word: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder="e.g. 你好"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              Pinyin
            </label>
            <input
              type="text"
              value={addForm.pinyin}
              onChange={(e) => setAddForm((f) => ({ ...f, pinyin: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder="e.g. nǐ hǎo"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              Definition (English)
            </label>
            <input
              type="text"
              value={addForm.definition}
              onChange={(e) => setAddForm((f) => ({ ...f, definition: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder="e.g. hello"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-text-body transition-colors hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:px-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary dark:border-gray-600" />
          <p className="mt-4 text-sm text-text-secondary">Loading flashcards...</p>
        </div>
      </main>
    );
  }

  // Not logged in — prompt to sign in
  if (!user && !authLoading) {
    return (
      <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:px-8">
          <svg className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-lg font-semibold text-text-heading">Sign in to save and review flashcards</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Create an account to save words and track your progress
          </p>
          <Link
            href="/login"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  // Empty state — no cards at all
  if (totalCount === 0) {
    return (
      <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:px-8">
          <svg className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h2 className="text-lg font-semibold text-text-heading">No flashcards yet</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Save words from the Home page to start reviewing
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Add Card
          </button>
        </div>
        {addCardModal}
      </main>
    );
  }

  // Mode select screen
  if (mode === "select") {
    return (
      <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
          {syncError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-primary-soft px-4 py-3 text-sm text-primary-text dark:border-red-800">
              <span>{syncError}</span>
              <button onClick={clearSyncError} className="ml-3 shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300" aria-label="Dismiss error">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-text-heading">
              Flashcards
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              {totalCount} card{totalCount !== 1 ? "s" : ""} saved
            </p>
          </div>

          {/* Section 1: Action Cards */}
          <div className="grid grid-cols-2 gap-5">
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
                  className="group flex flex-col items-center rounded-xl border border-border bg-surface-card p-6 text-center transition-all duration-200 hover:border-border-input hover:bg-surface-hover"
                >
                  <div className="mb-4 text-text-body transition-colors group-hover:text-primary-text">
                    {m.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-text-heading">
                    {m.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {m.getSubtitle(dueCards.length, totalCount)}
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {m.description}
                  </p>
                </button>
            ))}
          </div>

          {/* Section 2: Controls Bar */}
          <div className="mt-12 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search words, pinyin, or definitions..."
                className="w-full border-b border-border-input bg-transparent py-2 pl-6 pr-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Add Card
            </button>
          </div>

          {/* Section 3: Vocabulary List */}
          <div className="mt-4">
            <h2 className="mb-3 text-sm font-medium text-text-secondary">
              Terms in this set ({filteredCards.length})
            </h2>
            <div className="space-y-2">
              {filteredCards.map((card) => {
                const level = getMasteryLevel(card);
                return (
                  <div
                    key={card.id}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-surface-card px-5 py-4"
                  >
                    {/* SRS dot */}
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${masteryColor(level)}`}
                      title={masteryLabel(level)}
                    />
                    {/* Word + pinyin */}
                    <div className="w-24 shrink-0">
                      <span className="text-lg font-medium text-text-heading">
                        {card.word}
                      </span>
                      <p className="text-xs text-text-secondary">{card.pinyin}</p>
                    </div>
                    {/* Divider */}
                    <div className="h-8 w-px shrink-0 bg-border" />
                    {/* Definitions */}
                    <div className="min-w-0 flex-1">
                      {Object.entries(card.definitions).map(([lang, def]) => (
                        <p key={lang} className="truncate text-sm text-text-body">
                          {def}
                        </p>
                      ))}
                    </div>
                    {/* Hover actions */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => speak(card.word)}
                        disabled={speaking}
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-slate-700 dark:hover:text-gray-300"
                        aria-label="Pronounce"
                      >
                        <SpeakerIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirmDeleteId === card.id) {
                            handleDelete(card.id);
                            setConfirmDeleteId(null);
                          } else {
                            setConfirmDeleteId(card.id);
                          }
                        }}
                        className={`rounded p-1.5 transition-colors ${
                          confirmDeleteId === card.id
                            ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-slate-700 dark:hover:text-gray-300"
                        }`}
                        aria-label={confirmDeleteId === card.id ? "Confirm delete" : "Delete card"}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {search && filteredCards.length === 0 && (
                <p className="py-8 text-center text-sm text-text-muted">
                  No cards match &ldquo;{search}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
        {addCardModal}
      </main>
    );
  }

  // Active mode — back button + content
  return (
    <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Back button */}
        <button
          onClick={goBack}
          className="mb-6 flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-label"
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
                <h2 className="text-lg font-semibold text-text-heading">All caught up!</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  No cards due right now
                </p>
              </div>
            ) : sessionDone ? (
              <div className="flex flex-col items-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-text-heading">Session complete!</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight text-text-heading">
                    Review
                  </h1>
                </div>
                <div className="mb-8">
                  <div className="mb-1.5 flex items-center justify-between text-sm text-text-secondary">
                    <span>{currentIndex + 1} of {dueCards.length}</span>
                    <span>{reviewedCount} reviewed</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
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
              <p className="text-sm text-text-secondary">
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
