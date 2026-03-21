"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { JSONContent } from "@tiptap/react";
import { isSpeechRecognitionSupported } from "./SpeechPractice";
import { logApiCall } from "@/lib/apiUsage";
import { useOCR, extractChineseLines, type OCRLine } from "@/hooks/useOCR";
import { CloseIcon, CheckIcon } from "./Icons";
import {
  readClipboardImage,
  isClipboardReadSupported,
  getDroppedImage,
} from "@/lib/screenCapture";

interface EditorProps {
  onUpdate: (data: { text: string; json: JSONContent }) => void;
}

function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-text-muted hover:bg-surface-hover hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

interface OCRPreview {
  imageUrl: string;
  lines: OCRLine[];
  imgW: number;
  imgH: number;
}

export default function Editor({ onUpdate }: EditorProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<OCRPreview | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [insertedLines, setInsertedLines] = useState<Set<number>>(new Set());
  const [ocrError, setOcrError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const { recognize, status: ocrStatus } = useOCR();

  const ocrBusy = ocrStatus === "loading-engine" || ocrStatus === "recognizing";

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap min-h-[160px] px-4 py-3 text-lg text-text-heading outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate({
        text: editor.getText(),
        json: editor.getJSON(),
      });
    },
  });

  const processImage = useCallback(
    async (blob: Blob, source: string) => {
      setOcrError(null);
      setInsertedLines(new Set());
      setOcrPreview(null);

      const imageUrl = URL.createObjectURL(blob);
      setPendingImageUrl(imageUrl);

      // Get image natural dimensions
      const img = new Image();
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = imageUrl;
      });

      const rawLines = await recognize(blob);
      logApiCall(source, rawLines.length);

      if (rawLines.length === 0) {
        setOcrError("No text detected in image");
        setPendingImageUrl(null);
        URL.revokeObjectURL(imageUrl);
        return;
      }

      const lines = extractChineseLines(rawLines);
      if (lines.length === 0) {
        setOcrError("No Chinese characters found in image");
        setPendingImageUrl(null);
        URL.revokeObjectURL(imageUrl);
        return;
      }

      setPendingImageUrl(null);
      setOcrPreview({ imageUrl, lines, imgW: dims.w, imgH: dims.h });
    },
    [recognize]
  );

  const dismissPreview = useCallback(() => {
    if (ocrPreview?.imageUrl) URL.revokeObjectURL(ocrPreview.imageUrl);
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setOcrPreview(null);
    setPendingImageUrl(null);
    setInsertedLines(new Set());
    setOcrError(null);
  }, [ocrPreview?.imageUrl, pendingImageUrl]);

  const insertLine = useCallback(
    (line: string, index: number) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [{ type: "text", text: line }],
        })
        .run();
      setInsertedLines((prev) => new Set(prev).add(index));
    },
    [editor]
  );

  const insertAll = useCallback(() => {
    if (!editor || !ocrPreview) return;
    const uninserted = ocrPreview.lines.filter((_, i) => !insertedLines.has(i));
    if (uninserted.length === 0) return;
    editor
      .chain()
      .focus()
      .insertContent(
        uninserted.map((l) => ({
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: l.text }],
        }))
      )
      .run();
    setInsertedLines(new Set(ocrPreview.lines.map((_, i) => i)));
  }, [editor, ocrPreview, insertedLines]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setDragging(false);
      if (ocrBusy) return;
      const file = getDroppedImage(e.nativeEvent);
      if (file) processImage(file, "/ocr/drop");
    },
    [ocrBusy, processImage]
  );

  const handleClipboardOCR = useCallback(async () => {
    const blob = await readClipboardImage();
    if (!blob) {
      setOcrError("No image found in clipboard");
      return;
    }
    processImage(blob, "/ocr/clipboard");
  }, [processImage]);

  const startListening = useCallback(() => {
    if (!editor) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (!result.isFinal) return;
      const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;
      let transcript = result[0].transcript;
      for (let i = 0; i < result.length; i++) {
        if (CJK.test(result[i].transcript)) {
          transcript = result[i].transcript;
          break;
        }
      }
      editor.chain().focus().insertContent(transcript).run();
      logApiCall("/api/speech", transcript.length);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.lang = "zh-CN";
    recognition.start();
  }, [editor]);

  if (!editor) return null;

  const showMicButton = isSpeechRecognitionSupported();
  const showPasteButton = isClipboardReadSupported();
  const showPanel = ocrPreview || pendingImageUrl || ocrBusy || ocrError;

  return (
    <div>
      <div
        className={`overflow-hidden rounded-lg border bg-surface-card transition-colors focus-within:border-primary-text ${
          dragging
            ? "border-red-500 ring-2 ring-red-500/30 dark:border-red-400"
            : "border-border"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            S
          </ToolbarButton>

          <div className="mx-1 w-px bg-border" />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
          >
            H
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            &ldquo; Quote
          </ToolbarButton>

          {showMicButton && (
            <>
              <div className="mx-1 w-px bg-border" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  listening ? stopListening() : startListening();
                }}
                className={`flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors ${
                  listening
                    ? "bg-primary text-white"
                    : "text-text-body hover:bg-surface-hover"
                }`}
                aria-label={
                  listening ? "Stop voice input" : "Start voice input"
                }
              >
                {listening ? (
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                  </span>
                ) : (
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
                <span className="hidden sm:inline">
                  {listening ? "Stop" : "Mic"}
                </span>
              </button>
            </>
          )}

          {showPasteButton && (
            <>
              <div className="mx-1 w-px bg-border" />
              <button
                type="button"
                disabled={ocrBusy}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleClipboardOCR();
                }}
                className={`flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-colors ${
                  ocrBusy
                    ? "bg-primary text-white"
                    : "text-text-body hover:bg-surface-hover"
                } disabled:opacity-70`}
                aria-label="Paste image from clipboard for OCR"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="8" y="2" width="8" height="4" rx="1" strokeLinecap="round" />
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Paste</span>
              </button>
            </>
          )}
        </div>

        {/* Editor area with drop overlay */}
        <div className="relative">
          <EditorContent editor={editor} />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-red-50/80 dark:bg-red-900/30">
              <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-red-500 bg-white/90 px-4 py-2 text-sm font-medium text-red-700 dark:bg-gray-800/90 dark:text-red-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Drop screenshot to extract Chinese text
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OCR Preview Panel — full image with overlay highlights */}
      {showPanel && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface-card">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Screenshot OCR
              </span>
              {ocrPreview && ocrPreview.lines.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Click highlighted text to insert
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {ocrPreview && ocrPreview.lines.length > 0 && (
                <button
                  type="button"
                  onClick={insertAll}
                  disabled={insertedLines.size === ocrPreview.lines.length}
                  className="text-xs font-medium text-primary-text hover:text-red-700 disabled:opacity-40 dark:hover:text-red-300"
                >
                  Insert all
                </button>
              )}
              <button
                type="button"
                onClick={dismissPreview}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                aria-label="Dismiss"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Image with overlays */}
          <div className="p-4">
            {/* Loading state */}
            {ocrBusy && (
              <div className="flex flex-col items-center gap-3">
                {pendingImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingImageUrl}
                    alt="Processing screenshot"
                    className="w-full rounded border border-gray-200 opacity-60 dark:border-gray-600"
                  />
                )}
                <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-red-600 dark:border-gray-600 dark:border-t-red-400" />
                  {ocrStatus === "loading-engine"
                    ? "Downloading Chinese OCR data..."
                    : "Reading text from image..."}
                </div>
              </div>
            )}

            {/* Error state */}
            {ocrError && !ocrBusy && (
              <p className="py-2 text-center text-sm text-primary-text">
                {ocrError}
              </p>
            )}

            {/* Full image with clickable highlights */}
            {!ocrBusy && ocrPreview && (
              <div className="relative inline-block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ocrPreview.imageUrl}
                  alt="Screenshot with detected Chinese text"
                  className="w-full rounded border border-gray-200 dark:border-gray-600"
                />
                {/* Overlay highlights */}
                {ocrPreview.lines.map((line, i) => {
                  const { bbox } = line;
                  const { imgW, imgH } = ocrPreview;
                  const inserted = insertedLines.has(i);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !inserted && insertLine(line.text, i)}
                      disabled={inserted}
                      title={line.text}
                      className={`absolute rounded-sm transition-colors ${
                        inserted
                          ? "bg-red-500/30 ring-1 ring-red-500/60"
                          : "bg-red-500/15 hover:bg-red-500/40 ring-1 ring-transparent hover:ring-red-500/60"
                      }`}
                      style={{
                        left: `${(bbox.x0 / imgW) * 100}%`,
                        top: `${(bbox.y0 / imgH) * 100}%`,
                        width: `${((bbox.x1 - bbox.x0) / imgW) * 100}%`,
                        height: `${((bbox.y1 - bbox.y0) / imgH) * 100}%`,
                      }}
                    >
                      {inserted && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
                          <CheckIcon className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
