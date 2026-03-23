"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  RotateCcw,
  Brain,
  Grid3x3,
  Edit3,
  Zap,
  Search,
  Plus,
  Volume2,
  Trash2,
} from "lucide-react";
import { useFlashcards } from "@/hooks/useFlashcards";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTTS } from "@/hooks/useTTS";
import type { ReviewRating } from "@/lib/flashcardStore";
import FlashcardViewer from "@/components/FlashcardViewer";
import FlashcardBrowse from "@/components/FlashcardBrowse";
import FlashcardLearn from "@/components/FlashcardLearn";
import FlashcardMatch from "@/components/FlashcardMatch";
import FlashcardPractice from "@/components/FlashcardPractice";
import { CloseIcon, PlusIcon } from "@/components/Icons";
import { useTranslation } from "@/locales";
import type { LucideIcon } from "lucide-react";

type Mode = "select" | "review" | "practice" | "browse" | "learn" | "match";

const RATING_DOT_COLOR: Record<string, string> = {
  again: "bg-red-500",
  hard: "bg-orange-500",
  good: "bg-emerald-500",
  easy: "bg-blue-500",
};

function ratingDotColor(rating?: ReviewRating): string {
  if (!rating) return "bg-gray-400 dark:bg-gray-600";
  return RATING_DOT_COLOR[rating];
}

interface ModeCardMeta {
  icon: LucideIcon;
  color: string;
  lightColor: string;
  borderColor: string;
}

const MODE_META: Record<string, ModeCardMeta> = {
  review: {
    icon: RotateCcw,
    color: "from-purple-500 to-indigo-500",
    lightColor: "from-purple-500/10 to-indigo-500/10",
    borderColor: "border-purple-500/20",
  },
  practice: {
    icon: Brain,
    color: "from-red-500 to-pink-500",
    lightColor: "from-red-500/10 to-pink-500/10",
    borderColor: "border-red-500/20",
  },
  browse: {
    icon: Grid3x3,
    color: "from-blue-500 to-cyan-500",
    lightColor: "from-blue-500/10 to-cyan-500/10",
    borderColor: "border-blue-500/20",
  },
  learn: {
    icon: Edit3,
    color: "from-green-500 to-emerald-500",
    lightColor: "from-green-500/10 to-emerald-500/10",
    borderColor: "border-green-500/20",
  },
  match: {
    icon: Zap,
    color: "from-orange-500 to-red-500",
    lightColor: "from-orange-500/10 to-red-500/10",
    borderColor: "border-orange-500/20",
  },
};

