"use client";

import { pinyin } from "pinyin-pro";
import { JSONContent } from "@tiptap/react";

const zhSegmenter = new Intl.Segmenter("zh", { granularity: "word" });

function isChinese(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df)
  );
}

interface AnnotatedWord {
  word: string;
  chars: { char: string; pinyin: string }[];
}

interface AnnotatedGroup {
  type: "chinese" | "other";
  content: AnnotatedWord[] | string;
}

function getAnnotatedWords(text: string): AnnotatedGroup[] {
  if (!text) return [];

  const groups: AnnotatedGroup[] = [];
  let i = 0;

  while (i < text.length) {
    if (isChinese(text[i])) {
      // Collect contiguous Chinese characters
      let chineseRun = "";
      while (i < text.length && isChinese(text[i])) {
        chineseRun += text[i];
        i++;
      }

      // Use Intl.Segmenter to split into words, then get pinyin per character
      const segmented = [...zhSegmenter.segment(chineseRun)].map(
        (s) => s.segment
      );
      const words: AnnotatedWord[] = segmented.map((word) => {
        const wordChars = Array.from(word);
        const charPinyins = pinyin(word, {
          type: "array",
          toneType: "symbol",
        });
        return {
          word,
          chars: wordChars.map((c, idx) => ({
            char: c,
            pinyin: charPinyins[idx] || "",
          })),
        };
      });

      groups.push({ type: "chinese", content: words });
    } else {
      let nonChinese = "";
      while (i < text.length && !isChinese(text[i])) {
        nonChinese += text[i];
        i++;
      }
      groups.push({ type: "other", content: nonChinese });
    }
  }

  return groups;
}

function renderAnnotatedText(
  text: string,
  marks?: JSONContent["marks"],
  onWordClick?: (word: string, event: React.MouseEvent) => void
) {
  const groups = getAnnotatedWords(text);

  const content = groups.flatMap((group, gi) => {
    if (group.type === "other") {
      return <span key={`o-${gi}`}>{group.content as string}</span>;
    }

    return (group.content as AnnotatedWord[]).map((aw, wi) => (
      <span
        key={`w-${gi}-${wi}`}
        data-word={aw.word}
        className="cursor-pointer"
        onClick={(e) => onWordClick?.(aw.word, e)}
      >
        {aw.chars.map((c, ci) => (
          <ruby key={ci} className="mx-0.5">
            {c.char}
            <rt>{c.pinyin}</rt>
          </ruby>
        ))}
      </span>
    ));
  });

  if (!marks || marks.length === 0) return <>{content}</>;

  let wrapped: React.ReactNode = <>{content}</>;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        wrapped = <strong>{wrapped}</strong>;
        break;
      case "italic":
        wrapped = <em>{wrapped}</em>;
        break;
      case "strike":
        wrapped = <s>{wrapped}</s>;
        break;
    }
  }
  return wrapped;
}

function renderNode(
  node: JSONContent,
  index: number,
  onWordClick?: (word: string, event: React.MouseEvent) => void
): React.ReactNode {
  if (node.type === "text" && node.text) {
    return (
      <span key={index}>
        {renderAnnotatedText(node.text, node.marks, onWordClick)}
      </span>
    );
  }

  const children = node.content?.map((child, i) =>
    renderNode(child, i, onWordClick)
  );

  switch (node.type) {
    case "doc":
      return <div key={index}>{children}</div>;
    case "paragraph":
      return (
        <p key={index} className="min-h-[1em]">
          {children}
        </p>
      );
    case "heading": {
      const level = node.attrs?.level || 2;
      if (level === 1)
        return (
          <h1 key={index} className="font-bold text-[1.5em]">
            {children}
          </h1>
        );
      if (level === 3)
        return (
          <h3 key={index} className="font-bold text-[1em]">
            {children}
          </h3>
        );
      return (
        <h2 key={index} className="font-bold text-[1.25em]">
          {children}
        </h2>
      );
    }
    case "bulletList":
      return (
        <ul key={index} className="list-disc pl-6">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={index} className="list-decimal pl-6">
          {children}
        </ol>
      );
    case "listItem":
      return <li key={index}>{children}</li>;
    case "blockquote":
      return (
        <blockquote
          key={index}
          className="border-l-4 border-border-input pl-4 italic"
        >
          {children}
        </blockquote>
      );
    case "hardBreak":
      return <br key={index} />;
    default:
      return <div key={index}>{children}</div>;
  }
}

interface PinyinDisplayProps {
  doc: JSONContent | null;
  onWordClick?: (word: string, event: React.MouseEvent) => void;
}

export default function PinyinDisplay({
  doc,
  onWordClick,
}: PinyinDisplayProps) {
  if (!doc) return null;
  return (
    <div
      className="pinyin-display text-2xl leading-relaxed tracking-wide"
      style={{ lineHeight: "2.5" }}
    >
      {renderNode(doc, 0, onWordClick)}
    </div>
  );
}
