"use client";

import { useState, useEffect, useCallback, RefObject } from "react";
import SpeechPractice, { isSpeechRecognitionSupported } from "./SpeechPractice";
import { useTTS } from "@/hooks/useTTS";
import { useTranslation } from "@/locales";
import { SpeakerIcon, SpeakerWaveIcon } from "./Icons";

interface SelectionToolbarProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onGrammar?: (text: string, position: { top: number; left: number }) => void;
}

function extractChineseText(selection: Selection): string {
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  // Remove <rt> elements (pinyin annotations) from the cloned fragment
  fragment.querySelectorAll("rt").forEach((rt) => rt.remove());
  return fragment.textContent?.trim() || "";
}

export default function SelectionToolbar({ containerRef, onGrammar }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] = useState(false);
  const { speak, speaking } = useTTS();
  const t = useTranslation();

  useEffect(() => {
    setSupportsSpeechRecognition(isSpeechRecognitionSupported());
  }, []);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = extractChineseText(selection);
      if (!text) {
        setVisible(false);
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();

      const hasGrammar = text.length > 1 && !!onGrammar;
      const buttonCount = 1 + (supportsSpeechRecognition ? 1 : 0) + (hasGrammar ? 1 : 0);
      const toolbarWidth = buttonCount * 100;

      setSelectedText(text);
      setPosition({
        top: rangeRect.top - containerRect.top - 36,
        left:
          rangeRect.left -
          containerRect.left +
          rangeRect.width / 2 -
          toolbarWidth / 2,
      });
      setVisible(true);
    }, 10);
  }, [containerRef, supportsSpeechRecognition]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-selection-toolbar]")) {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef, handleMouseUp, handleMouseDown]);

  if (!visible) return null;

  return (
    <div
      data-selection-toolbar
      className="absolute z-20 flex items-center gap-1 rounded-lg bg-gray-900 px-1 py-1 shadow-lg dark:bg-gray-200"
      style={{ top: position.top, left: position.left }}
    >
      {/* Listen button */}
      <button
        data-selection-toolbar
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50 dark:text-gray-900 dark:hover:bg-gray-300 dark:active:bg-gray-400"
        onClick={() => speak(selectedText)}
        disabled={speaking}
        aria-label={t.selection.speakSelected}
      >
        {speaking ? (
          <SpeakerWaveIcon className="h-3.5 w-3.5 animate-pulse" />
        ) : (
          <SpeakerIcon className="h-3.5 w-3.5" />
        )}
        {t.selection.listen}
      </button>

      {/* Practice button (only if browser supports SpeechRecognition) */}
      {supportsSpeechRecognition && (
        <SpeechPractice
          expectedText={selectedText}
          toolbarPosition={position}
          containerRef={containerRef}
          onPlayReference={() => speak(selectedText)}
        />
      )}

      {/* Grammar button (only for multi-character selections) */}
      {selectedText.length > 1 && onGrammar && (
        <button
          data-selection-toolbar
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 active:bg-gray-600 dark:text-gray-900 dark:hover:bg-gray-300 dark:active:bg-gray-400"
          onClick={() => {
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (!containerRect) return;
            onGrammar(selectedText, {
              top: position.top + 44,
              left: Math.max(0, position.left),
            });
            setVisible(false);
          }}
          aria-label={t.selection.analyzeGrammar}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          {t.selection.grammar}
        </button>
      )}
    </div>
  );
}
