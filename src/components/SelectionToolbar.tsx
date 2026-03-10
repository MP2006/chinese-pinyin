"use client";

import { useState, useEffect, useCallback, RefObject } from "react";
import SpeechPractice, { isSpeechRecognitionSupported } from "./SpeechPractice";
import { useTTS } from "@/hooks/useTTS";

interface SelectionToolbarProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

function extractChineseText(selection: Selection): string {
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  // Remove <rt> elements (pinyin annotations) from the cloned fragment
  fragment.querySelectorAll("rt").forEach((rt) => rt.remove());
  return fragment.textContent?.trim() || "";
}

export default function SelectionToolbar({ containerRef }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] = useState(false);
  const { speak, speaking } = useTTS();

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

      const toolbarWidth = supportsSpeechRecognition ? 62 : 28;

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
      className="absolute z-20 flex items-center gap-1 rounded-full bg-gray-900 p-0.5 shadow-lg dark:bg-gray-200"
      style={{ top: position.top, left: position.left }}
    >
      {/* Speaker button */}
      <button
        data-selection-toolbar
        className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-transform hover:scale-110 active:scale-95 dark:text-gray-900"
        onClick={() => speak(selectedText)}
        disabled={speaking}
        aria-label="Speak selected text"
      >
        {speaking ? (
          <svg className="h-3.5 w-3.5 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        )}
      </button>

      {/* Mic button (only if browser supports SpeechRecognition) */}
      {supportsSpeechRecognition && (
        <SpeechPractice
          expectedText={selectedText}
          toolbarPosition={position}
          containerRef={containerRef}
          onPlayReference={() => speak(selectedText)}
        />
      )}
    </div>
  );
}
