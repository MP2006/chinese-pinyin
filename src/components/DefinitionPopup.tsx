"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckIcon, CloseIcon } from "./Icons";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@/locales";

interface DefinitionPopupProps {
  word: string;
  pinyin: string;
  position: { top: number; left: number };
  definitions: Record<string, string>;
  loading: boolean;
  onClose: () => void;
  onAddCard: (word: string, pinyin: string, definitions: Record<string, string>) => void;
  isSaved: boolean;
  isLoggedIn: boolean;
}

// Removed LANG_NAMES — now uses t.common.langNameEn / t.common.langNameVi

export default function DefinitionPopup({
  word,
  pinyin,
  position,
  definitions,
  loading,
  onClose,
  onAddCard,
  isSaved: isSavedProp,
  isLoggedIn,
}: DefinitionPopupProps) {
  const { lang } = useSettings();
  const t = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);

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

  const langs = [lang];

  return (
    <div
      ref={popupRef}
      className="absolute z-30 w-80 rounded-lg border border-border bg-surface-card p-5 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header: word + pinyin + close */}
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-semibold text-text-heading">
            {word}
          </span>
          <span className="ml-2 text-sm text-text-secondary">
            {pinyin}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label={t.common.close}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Definitions */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-text-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
          {t.common.loading}
        </div>
      ) : (
        <div className="space-y-2">
          {langs.map((lang) => (
            <div key={lang}>
              <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
                {lang === "en" ? t.common.langNameEn : lang === "vi" ? t.common.langNameVi : lang}
              </div>
              <div className="text-sm leading-relaxed text-text-label">
                {(definitions[lang] || "\u2014").split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save to flashcards action */}
      <div className="mt-3 border-t border-border pt-3">
        {!isLoggedIn ? (
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-primary-text transition-colors hover:bg-primary-soft"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            {t.definition.signInToSave}
          </Link>
        ) : isSavedProp ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success" aria-label={t.definition.savedToFlashcards}>
            <CheckIcon className="h-4 w-4" />
            {t.definition.savedToFlashcards}
          </div>
        ) : (
          <button
            onClick={() => {
              if (!loading) {
                onAddCard(word, pinyin, definitions);
              }
            }}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
            aria-label={t.definition.saveToFlashcards}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t.definition.saveToFlashcards}
          </button>
        )}
      </div>
    </div>
  );
}
