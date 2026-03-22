"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import PinyinDisplay from "@/components/PinyinDisplay";
import SelectionToolbar from "@/components/SelectionToolbar";
import DefinitionPopup from "@/components/DefinitionPopup";
import { useFlashcards } from "@/hooks/useFlashcards";
import { CloseIcon } from "@/components/Icons";
import { useWordDefinition } from "@/hooks/useWordDefinition";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@/locales";
import { JSONContent } from "@tiptap/react";
import { logApiCall } from "@/lib/apiUsage";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

const EDITOR_STORAGE_KEY = "editor-content";

function readSavedContent(): JSONContent | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(EDITOR_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const { user } = useAuth();
  const { lang } = useSettings();
  const t = useTranslation();
  const { addCard, hasCard, syncError, clearSyncError } = useFlashcards();
  const [plainText, setPlainText] = useState("");
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null);
  const initialContentRef = useRef<JSONContent | null>(readSavedContent);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingLangs, setTranslatingLangs] = useState<Set<string>>(
    new Set()
  );

  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinyinContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedWord,
    wordPosition,
    wordDefinition,
    definitionLoading,
    handleWordClick,
    clearSelection,
  } = useWordDefinition(pinyinContainerRef);

  const fetchTranslation = useCallback(
    async (text: string, lang: string) => {
      if (!text.trim()) {
        setTranslations((prev) => {
          const next = { ...prev };
          delete next[lang];
          return next;
        });
        setTranslatingLangs((prev) => {
          const next = new Set(prev);
          next.delete(lang);
          return next;
        });
        return;
      }

      if (abortControllersRef.current[lang]) {
        abortControllersRef.current[lang].abort();
      }

      const controller = new AbortController();
      abortControllersRef.current[lang] = controller;
      setTranslatingLangs((prev) => new Set(prev).add(lang));

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, targetLang: lang }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!controller.signal.aborted) {
          logApiCall("/api/translate", text.length);
          setTranslations((prev) => ({
            ...prev,
            [lang]: data.translation || "",
          }));
          setTranslatingLangs((prev) => {
            const next = new Set(prev);
            next.delete(lang);
            return next;
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setTranslations((prev) => ({
            ...prev,
            [lang]: t.home.translationUnavailable,
          }));
          setTranslatingLangs((prev) => {
            const next = new Set(prev);
            next.delete(lang);
            return next;
          });
        }
      }
    },
    []
  );

  // Debounced translation fetch for the selected language
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!plainText.trim()) {
      // Abort any in-flight translation requests to prevent stale responses
      Object.values(abortControllersRef.current).forEach((c) => c.abort());
      abortControllersRef.current = {};
      setTranslations({});
      setTranslatingLangs(new Set());
      return;
    }

    setTranslatingLangs(new Set([lang]));

    debounceRef.current = setTimeout(() => {
      fetchTranslation(plainText, lang);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [plainText, lang, fetchTranslation]);

  const hasContent = plainText.trim().length > 0;

  return (
    <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {syncError && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-primary-soft px-4 py-3 text-sm text-primary-text dark:border-red-800">
            <span>{syncError}</span>
            <button onClick={clearSyncError} className="ml-3 shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300" aria-label={t.common.dismissError}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-text-heading">
            {t.home.title}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t.home.subtitle}
          </p>
        </div>

        {/* Editor */}
        <Editor
          initialContent={initialContentRef.current ?? undefined}
          onUpdate={({ text, json }) => {
            setPlainText(text);
            setEditorJson(json);
            try {
              sessionStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(json));
            } catch {}
          }}
        />

        {/* Results */}
        {hasContent && (
          <div className="mt-8">
            {/* Pinyin display with TTS and definition popup */}
            <div
              ref={pinyinContainerRef}
              className="relative rounded-lg bg-surface-subtle p-6"
            >
              <PinyinDisplay
                doc={editorJson}
                onWordClick={handleWordClick}
              />
              <SelectionToolbar containerRef={pinyinContainerRef} />
              {selectedWord && (
                <DefinitionPopup
                  word={selectedWord}
                  pinyin={wordDefinition.pinyin}
                  position={wordPosition}
                  definitions={wordDefinition.definitions}
                  loading={definitionLoading}
                  onClose={clearSelection}
                  onAddCard={addCard}
                  isSaved={hasCard(selectedWord)}
                  isLoggedIn={!!user}
                />
              )}
            </div>

            {/* Translation */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-text-muted">{t.home.translation}</h3>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-surface-card p-6">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
                {t.common.langName}
              </div>
              {translatingLangs.has(lang) ? (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-red-600 dark:border-gray-600 dark:border-t-red-400" />
                  {t.home.translating}
                </div>
              ) : translations[lang] ? (
                <p className="whitespace-pre-line text-lg leading-relaxed text-text-label">
                  {translations[lang]}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
