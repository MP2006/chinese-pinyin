"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { pinyin as getPinyin } from "pinyin-pro";
import { useTranslation } from "@/locales";
import { useFlashcards } from "@/hooks/useFlashcards";
import { useAuth } from "@/contexts/AuthContext";
import { useWordDefinition } from "@/hooks/useWordDefinition";
import { useTTS } from "@/hooks/useTTS";
import { logApiCall } from "@/lib/apiUsage";
import { SpeakerIcon } from "./Icons";
import DefinitionPopup from "./DefinitionPopup";
import type { Lang } from "@/contexts/SettingsContext";
import type {
  PracticeSession,
  PracticeMessage,
  PracticeResponse,
} from "@/types/practice";

// --- Intl.Segmenter for word-level clickable hanzi ---

const zhSegmenter = new Intl.Segmenter("zh", { granularity: "word" });

function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df)
  );
}

function ClickableHanzi({
  text,
  onWordClick,
}: {
  text: string;
  onWordClick: (word: string, event: React.MouseEvent) => void;
}) {
  const segments = [...zhSegmenter.segment(text)];

  return (
    <>
      {segments.map((seg, i) => {
        const hasChinese = Array.from(seg.segment).some(isChinese);
        if (hasChinese) {
          return (
            <span
              key={i}
              className="cursor-pointer rounded-sm transition-colors hover:bg-primary/10"
              onClick={(e) => onWordClick(seg.segment, e)}
            >
              {seg.segment}
            </span>
          );
        }
        return <span key={i}>{seg.segment}</span>;
      })}
    </>
  );
}

// --- Objective with clickable vocab words ---

function VocabWord({ word, hint }: {
  word: string;
  hint: { english: string; chinese: string; pinyin: string };
}) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setShow((p) => !p)}
        className="border-b border-dashed border-primary/50 font-medium text-text-heading transition-colors hover:text-primary"
      >
        {word}
      </button>
      {show && (
        <span className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-card px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-border">
          <span className="font-medium text-text-heading">{hint.chinese}</span>{" "}
          <span className="text-text-muted">{hint.pinyin}</span>
        </span>
      )}
    </span>
  );
}

