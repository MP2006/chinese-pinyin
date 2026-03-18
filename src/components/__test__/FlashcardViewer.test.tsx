// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlashcardViewer from "../FlashcardViewer";
import type { Flashcard } from "@/lib/flashcardStore";

// Mock useTTS — capture the speak fn so we can assert on it
const mockSpeak = vi.fn();
vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({ speak: mockSpeak, speaking: false }),
}));

const card: Flashcard = {
  id: "card-1",
  word: "你好",
  pinyin: "nǐ hǎo",
  definitions: { en: "hello" },
  createdAt: "2024-06-15T00:00:00Z",
  nextReview: "2024-06-15",
  interval: 0,
  easeFactor: 2.5,
  reviewCount: 0,
};

describe("FlashcardViewer", () => {
  let onReview: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onReview = vi.fn();
    mockSpeak.mockClear();
  });

  it("shows the word on the front and back faces", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);
    // Both front and back render the word (CSS 3D flip)
    expect(screen.getAllByText("你好").length).toBeGreaterThanOrEqual(2);
  });

  it("shows hint text on the front face", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);
    expect(screen.getByText("Click or press Space to reveal")).toBeInTheDocument();
  });

  it("does not show review buttons before flip", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);
    expect(screen.queryByRole("button", { name: /Again/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Good/ })).not.toBeInTheDocument();
  });

  it("click flips card and shows review buttons", async () => {
    const user = userEvent.setup();
    render(<FlashcardViewer card={card} onReview={onReview} />);

    // Click the outermost card wrapper (has cursor-pointer and onClick)
    const cardWrapper = screen.getByText("Click or press Space to reveal")
      .closest(".w-full.max-w-md")!;
    await user.click(cardWrapper);

    // Review buttons should appear (button text includes rating key like "(3)")
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hard/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Good/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Easy/ })).toBeInTheDocument();
  });

  it("review button calls onReview with correct rating", async () => {
    const user = userEvent.setup();
    render(<FlashcardViewer card={card} onReview={onReview} />);

    // Flip first
    const cardWrapper = screen.getByText("Click or press Space to reveal")
      .closest(".w-full.max-w-md")!;
    await user.click(cardWrapper);

    // Click "Good" rating button
    await user.click(screen.getByRole("button", { name: /Good/ }));

    expect(onReview).toHaveBeenCalledWith("card-1", "good");
  });

  it("resets to front when card prop changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FlashcardViewer card={card} onReview={onReview} />
    );

    // Flip the card
    const cardWrapper = screen.getByText("Click or press Space to reveal")
      .closest(".w-full.max-w-md")!;
    await user.click(cardWrapper);

    // Verify flipped (review buttons visible)
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();

    // Change the card
    const newCard = { ...card, id: "card-2", word: "世界" };
    rerender(<FlashcardViewer card={newCard} onReview={onReview} />);

    // Should be back to front — no review buttons
    expect(screen.queryByRole("button", { name: /Again/ })).not.toBeInTheDocument();
  });

  it("Space key flips the card", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);

    fireEvent.keyDown(window, { key: " " });

    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
  });

  it("number keys trigger review after flip", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);

    // Flip first
    fireEvent.keyDown(window, { key: " " });

    // Press "3" for Good
    fireEvent.keyDown(window, { key: "3" });

    expect(onReview).toHaveBeenCalledWith("card-1", "good");
  });

  it("renders pinyin and definitions on the back face", () => {
    render(<FlashcardViewer card={card} onReview={onReview} />);

    // Back face always in DOM (CSS 3D flip). Pinyin is on back only.
    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    // Definition text on back
    expect(screen.getByText("hello")).toBeInTheDocument();
    // Language label
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("renders multiple language definitions on back face", () => {
    const multiLangCard = {
      ...card,
      definitions: { en: "hello", vi: "xin chào" },
    };
    render(<FlashcardViewer card={multiLangCard} onReview={onReview} />);

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("xin chào")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("speaker button calls speak with the word", async () => {
    const user = userEvent.setup();
    render(<FlashcardViewer card={card} onReview={onReview} />);

    // There are 2 speaker buttons (front + back), click the first one
    const speakerButtons = screen.getAllByLabelText("Speak word");
    expect(speakerButtons.length).toBe(2);
    await user.click(speakerButtons[0]);

    expect(mockSpeak).toHaveBeenCalledWith("你好");
  });

  it("does not flip when already flipped and clicked again", async () => {
    const user = userEvent.setup();
    render(<FlashcardViewer card={card} onReview={onReview} />);

    const cardWrapper = screen.getByText("Click or press Space to reveal")
      .closest(".w-full.max-w-md")!;

    // Flip once
    await user.click(cardWrapper);
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();

    // Click again — should stay flipped (handleFlip checks !flipped)
    await user.click(cardWrapper);
    expect(screen.getByRole("button", { name: /Again/ })).toBeInTheDocument();
  });
});
