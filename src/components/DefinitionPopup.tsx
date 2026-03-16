"use client";

import { useEffect, useRef, useState } from "react";

interface DefinitionPopupProps {
  word: string;
  pinyin: string;
  position: { top: number; left: number };
  definitions: Record<string, string>;
  loading: boolean;
  enabledLanguages: Set<string>;
  onClose: () => void;
  onAddCard: (word: string, pinyin: string, definitions: Record<string, string>) => void;
  isSaved: boolean;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  vi: "Ti\u1EBFng Vi\u1EC7t",
};

export default function DefinitionPopup({
  word,
  pinyin,
  position,
  definitions,
  loading,
  enabledLanguages,
  onClose,
  onAddCard,
  isSaved: isSavedProp,
}: DefinitionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(isSavedProp);

  // Sync when prop changes (e.g. different word selected)
  useEffect(() => {
    setSaved(isSavedProp);
  }, [isSavedProp]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const langs = Array.from(enabledLanguages);

  return (
    <div
      ref={popupRef}
      className="absolute z-30 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-600 dark:bg-gray-800"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header: word + pinyin */}
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {word}
          </span>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {pinyin}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {saved ? (
            <span className="p-1 text-green-500" aria-label="Saved">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : (
            <button
              onClick={() => {
                if (!loading) {
                  onAddCard(word, pinyin, definitions);
                  setSaved(true);
                }
              }}
              disabled={loading}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Save to flashcards"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>

      {/* Definitions */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
          Loading...
        </div>
      ) : (
        <div className="space-y-2">
          {langs.map((lang) => (
            <div key={lang}>
              <div className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {LANG_NAMES[lang] || lang}
              </div>
              <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {(definitions[lang] || "\u2014").split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {langs.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Enable a language to see definitions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