export default function FlashcardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useSettings();
  const { cards: allCards, dueCards, totalCount, loading, syncError, clearSyncError, addCard, removeCard, reviewCard, refresh } = useFlashcards();
  const { speak, speaking } = useTTS();
  const t = useTranslation();

  const modes = [
    { id: "review" as const, label: t.flashcards.review, description: t.flashcards.reviewDesc, getSubtitle: (due: number) => t.flashcards.dueCount(due) },
    { id: "practice" as const, label: t.flashcards.practice, description: t.flashcards.practiceDesc, getSubtitle: (_: number, total: number) => t.flashcards.nCards(total) },
    { id: "browse" as const, label: t.flashcards.browse, description: t.flashcards.browseDesc, getSubtitle: (_: number, total: number) => t.flashcards.nCards(total) },
    { id: "learn" as const, label: t.flashcards.learn, description: t.flashcards.learnDesc, getSubtitle: () => t.flashcards.typeTheAnswer },
    { id: "match" as const, label: t.flashcards.match, description: t.flashcards.matchDesc, getSubtitle: () => t.flashcards.timedGame },
  ];

  const legendItems = [
    { color: "bg-gray-400 dark:bg-gray-600", label: t.flashcards.notReviewed },
    { color: "bg-red-500", label: t.flashcards.again },
    { color: "bg-orange-500", label: t.flashcards.hard },
    { color: "bg-emerald-500", label: t.flashcards.good },
    { color: "bg-blue-500", label: t.flashcards.easy },
  ];

  function ratingDotLabel(rating?: ReviewRating): string {
    if (!rating) return t.flashcards.notReviewed;
    const labels: Record<string, string> = { again: t.flashcards.again, hard: t.flashcards.hard, good: t.flashcards.good, easy: t.flashcards.easy };
    return labels[rating];
  }
  const [mode, setMode] = useState<Mode>("select");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ word: "", pinyin: "", definition: "" });


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


  const handleReview = useCallback(
    (id: string, rating: ReviewRating) => {
      reviewCard(id, rating);
      setReviewedCount((c) => c + 1);
      setCurrentIndex((prev) => {
        if (prev + 1 < dueCards.length) return prev + 1;
        setSessionDone(true);
        return prev;
      });
    },
    [dueCards.length, reviewCard]
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
    addCard(addForm.word.trim(), addForm.pinyin.trim(), { [lang]: addForm.definition.trim() });
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
          <h3 className="text-lg font-semibold text-text-heading">{t.flashcards.addCard}</h3>
          <button
            onClick={() => setShowAddModal(false)}
            className="text-text-muted hover:text-text-body dark:hover:text-text-label"
            aria-label={t.common.close}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              {t.flashcards.word}
            </label>
            <input
              type="text"
              value={addForm.word}
              onChange={(e) => setAddForm((f) => ({ ...f, word: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder={t.flashcards.wordPlaceholder}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              {t.flashcards.pinyin}
            </label>
            <input
              type="text"
              value={addForm.pinyin}
              onChange={(e) => setAddForm((f) => ({ ...f, pinyin: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder={t.flashcards.pinyinPlaceholder}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-label">
              {t.flashcards.definitionLabel}
            </label>
            <input
              type="text"
              value={addForm.definition}
              onChange={(e) => setAddForm((f) => ({ ...f, definition: e.target.value }))}
              className="w-full rounded-md border border-border-input bg-white px-3 py-2 text-sm text-text-heading placeholder-gray-400 focus:border-primary-text focus:outline-none dark:bg-surface-hover dark:placeholder-gray-500"
              placeholder={t.flashcards.defPlaceholder}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-text-body transition-colors hover:text-gray-800 dark:hover:text-gray-200"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {t.flashcards.addCard}
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
          <p className="mt-4 text-sm text-text-secondary">{t.flashcards.loadingFlashcards}</p>
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
          <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.signInPrompt}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t.flashcards.signInDesc}
          </p>
          <Link
            href="/login"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {t.login.signIn}
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
          <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.noCards}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {t.flashcards.noCardsDesc}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="h-4 w-4" />
            {t.flashcards.addCard}
          </button>
        </div>
        {addCardModal}
      </main>
    );
  }

  // Mode select screen
  if (mode === "select") {
    return (
      <main className="min-h-screen pt-14 transition-colors md:pt-0">
        <div className="mx-auto max-w-7xl px-8 py-10">
          {syncError && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-primary-soft px-4 py-3 text-sm text-primary-text dark:border-red-800">
              <span>{syncError}</span>
              <button onClick={clearSyncError} className="ml-3 shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300" aria-label={t.common.dismissError}>
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-text-heading">
              {t.flashcards.title}
            </h1>
            <p className="text-text-muted">
              {t.flashcards.cardCount(totalCount)}
            </p>
          </motion.div>

          {/* Mode Cards Grid */}
          <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {modes.map((m, index) => {
              const meta = MODE_META[m.id];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => {
                      if (m.id === "review") {
                        setCurrentIndex(0);
                        setReviewedCount(0);
                        setSessionDone(false);
                      }
                      setMode(m.id);
                    }}
                    className={`group relative block w-full overflow-hidden rounded-2xl border bg-surface-card p-6 text-left transition-all duration-300 hover:bg-surface-hover ${meta.borderColor}`}
                  >
                    {/* Gradient Background on Hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.lightColor} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

                    {/* Content */}
                    <div className="relative">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                        <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                      </div>
                      <h3 className="text-lg font-semibold text-text-heading">
                        {m.label}
                      </h3>
                      <p className="mt-0.5 text-sm text-text-muted">
                        {m.description}
                      </p>
                      <p className="mt-1 text-xs text-text-muted/60">
                        {m.getSubtitle(dueCards.length, totalCount)}
                      </p>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Terms Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="overflow-hidden rounded-2xl border border-border bg-surface-card"
          >
            {/* Search and Add Card */}
            <div className="border-b border-border p-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.flashcards.searchPlaceholder}
                    className="w-full rounded-xl border border-border bg-surface-page py-3 pl-12 pr-4 text-text-heading placeholder-text-muted transition-colors focus:border-primary-text focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                >
                  <Plus className="h-5 w-5" />
                  {t.flashcards.addCard}
                </button>
              </div>
            </div>

            {/* Terms Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-6 py-4">
              <h2 className="font-semibold text-text-heading">
                {t.flashcards.termsInSet(filteredCards.length)}
              </h2>
              <div className="flex items-center gap-3 text-xs">
                {legendItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="text-text-muted">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card List */}
            <div className="max-h-[600px] divide-y divide-border overflow-y-auto">
              {filteredCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * Math.min(index, 15) }}
                  className="group px-6 py-5 transition-colors duration-200 hover:bg-surface-hover"
                >
                  <div className="flex items-start gap-4">
                    {/* Difficulty Indicator */}
                    <div className="mt-2 shrink-0">
                      <div
                        className={`h-3 w-3 rounded-full ${ratingDotColor(card.lastRating)}`}
                        title={ratingDotLabel(card.lastRating)}
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-3">
                        <span className="text-2xl font-semibold text-text-heading">
                          {card.word}
                        </span>
                        <span className="text-base text-primary-text">
                          {card.pinyin}
                        </span>
                      </div>
                      <div className="leading-relaxed text-text-muted">
                        {Object.entries(card.definitions).map(([defLang, def]) => (
                          <p key={defLang} className="whitespace-pre-line text-sm">
                            {def}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => speak(card.word)}
                        disabled={speaking}
                        className="rounded-lg p-2.5 text-text-muted transition-colors hover:bg-blue-500/10 hover:text-blue-400 disabled:opacity-40"
                        aria-label={t.flashcards.pronounce}
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="rounded-lg p-2.5 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        aria-label={t.flashcards.deleteCard}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {search && filteredCards.length === 0 && (
                <p className="py-8 text-center text-sm text-text-muted">
                  {t.flashcards.noMatch(search)}
                </p>
              )}
            </div>
          </motion.div>
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
          {t.flashcards.backToModes}
        </button>

        {/* Review mode */}
        {mode === "review" && (
          <>
            {dueCards.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.allCaughtUp}</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {t.flashcards.noCardsDue}
                </p>
              </div>
            ) : sessionDone || currentIndex >= dueCards.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <svg className="mb-4 h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-text-heading">{t.flashcards.sessionComplete}</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {t.flashcards.reviewed(reviewedCount)}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-3xl font-bold tracking-tight text-text-heading">
                    {t.flashcards.review}
                  </h1>
                </div>
                <div className="mb-8">
                  <div className="mb-1.5 flex items-center justify-between text-sm text-text-secondary">
                    <span>{t.flashcards.xOfY(currentIndex + 1, dueCards.length)}</span>
                    <span>{t.flashcards.nReviewed(reviewedCount)}</span>
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

        {/* Practice mode */}
        {mode === "practice" && (
          <FlashcardPractice cards={allCards} />
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
                {t.flashcards.needAtLeast2}
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
