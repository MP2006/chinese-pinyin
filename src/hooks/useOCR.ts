"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type OCRStatus = "idle" | "loading-engine" | "recognizing" | "error";

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

let workerInstance: import("tesseract.js").Worker | null = null;
let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (workerInstance) return workerInstance;
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("chi_sim");
    workerInstance = worker;
    return worker;
  })();

  return workerPromise;
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

    // Require at least 2 actual ideographs (not just punctuation)
    const ideographs = chinese.match(CJK_IDEOGRAPH);
    if (!ideographs || ideographs.length < 2) continue;

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

      try {
        const needsInit = !workerInstance;
        if (needsInit && mountedRef.current) setStatus("loading-engine");

        const worker = await getWorker();
        if (mountedRef.current) setStatus("recognizing");

        const { data } = await worker.recognize(imageSource, {}, { blocks: true });

        if (mountedRef.current) setStatus("idle");

        // Flatten blocks → paragraphs → lines
        const lines: Array<{ text: string; bbox: OCRBBox }> = [];
        if (data.blocks) {
          for (const block of data.blocks) {
            for (const para of block.paragraphs) {
              for (const line of para.lines) {
                lines.push({ text: line.text, bbox: line.bbox });
              }
            }
          }
        }
        return lines;
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
