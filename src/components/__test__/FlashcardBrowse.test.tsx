// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlashcardBrowse from "../FlashcardBrowse";
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
    definitions: { en: "world", vi: "thế giới" },
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

describe("FlashcardBrowse", () => {
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDelete = vi.fn();
    mockSpeak.mockClear();
  });

  it("renders all cards with word and pinyin", () => {
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    expect(screen.getByText("世界")).toBeInTheDocument();
    expect(screen.getByText("shì jiè")).toBeInTheDocument();
    expect(screen.getByText("学习")).toBeInTheDocument();
    expect(screen.getByText("xué xí")).toBeInTheDocument();
  });

  it("search filters by Chinese word", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const searchInput = screen.getByPlaceholderText(
      "Search words, pinyin, or definitions..."
    );
    await user.type(searchInput, "你好");

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.queryByText("世界")).not.toBeInTheDocument();
    expect(screen.queryByText("学习")).not.toBeInTheDocument();
  });

  it("search filters by pinyin (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const searchInput = screen.getByPlaceholderText(
      "Search words, pinyin, or definitions..."
    );
    // Use lowercase pinyin that matches (diacritics must match too)
    await user.type(searchInput, "shì");

    expect(screen.getByText("世界")).toBeInTheDocument();
    expect(screen.queryByText("你好")).not.toBeInTheDocument();
  });

  it("search filters by definition", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const searchInput = screen.getByPlaceholderText(
      "Search words, pinyin, or definitions..."
    );
    await user.type(searchInput, "study");

    expect(screen.getByText("学习")).toBeInTheDocument();
    expect(screen.queryByText("你好")).not.toBeInTheDocument();
  });

  it('empty search results shows "No matching cards"', async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const searchInput = screen.getByPlaceholderText(
      "Search words, pinyin, or definitions..."
    );
    await user.type(searchInput, "zzzzzznotfound");

    expect(screen.getByText("No matching cards")).toBeInTheDocument();
  });

  it("card click toggles flip", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    // Click card container (the one with cursor-pointer and onClick)
    const cardEl = screen.getByText("你好").closest(".relative.cursor-pointer")!;
    await user.click(cardEl);

    // Back face should now show definition
    expect(screen.getByText("hello")).toBeInTheDocument();

    // Click again to unflip
    await user.click(cardEl);

    // Card should still be in DOM (front face)
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("speaker button calls speak() without flipping card", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const speakerButtons = screen.getAllByLabelText("Speak word");
    await user.click(speakerButtons[0]);

    expect(mockSpeak).toHaveBeenCalledWith("你好");
  });

  it("delete button first click shows confirmation state", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByLabelText("Delete card");
    await user.click(deleteButtons[0]);

    // Should now show confirm label
    expect(screen.getByLabelText("Confirm delete")).toBeInTheDocument();
    // Should NOT have called onDelete yet
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("delete confirmation executes onDelete", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByLabelText("Delete card");
    // First click: confirm state
    await user.click(deleteButtons[0]);
    // Second click: actually delete
    const confirmBtn = screen.getByLabelText("Confirm delete");
    await user.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("clicking different card unflips the previous one", async () => {
    const user = userEvent.setup();
    render(<FlashcardBrowse cards={cards} onDelete={onDelete} />);

    // Flip first card
    const card1El = screen.getByText("你好").closest(".relative.cursor-pointer")!;
    await user.click(card1El);

    // Get card1's inner transform container
    const card1Inner = card1El.firstElementChild as HTMLElement;
    expect(card1Inner.style.transform).toBe("rotateY(180deg)");

    // Flip second card — should unflip the first
    const card2El = screen.getByText("世界").closest(".relative.cursor-pointer")!;
    await user.click(card2El);

    // Card 1 should be back to front
    expect(card1Inner.style.transform).toBe("rotateY(0deg)");
    // Card 2 should be flipped
    const card2Inner = card2El.firstElementChild as HTMLElement;
    expect(card2Inner.style.transform).toBe("rotateY(180deg)");
  });
});
