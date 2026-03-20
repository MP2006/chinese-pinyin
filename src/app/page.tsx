"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import PinyinDisplay from "@/components/PinyinDisplay";
import SelectionToolbar from "@/components/SelectionToolbar";
import DefinitionPopup from "@/components/DefinitionPopup";
import { useFlashcards } from "@/hooks/useFlashcards";
import { useWordDefinition } from "@/hooks/useWordDefinition";
import { JSONContent } from "@tiptap/react";
import { logApiCall } from "@/lib/apiUsage";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

type Lang = "en" | "vi";
const LANG_LABELS: Record<Lang, string> = { en: "EN", vi: "VI" };

export default function Home() {
  const { addCard, hasCard } = useFlashcards();
  const [plainText, setPlainText] = useState("");
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [enabledLanguages, setEnabledLanguages] = useState<Set<Lang>>(
    () => new Set(["en"])
  );
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
  } = useWordDefinition(pinyinContainerRef, enabledLanguages);

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
            [lang]: "Translation unavailable",
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

  // Debounced translation fetch for all enabled languages
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!plainText.trim()) {
      setTranslations({});
      setTranslatingLangs(new Set());
      return;
    }

    // Mark all enabled languages as translating
    setTranslatingLangs(new Set(enabledLanguages));

    debounceRef.current = setTimeout(() => {
      enabledLanguages.forEach((lang) => {
        fetchTranslation(plainText, lang);
      });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [plainText, enabledLanguages, fetchTranslation]);

  const toggleLanguage = (lang: Lang) => {
    setEnabledLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
        // Clear translation for this language
        setTranslations((t) => {
          const updated = { ...t };
          delete updated[lang];
          return updated;
        });
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const hasContent = plainText.trim().length > 0;
  const showTranslations = enabledLanguages.size > 0 && hasContent;

  return (
    <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Hànzì Helper
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Type Chinese characters to see pinyin and translation
          </p>
        </div>

        {/* Editor */}
        <Editor
          onUpdate={({ text, json }) => {
            setPlainText(text);
            setEditorJson(json);
          }}
        />

        {/* Results */}
        {hasContent && (
          <div className="mt-6">
            {/* Language toggle pills */}
            <div className="mb-4 flex items-center justify-end gap-2">
              {(Object.keys(LANG_LABELS) as Lang[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    enabledLanguages.has(lang)
                      ? "bg-teal-600 text-white dark:bg-teal-500 dark:text-white"
                      : "border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>

            {/* Pinyin display with TTS and definition popup */}
            <div
              ref={pinyinContainerRef}
              className="relative rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
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
                  enabledLanguages={enabledLanguages}
                  onClose={clearSelection}
                  onAddCard={addCard}
                  isSaved={hasCard(selectedWord)}
                />
              )}
            </div>

            {/* Translations */}
            {showTranslations &&
              Array.from(enabledLanguages).map((lang) => (
                <div
                  key={lang}
                  className="mt-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {lang === "en" ? "English" : "Tiếng Việt"}
                  </div>
                  {translatingLangs.has(lang) ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600 dark:border-gray-600 dark:border-t-teal-400" />
                      Translating...
                    </div>
                  ) : translations[lang] ? (
                    <p className="whitespace-pre-line text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                      {translations[lang]}
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
