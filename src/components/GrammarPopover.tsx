"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";
import { useTranslation } from "@/locales";
import type { GrammarAnalysis } from "@/types/grammar";

const ROLE_COLORS: Record<string, string> = {
  Subject: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Verb: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Object: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Adverb: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Particle: "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300",
  Preposition: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Complement: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Measure Word": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Adjective: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Conjunction: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
};

function getRoleColor(role: string): string {
  if (ROLE_COLORS[role]) return ROLE_COLORS[role];
  // Try case-insensitive match
  const key = Object.keys(ROLE_COLORS).find(
    (k) => k.toLowerCase() === role.toLowerCase()
  );
  if (key) return ROLE_COLORS[key];
  return "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300";
}

interface GrammarPopoverProps {
  analysis: GrammarAnalysis | null;
  loading: boolean;
  error: string | null;
  position: { top: number; left: number };
  onClose: () => void;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className || ""}`}
    />
  );
}

export default function GrammarPopover({
  analysis,
  loading,
  error,
  position,
  onClose,
}: GrammarPopoverProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const t = useTranslation();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-selection-toolbar]")
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

  return (
    <div
      ref={popupRef}
      className="absolute z-40 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-card p-5 shadow-xl"
      style={{ top: position.top, left: position.left }}
      data-grammar-popover
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-heading">
          {t.grammar.title}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          aria-label={t.common.close}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <p className="text-sm text-primary">{error}</p>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="space-y-3">
          <div>
            <Skeleton className="mb-1 h-3 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div>
            <Skeleton className="mb-1 h-3 w-14" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div>
            <Skeleton className="mb-2 h-3 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-5/6 rounded-md" />
            </div>
          </div>
          <div>
            <Skeleton className="mb-1 h-3 w-12" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      )}

      {/* Analysis result */}
      {analysis && !loading && !error && (
        <div className="space-y-3">
          {/* Translation */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {t.grammar.translation}
            </div>
            <p className="text-sm leading-relaxed text-text-label">
              {analysis.translation}
            </p>
          </div>

          {/* Pattern */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {t.grammar.pattern}
            </div>
            <p className="text-sm font-medium text-text-heading">
              {analysis.pattern}
            </p>
          </div>

          {/* Chunks */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              {t.grammar.chunks}
            </div>
            <div className="space-y-1.5">
              {analysis.chunks.map((chunk, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-subtle px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-semibold text-text-heading">
                        {chunk.chunk}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {chunk.pinyin}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {chunk.meaning || "\u2014"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getRoleColor(chunk.role)}`}
                  >
                    {chunk.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Correction (only when incorrect) */}
          {!analysis.isCorrect && analysis.correction && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-900/20">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {t.grammar.correction}
              </div>
              {analysis.correctionPinyin && (
                <p className="mb-1 text-sm text-amber-500/70">
                  {analysis.correctionPinyin}
                </p>
              )}
              <p className="mb-3 text-lg font-medium text-amber-900 dark:text-amber-200">
                {analysis.correction}
              </p>
              {analysis.feedback && (
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  {analysis.feedback}
                </p>
              )}
            </div>
          )}

          {/* Note */}
          {analysis.note && (
            <div className="rounded-md border border-border/50 bg-surface-subtle px-3 py-2">
              <div className="mb-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                {t.grammar.note}
              </div>
              <p className="text-xs leading-relaxed text-text-secondary">
                {analysis.note}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
