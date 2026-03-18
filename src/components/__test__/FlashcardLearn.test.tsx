// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "@testing-library/react";
import FlashcardLearn from "../FlashcardLearn";
import type { Flashcard } from "@/lib/flashcardStore";

const mockSpeak = vi.fn();
vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({ speak: mockSpeak, speaking: false }),
}));

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
];

/** Get which card is currently displayed and return correct/wrong words */
function getCurrentCard() {
  const isFirstCard = !!screen.queryByText("nǐ hǎo");
  return {
    correctWord: isFirstCard ? "你好" : "世界",
    wrongWord: "错误",
  };
}

/** Type text into the input field using fireEvent */
function typeInInput(text: string) {
  const input = screen.getByPlaceholderText("Type the Chinese word...");
  fireEvent.change(input, { target: { value: text } });
}

/** Submit via Check button click */
function clickCheck() {
  fireEvent.click(screen.getByText("Check"));
}

/** Press Enter in the input */
function pressEnter() {
  const input = screen.getByPlaceholderText("Type the Chinese word...");
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("FlashcardLearn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSpeak.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders question with pinyin and definition", () => {
    render(<FlashcardLearn cards={cards} />);

    const hasPinyin =
      screen.queryByText("nǐ hǎo") || screen.queryByText("shì jiè");
    expect(hasPinyin).toBeInTheDocument();

    const hasDef =
      screen.queryByText("hello") || screen.queryByText("world");
    expect(hasDef).toBeInTheDocument();
  });

  it("correct answer shows green feedback and calls speak()", () => {
    render(<FlashcardLearn cards={cards} />);
    const { correctWord } = getCurrentCard();

    typeInInput(correctWord);
    clickCheck();

    const input = screen.getByPlaceholderText("Type the Chinese word...");
    expect(input.className).toContain("border-green-400");
    expect(mockSpeak).toHaveBeenCalledWith(correctWord);
  });

  it("incorrect answer shows red feedback and reveals correct answer", () => {
    render(<FlashcardLearn cards={cards} />);
    const { correctWord } = getCurrentCard();

    typeInInput("错误");
    clickCheck();

    const input = screen.getByPlaceholderText("Type the Chinese word...");
    expect(input.className).toContain("border-red-400");
    expect(screen.getByText(correctWord)).toBeInTheDocument();
    expect(screen.getByText("Correct answer:")).toBeInTheDocument();
  });

  it("Enter key submits answer", () => {
    render(<FlashcardLearn cards={cards} />);
    const { correctWord } = getCurrentCard();

    typeInInput(correctWord);
    pressEnter();

    expect(mockSpeak).toHaveBeenCalledWith(correctWord);
  });

  it("Enter key advances after incorrect answer", () => {
    render(<FlashcardLearn cards={cards} />);

    typeInInput("错误");
    clickCheck();

    expect(screen.getByText("Continue")).toBeInTheDocument();

    // Press Enter to advance
    pressEnter();

    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
  });

  it("auto-advance after 1s on correct answer", () => {
    render(<FlashcardLearn cards={cards} />);
    const { correctWord } = getCurrentCard();

    typeInInput(correctWord);
    clickCheck();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
  });

  it("session complete shows stats", () => {
    render(<FlashcardLearn cards={cards} />);
    const { correctWord: word1 } = getCurrentCard();

    // Answer first card correctly
    typeInInput(word1);
    clickCheck();

    // Auto-advance
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Answer second card incorrectly
    typeInInput("错误");
    clickCheck();
    fireEvent.click(screen.getByText("Continue"));

    expect(screen.getByText("Session complete!")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 correct")).toBeInTheDocument();
  });

  it("retry missed resets to start", () => {
    render(<FlashcardLearn cards={cards} />);

    // Answer both wrong
    typeInInput("错");
    clickCheck();
    fireEvent.click(screen.getByText("Continue"));

    typeInInput("错");
    clickCheck();
    fireEvent.click(screen.getByText("Continue"));

    expect(screen.getByText("Session complete!")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Retry missed/));

    expect(
      screen.getByPlaceholderText("Type the Chinese word...")
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
  });

  it("progress indicator updates", () => {
    render(<FlashcardLearn cards={cards} />);

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("0 correct")).toBeInTheDocument();

    const { correctWord } = getCurrentCard();
    typeInInput(correctWord);
    clickCheck();

    expect(screen.getByText("1 correct")).toBeInTheDocument();
  });

  it("check button disabled when input empty", () => {
    render(<FlashcardLearn cards={cards} />);

    const checkButton = screen.getByText("Check");
    expect(checkButton).toBeDisabled();
  });
});
