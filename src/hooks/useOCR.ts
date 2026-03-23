"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type OCRStatus = "idle" | "recognizing" | "error";

export interface OCRBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRLine {
  text: string;
  bbox: OCRBBox;
}

const CJK_RUN =
  /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef\u3000-\u303f，。！？：；""''（）、]+/g;
const CJK_IDEOGRAPH = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/** Extract only lines containing Chinese characters, with their bounding boxes. */
export function extractChineseLines(
  rawLines: Array<{ text: string; bbox: OCRBBox }>
): OCRLine[] {
  const seen = new Set<string>();
  const result: OCRLine[] = [];

  for (const line of rawLines) {
    const matches = line.text.match(CJK_RUN);
    if (!matches) continue;
    const chinese = matches.join("");

    // Require at least 1 actual ideograph (not just punctuation)
    const ideographs = chinese.match(CJK_IDEOGRAPH);
    if (!ideographs || ideographs.length < 1) continue;

    if (seen.has(chinese)) continue;
    seen.add(chinese);
    result.push({ text: chinese, bbox: line.bbox });
  }

  return result;
}

export function useOCR() {
  const [status, setStatus] = useState<OCRStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const recognize = useCallback(
    async (
      imageSource: Blob
    ): Promise<Array<{ text: string; bbox: OCRBBox }>> => {
      setError(null);
      if (mountedRef.current) setStatus("recognizing");

      try {
        const formData = new FormData();
        formData.append("image", imageSource);

        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `OCR failed: ${res.status}`);
        }

        const data = await res.json();
        if (mountedRef.current) setStatus("idle");
        return data.lines || [];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "OCR recognition failed";
        if (mountedRef.current) {
          setStatus("error");
          setError(message);
        }
        return [];
      }
    },
    []
  );

  return { recognize, status, error };
}
