"use client";

import { useState, useRef, useCallback, type RefObject } from "react";
import { logApiCall } from "@/lib/apiUsage";
import { useSettings } from "@/contexts/SettingsContext";

interface WordDefinition {
  pinyin: string;
  definitions: Record<string, string>;
}

export function useWordDefinition(
  containerRef: RefObject<HTMLDivElement | null>
) {
  const { lang } = useSettings();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordPosition, setWordPosition] = useState({ top: 0, left: 0 });
  const [wordDefinition, setWordDefinition] = useState<WordDefinition>({
    pinyin: "",
    definitions: {},
  });
  const [definitionLoading, setDefinitionLoading] = useState(false);

  const wordCacheRef = useRef<Record<string, WordDefinition>>({});

  const handleWordClick = useCallback(
    async (word: string, event: React.MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const target = event.currentTarget as HTMLElement;
      const targetRect = target.getBoundingClientRect();

      const top = targetRect.bottom - containerRect.top + 4;
      let left = targetRect.left - containerRect.left;
      // Clamp so popup doesn't overflow right edge (popup is 288px wide)
      const maxLeft = containerRect.width - 288;
      if (left > maxLeft) left = Math.max(0, maxLeft);

      setWordPosition({ top, left });
      setSelectedWord(word);

      const langs = [lang];
      const cached = wordCacheRef.current[word];

      // Check which langs are already cached
      const missingLangs = cached
        ? langs.filter((l) => !(l in cached.definitions))
        : langs;

      if (missingLangs.length === 0 && cached) {
        setWordDefinition(cached);
        setDefinitionLoading(false);
        return;
      }

      // Show cached data immediately if available
      if (cached) {
        setWordDefinition(cached);
      } else {
        setWordDefinition({ pinyin: "", definitions: {} });
      }
      setDefinitionLoading(true);

      try {
        const res = await fetch("/api/define", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word, langs: missingLangs }),
        });
        const data = await res.json();
        logApiCall("/api/define", word.length);

        // Merge into cache
        const existing = wordCacheRef.current[word] || {
          pinyin: data.pinyin,
          definitions: {},
        };
        const merged = {
          pinyin: data.pinyin || existing.pinyin,
          definitions: { ...existing.definitions, ...data.definitions },
        };
        wordCacheRef.current[word] = merged;

        setWordDefinition(merged);
      } catch {
        // Show whatever we have cached
        if (cached) setWordDefinition(cached);
      } finally {
        setDefinitionLoading(false);
      }
    },
    [containerRef, lang]
  );

  const clearSelection = useCallback(() => setSelectedWord(null), []);

  return {
    selectedWord,
    wordPosition,
    wordDefinition,
    definitionLoading,
    handleWordClick,
    clearSelection,
  };
}
