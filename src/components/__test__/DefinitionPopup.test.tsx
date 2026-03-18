// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DefinitionPopup from "../DefinitionPopup";

const defaultProps = {
  word: "你好",
  pinyin: "nǐ hǎo",
  position: { top: 100, left: 200 },
  definitions: { en: "hello" },
  loading: false,
  enabledLanguages: new Set(["en"]),
  onClose: vi.fn(),
  onAddCard: vi.fn(),
  isSaved: false,
};

describe("DefinitionPopup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders word, pinyin, and definitions", () => {
    render(<DefinitionPopup {...defaultProps} />);

    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.getByText("nǐ hǎo")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it("shows loading state with spinner text", () => {
    render(<DefinitionPopup {...defaultProps} loading={true} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("save button calls onAddCard then shows checkmark", async () => {
    const user = userEvent.setup();
    const onAddCard = vi.fn();

    render(
      <DefinitionPopup
        {...defaultProps}
        onAddCard={onAddCard}
      />
    );

    const saveButton = screen.getByLabelText("Save to flashcards");
    await user.click(saveButton);

    expect(onAddCard).toHaveBeenCalledWith("你好", "nǐ hǎo", { en: "hello" });
    // After click, saved state changes to show checkmark
    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
  });

  it("shows checkmark when isSaved is true", () => {
    render(<DefinitionPopup {...defaultProps} isSaved={true} />);

    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    expect(screen.queryByLabelText("Save to flashcards")).not.toBeInTheDocument();
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<DefinitionPopup {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close");
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    render(<DefinitionPopup {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("click outside calls onClose", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <DefinitionPopup {...defaultProps} onClose={onClose} />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows "Enable a language" when enabledLanguages is empty', () => {
    render(
      <DefinitionPopup
        {...defaultProps}
        enabledLanguages={new Set()}
      />
    );

    expect(
      screen.getByText("Enable a language to see definitions")
    ).toBeInTheDocument();
  });

  it("renders multi-line definitions as separate paragraphs", () => {
    render(
      <DefinitionPopup
        {...defaultProps}
        definitions={{ en: "line1\nline2" }}
      />
    );

    expect(screen.getByText("line1")).toBeInTheDocument();
    expect(screen.getByText("line2")).toBeInTheDocument();
  });
});
