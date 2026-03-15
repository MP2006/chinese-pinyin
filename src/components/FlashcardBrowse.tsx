"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/flashcardStore";
import { useTTS } from "@/hooks/useTTS";

interface FlashcardBrowseProps {
  cards: Flashcard[];
  onDelete: (id: string) => void;
}

export default function FlashcardBrowse({ cards, onDelete }: FlashcardBrowseProps) {
  const [search, setSearch] = useState("");
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { speak, speaking } = useTTS();

  const filtered = cards.filter((card) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      card.word.includes(search) ||
      card.pinyin.toLowerCase().includes(q) ||
      Object.values(card.definitions).some((d) => d.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search words, pinyin, or definitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-teal-500"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No matching cards
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((card) => {
            const isFlipped = flippedId === card.id;
            return (
              <div
                key={card.id}
                className="relative cursor-pointer"
                style={{ perspective: "800px" }}
                onClick={() => setFlippedId(isFlipped ? null : card.id)}
              >
                <div
                  className="relative h-48 w-full transition-transform duration-400"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    {/* Speaker */}
                    <button
                      className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                      disabled={speaking}
                      aria-label="Speak word"
                    >
                      <svg className={`h-3.5 w-3.5 ${speaking ? "animate-pulse" : ""}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        confirmDeleteId === card.id
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDeleteId === card.id) {
                          onDelete(card.id);
                          setConfirmDeleteId(null);
                        } else {
                          setConfirmDeleteId(card.id);
                        }
                      }}
                      aria-label={confirmDeleteId === card.id ? "Confirm delete" : "Delete card"}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {card.word}
                    </span>
                    <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {card.pinyin}
                    </span>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <div className="w-full space-y-2 text-center">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