function AnnotatedObjective({
  text,
  hints,
}: {
  text: string;
  hints: { english: string; chinese: string; pinyin: string }[];
}) {
  if (!hints.length) return <>{text}</>;

  // Build a case-insensitive regex matching all hint english words, longest first
  const sorted = [...hints].sort((a, b) => b.english.length - a.english.length);
  const pattern = sorted.map((h) => h.english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

  const hintMap = new Map(hints.map((h) => [h.english.toLowerCase(), h]));

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    const hint = hintMap.get(match[0].toLowerCase());
    if (hint) {
      parts.push(<VocabWord key={idx} word={match[0]} hint={hint} />);
    } else {
      parts.push(match[0]);
    }
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// --- Speech Recognition helper (reuses pattern from SpeechPractice) ---

function getSpeechRecognition(): SpeechRecognition | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}

// --- Props ---

interface PracticeChatProps {
  session: PracticeSession;
  lang: Lang;
  onBack: () => void;
}

export default function PracticeChat({
  session,
  lang,
  onBack,
}: PracticeChatProps) {
  const t = useTranslation();
  const { user } = useAuth();
  const { addCard, hasCard } = useFlashcards();
  const { speak, speaking } = useTTS();

  const [messages, setMessages] = useState<PracticeMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [objective, setObjective] = useState<string | null>(null);
  const [vocabHints, setVocabHints] = useState<
    { english: string; chinese: string; pinyin: string }[]
  >([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Word definition popup (reuses useWordDefinition from home page)
  const {
    selectedWord,
    wordPosition,
    wordDefinition,
    definitionLoading,
    handleWordClick,
    clearSelection,
  } = useWordDefinition(messagesAreaRef);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Send message to API and get AI response
  const sendToApi = useCallback(
    async (conversationHistory: { role: "user" | "assistant"; content: string }[], currentObjective?: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/practice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hskLevel: session.hskLevel,
            scenarioId: session.scenarioId,
            characterName: session.characterName,
            ...(currentObjective ? { objective: currentObjective } : {}),
            messages: conversationHistory,
          }),
        });

        if (res.status === 429) {
          setError(t.practice.errorRateLimit);
          return null;
        }
        if (res.status === 503) {
          setError(t.practice.errorNotConfigured);
          return null;
        }
        if (!res.ok) {
          setError(t.practice.errorResponse);
          return null;
        }

        logApiCall("/api/practice", JSON.stringify(conversationHistory).length);
        const data: PracticeResponse = await res.json();
        return data;
      } catch {
        setError(t.practice.errorResponse);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [session, t],
  );

  // Trigger initial AI greeting on mount
  useEffect(() => {
    let cancelled = false;
    async function initChat() {
      setLoading(true);
      const data = await sendToApi([]);
      if (cancelled || !data) return;

      // Capture generated objective from first response
      if (data.generatedObjective) {
        setObjective(data.generatedObjective);
      }

      // Capture vocab hints from first response
      if (data.vocabHints?.length) {
        setVocabHints(data.vocabHints);
      }

      const aiMsg: PracticeMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.hanzi,
        parsed: data,
      };
      setMessages([aiMsg]);
    }
    initChat();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle sending a user message
  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || completed) return;

      setInput("");

      const userMsg: PracticeMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Build conversation for API (only role + content)
      const history = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await sendToApi(history, objective || undefined);
      if (!data) return;

      const aiMsg: PracticeMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.hanzi,
        parsed: data,
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (data.isObjectiveMet) {
        setCompleted(true);
        setFinalFeedback(data.feedback || null);
      }
    },
    [messages, loading, completed, sendToApi, objective],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // --- Speech Recognition ---
  const startRecording = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setInput(transcript);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.lang = "zh-CN";
    recognition.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Save the last AI message's hanzi to flashcards
  const handleSaveWord = useCallback(
    (parsed: PracticeResponse) => {
      const word = parsed.hanzi;
      if (savedWords.has(word)) return;
      const wordPinyin = getPinyin(word, { toneType: "symbol" });
      addCard(word, wordPinyin, { [lang]: parsed.english });
      setSavedWords((prev) => new Set(prev).add(word));
    },
    [addCard, lang, savedWords],
  );

  // Add word from definition popup to flashcards
  const handleAddCardFromPopup = useCallback(
    (word: string, pinyinStr: string, definitions: Record<string, string>) => {
      addCard(word, pinyinStr, definitions);
    },
    [addCard],
  );

  return (
    <main className="flex min-h-screen flex-col bg-surface-page pt-14 transition-colors md:pt-0">
      {/* Header bar */}
      <div className="border-b border-border bg-surface-card px-6 py-3 md:ml-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-label"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {t.practice.back}
          </button>
          <div className="text-right">
            <p className="text-sm font-medium text-text-heading">
              {t.practice.chatWith(session.characterName)}
            </p>
            <p className="text-[11px] text-text-muted">HSK {session.hskLevel}</p>
          </div>
        </div>
      </div>

      {/* Objective banner */}
      <div className="bg-surface-subtle px-6 py-3">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            {t.practice.objective}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            {objective ? (
              <AnnotatedObjective text={objective} hints={vocabHints} />
            ) : (
              "..."
            )}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={messagesAreaRef} className="relative flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && msg.parsed ? (
                <AssistantBubble
                  parsed={msg.parsed}
                  onSpeak={() => speak(msg.parsed!.hanzi)}
                  speaking={speaking}
                  onWordClick={handleWordClick}
                />
              ) : (
                <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5">
                  <p className="text-sm text-white">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm bg-surface-card px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-center text-xs text-primary">{error}</p>
          )}

          {/* Completion card */}
          {completed && (
            <div className="rounded-xl bg-emerald-50 px-5 py-4 dark:bg-emerald-900/20">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {t.practice.objectiveComplete}
              </h3>
              {finalFeedback && (
                <p className="text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">
                  {finalFeedback}
                </p>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={onBack}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  {t.practice.newScenario}
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Definition popup (rendered at messages area level for positioning) */}
        {selectedWord && (
          <DefinitionPopup
            word={selectedWord}
            pinyin={wordDefinition.pinyin}
            position={wordPosition}
            definitions={wordDefinition.definitions}
            loading={definitionLoading}
            onClose={clearSelection}
            onAddCard={handleAddCardFromPopup}
            isSaved={hasCard(selectedWord)}
            isLoggedIn={!!user}
          />
        )}
      </div>

      {/* Input area */}
      {!completed && (
        <div className="border-t border-border bg-surface-card px-6 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.practice.typeMessage}
              disabled={loading}
              className="flex-1 rounded-xl bg-surface-subtle px-4 py-2.5 text-sm text-text-heading placeholder-text-muted outline-none transition-colors focus:bg-surface-hover disabled:opacity-50"
            />
            {/* Mic button */}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={loading}
              className={`shrink-0 rounded-xl p-2.5 transition-colors ${
                isRecording
                  ? "bg-primary text-white"
                  : "bg-surface-subtle text-text-muted hover:bg-surface-hover hover:text-text-body"
              } disabled:opacity-50`}
              aria-label={isRecording ? t.practice.listening : t.practice.holdToSpeak}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
            {/* Send button */}
            <button
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-primary p-2.5 text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
              aria-label="Send"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// --- Assistant message bubble with pinyin + hanzi + translation ---

function AssistantBubble({
  parsed,
  onSpeak,
  speaking,
  onWordClick,
}: {
  parsed: PracticeResponse;
  onSpeak: () => void;
  speaking: boolean;
  onWordClick: (word: string, event: React.MouseEvent) => void;
}) {
  const [showEnglish, setShowEnglish] = useState(false);

  return (
    <div className="group max-w-[80%] rounded-2xl rounded-tl-sm bg-surface-card px-4 py-3">
      {/* Pinyin (subtle, above hanzi) */}
      <p className="text-sm leading-relaxed text-text-muted">
        {parsed.pinyin}
      </p>
      {/* Hanzi (primary, clickable words) */}
      <p className="text-2xl leading-relaxed text-text-heading">
        <ClickableHanzi text={parsed.hanzi} onWordClick={onWordClick} />
      </p>
      {/* Actions row */}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onSpeak}
          disabled={speaking}
          className="text-text-muted transition-colors hover:text-text-body disabled:opacity-40"
          aria-label="Speak"
        >
          <SpeakerIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowEnglish((p) => !p)}
          className="text-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-body"
        >
          {showEnglish ? "hide" : "EN"}
        </button>
      </div>
      {/* Hidden English translation */}
      {showEnglish && (
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{parsed.english}</p>
      )}
    </div>
  );
}
