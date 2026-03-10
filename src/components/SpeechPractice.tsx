"use client";

import { useState, useEffect, useRef, useCallback, RefObject } from "react";
import { compareChineseText, type CompareResult } from "@/lib/compareText";

type RecordingState = "idle" | "listening" | "results";

interface SpeechPracticeProps {
  expectedText: string;
  toolbarPosition: { top: number; left: number };
  containerRef: RefObject<HTMLDivElement | null>;
  onPlayReference: () => void;
}

function getSpeechRecognition(): SpeechRecognition | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  // Set lang first, before any other properties
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  return recognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export default function SpeechPractice({
  expectedText,
  toolbarPosition,
  containerRef,
  onPlayReference,
}: SpeechPracticeProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [recognizedText, setRecognizedText] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setResult(null);
    setRecognizedText("");

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setState("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (!result.isFinal) return;

      // Pick the best alternative that contains Chinese characters
      const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
      let transcript = result[0].transcript;
      for (let i = 0; i < result.length; i++) {
        if (CJK.test(result[i].transcript)) {
          transcript = result[i].transcript;
          break;
        }
      }

      setRecognizedText(transcript);
      const compareResult = compareChineseText(expectedText, transcript);
      setResult(compareResult);
      setState("results");
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setError("No speech detected. Try again.");
      } else if (event.error === "not-allowed") {
        setError("Microphone access denied.");
      } else {
        setError("Recognition failed. Try again.");
      }
      setState("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Only reset to idle if we didn't get results
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    // Re-set lang right before start to work around browser bugs
    recognition.lang = "zh-CN";
    recognition.start();
  }, [expectedText]);

  const handleTryAgain = useCallback(() => {
    setState("idle");
    setResult(null);
    setRecognizedText("");
    setError(null);
    startListening();
  }, [startListening]);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stopRecognition();
        setState("idle");
        setResult(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  // Close results popup on outside click
  useEffect(() => {
    if (state !== "results") return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-selection-toolbar]") ||
        popupRef.current?.contains(target)
      ) {
        return;
      }
      setState("idle");
      setResult(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state]);

  const scoreColor =
    result && result.accuracy >= 90
      ? "text-green-600 dark:text-green-400"
      : result && result.accuracy >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  // Calculate popup position (below the toolbar)
  const popupStyle = {
    top: toolbarPosition.top + 40,
    left: toolbarPosition.left - 100,
  };

  return (
    <>
      {/* Mic button rendered by SelectionToolbar, this component handles state + popup */}
      <button
        data-selection-toolbar
        onClick={state === "listening" ? stopRecognition : startListening}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
          state === "listening"
            ? "bg-red-600 text-white dark:bg-red-500"
            : "bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900"
        }`}
        aria-label={state === "listening" ? "Stop recording" : "Practice pronunciation"}
      >
        {state === "listening" ? (
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 dark:bg-white" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white dark:bg-white" />
          </span>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Error toast */}
      {error && state === "idle" && (
        <div
          className="absolute z-40 w-56 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg dark:border-red-800 dark:bg-red-900/50 dark:text-red-300"
          style={popupStyle}
        >
          {error}
        </div>
      )}

      {/* Results popup */}
      {state === "results" && result && (
        <div
          ref={popupRef}
          className="absolute z-40 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-600 dark:bg-gray-800"
          style={popupStyle}
        >
          {/* Score */}
          <div className="mb-3 text-center">
            <span className={`text-3xl font-bold ${scoreColor}`}>
              {result.accuracy}%
            </span>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Accuracy
            </div>
          </div>

          {/* Character diff */}
          <div className="mb-3 flex flex-wrap gap-0.5 rounded-md bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
            {result.chars.map((ch, i) => {
              let className = "";
              let display = "";
              if (ch.status === "correct") {
                className = "text-green-600 dark:text-green-400";
                display = ch.expected;
              } else if (ch.status === "wrong") {
                className = "text-red-600 underline decoration-red-400 dark:text-red-400";
                display = ch.expected;
              } else if (ch.status === "missing") {
                className = "text-red-400 opacity-50 line-through dark:text-red-500";
                display = ch.expected;
              } else {
                // extra
                className = "text-orange-500 dark:text-orange-400";
                display = ch.actual;
              }
              return (
                <span key={i} className={`text-lg font-medium ${className}`}>
                  {display}
                </span>
              );
            })}
          </div>

          {/* Recognized text */}
          <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">You said:</span>{" "}
            <span className="text-gray-700 dark:text-gray-300">
              {recognizedText || "(nothing detected)"}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleTryAgain}
              className="flex-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
            >
              Try Again
            </button>
            <button
              onClick={onPlayReference}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Hear Reference
            </button>
          </div>
        </div>
      )}
    </>
  );
}
