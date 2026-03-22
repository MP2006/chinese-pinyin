// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import FlashcardMatch from "../FlashcardMatch";
import type { Flashcard } from "@/lib/flashcardStore";

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, "location", {
  value: { ...window.location, reload: mockReload },
  writable: true,
});

const cards: Flashcard[] = [
  {
    id: "1",
    word: "你好",
    pinyin: "nǐ hǎo",
    definitions: { en: "hello" },
    createdAt: "2024-06-15T00:00:00Z",
    nextReview: "2024-06-15",
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
  {
    id: "2",
    word: "世界",
    pinyin: "shì jiè",
    definitions: { en: "world" },
    createdAt: "2024-06-15T00:00:00Z",
    nextReview: "2024-06-15",
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
  {
    id: "3",
    word: "学习",
    pinyin: "xué xí",
    definitions: { en: "to study" },
    createdAt: "2024-06-15T00:00:00Z",
    nextReview: "2024-06-15",
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
];

describe("FlashcardMatch", () => {
  beforeEach(() => {
    mockReload.mockClear();
  });

  it("renders word and definition tiles for each card", () => {
    render(<FlashcardMatch cards={cards} />);

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("世界")).toBeInTheDocument();
    expect(screen.getByText("学习")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText("to study")).toBeInTheDocument();
  });

  it("selecting a tile highlights it", () => {
    render(<FlashcardMatch cards={cards} />);

    const wordTile = screen.getByText("你好").closest("button")!;
    fireEvent.click(wordTile);

    expect(wordTile.className).toContain("border-primary");
  });

  it("clicking same tile deselects it", () => {
    render(<FlashcardMatch cards={cards} />);

    const wordTile = screen.getByText("你好").closest("button")!;
    fireEvent.click(wordTile);
    expect(wordTile.className).toContain("border-primary");

    fireEvent.click(wordTile);
    expect(wordTile.className).not.toContain("border-primary");
  });

  it("correct match applies matched styling", () => {
    render(<FlashcardMatch cards={cards} />);

    const wordTile = screen.getByText("你好").closest("button")!;
    const defTile = screen.getByText("hello").closest("button")!;

    fireEvent.click(wordTile);
    fireEvent.click(defTile);

    expect(wordTile).toBeDisabled();
    expect(defTile).toBeDisabled();
    expect(wordTile.className).toContain("border-green-300");
    expect(defTile.className).toContain("border-green-300");
  });

  it("incorrect match triggers shake animation", () => {
    render(<FlashcardMatch cards={cards} />);

    const wordTile = screen.getByText("你好").closest("button")!;
    const wrongDef = screen.getByText("world").closest("button")!;

    fireEvent.click(wordTile);
    fireEvent.click(wrongDef);

    expect(wordTile.className).toContain("animate-shake");
    expect(wrongDef.className).toContain("animate-shake");
  });

  it("cannot click during shake (blocked for 500ms)", () => {
    vi.useFakeTimers();

    render(<FlashcardMatch cards={cards} />);

    // Create a mismatch to trigger shake
    const wordTile1 = screen.getByText("你好").closest("button")!;
    const wrongDef = screen.getByText("world").closest("button")!;

    fireEvent.click(wordTile1);
    fireEvent.click(wrongDef);

    // During shake, clicking should be ignored
    const anotherTile = screen.getByText("学习").closest("button")!;
    fireEvent.click(anotherTile);
    expect(anotherTile.className).not.toContain("border-primary");

    // After 500ms shake ends
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now clicking should work
    fireEvent.click(anotherTile);
    expect(anotherTile.className).toContain("border-primary");

    vi.useRealTimers();
  });

  it("timer increments every second", () => {
    vi.useFakeTimers();

    render(<FlashcardMatch cards={cards} />);

    expect(screen.getByText("0:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("0:03")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("game complete when all matched", () => {
    render(<FlashcardMatch cards={cards} />);

    // Match all three pairs using fireEvent (no timer interaction)
    fireEvent.click(screen.getByText("你好").closest("button")!);
    fireEvent.click(screen.getByText("hello").closest("button")!);

    fireEvent.click(screen.getByText("世界").closest("button")!);
    fireEvent.click(screen.getByText("world").closest("button")!);

    fireEvent.click(screen.getByText("学习").closest("button")!);
    fireEvent.click(screen.getByText("to study").closest("button")!);

    expect(screen.getByText("All matched!")).toBeInTheDocument();
  });

  it("timer stops on completion", () => {
    vi.useFakeTimers();

    render(<FlashcardMatch cards={cards} />);

    // Let 5 seconds pass
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Match all
    fireEvent.click(screen.getByText("你好").closest("button")!);
    fireEvent.click(screen.getByText("hello").closest("button")!);
    fireEvent.click(screen.getByText("世界").closest("button")!);
    fireEvent.click(screen.getByText("world").closest("button")!);
    fireEvent.click(screen.getByText("学习").closest("button")!);
    fireEvent.click(screen.getByText("to study").closest("button")!);

    const timeAtCompletion = screen.getByText(/Time:/).textContent;

    // Advance more time — timer should NOT change
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText(/Time:/).textContent).toBe(timeAtCompletion);

    vi.useRealTimers();
  });

  it("Play Again resets game state", () => {
    render(<FlashcardMatch cards={cards} />);

    // Match all
    fireEvent.click(screen.getByText("你好").closest("button")!);
    fireEvent.click(screen.getByText("hello").closest("button")!);
    fireEvent.click(screen.getByText("世界").closest("button")!);
    fireEvent.click(screen.getByText("world").closest("button")!);
    fireEvent.click(screen.getByText("学习").closest("button")!);
    fireEvent.click(screen.getByText("to study").closest("button")!);

    fireEvent.click(screen.getByText("Play Again"));

    // Should show timer again (game reset, not reload)
    expect(screen.queryByText("All matched!")).not.toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });
});
