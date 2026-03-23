// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GrammarPopover from "../GrammarPopover";
import type { GrammarAnalysis } from "@/types/grammar";

vi.mock("@/locales", () => ({
  useTranslation: () => ({
    common: { close: "Close", loading: "Loading..." },
    grammar: {
      title: "Grammar Breakdown",
      translation: "Translation",
      pattern: "Pattern",
      chunks: "Structure",
      note: "Note",
      analyzing: "Analyzing grammar...",
      error: "Grammar analysis failed.",
      notConfigured: "Not configured.",
      tooLong: "Too long.",
      rateLimit: "Rate limited.",
      correction: "Suggested fix",
      feedback: "Feedback",
    },
  }),
}));

const MOCK_ANALYSIS: GrammarAnalysis = {
  sentence: "你好",
  translation: "Hello",
  pattern: "Greeting",
  chunks: [
    { chunk: "你", pinyin: "nǐ", role: "Subject", meaning: "you" },
    { chunk: "好", pinyin: "hǎo", role: "Adjective", meaning: "good" },
  ],
  note: "Common greeting.",
  isCorrect: true,
};

const MOCK_INCORRECT: GrammarAnalysis = {
  sentence: "我去了学校昨天",
  translation: "I went to school yesterday",
  pattern: "Subject + Verb + Object + Time",
  chunks: [
    { chunk: "我", pinyin: "wǒ", role: "Subject", meaning: "I" },
    { chunk: "去了", pinyin: "qù le", role: "Verb", meaning: "went to" },
    { chunk: "学校", pinyin: "xuéxiào", role: "Object", meaning: "school" },
    { chunk: "昨天", pinyin: "zuótiān", role: "Adverb", meaning: "yesterday" },
  ],
  note: "Time words typically come before the verb in Chinese.",
  isCorrect: false,
  correction: "我昨天去了学校",
  correctionPinyin: "wǒ zuótiān qù le xuéxiào",
  feedback: "Time words should be placed before the verb, not after the object.",
};

const DEFAULT_PROPS = {
  position: { top: 100, left: 200 },
  onClose: vi.fn(),
};

describe("GrammarPopover", () => {
  it("renders loading skeleton", () => {
    render(
      <GrammarPopover
        analysis={null}
        loading={true}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Grammar Breakdown")).toBeInTheDocument();
    // Skeletons are just divs with animate-pulse
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders error message", () => {
    render(
      <GrammarPopover
        analysis={null}
        loading={false}
        error="Grammar analysis failed."
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Grammar analysis failed.")).toBeInTheDocument();
  });

  it("renders grammar analysis", () => {
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Greeting")).toBeInTheDocument();
    expect(screen.getByText("你")).toBeInTheDocument();
    expect(screen.getByText("nǐ")).toBeInTheDocument();
    expect(screen.getByText("Subject")).toBeInTheDocument();
    expect(screen.getByText("you")).toBeInTheDocument();
    expect(screen.getByText("好")).toBeInTheDocument();
    expect(screen.getByText("hǎo")).toBeInTheDocument();
    expect(screen.getByText("Adjective")).toBeInTheDocument();
    expect(screen.getByText("good")).toBeInTheDocument();
    expect(screen.getByText("Common greeting.")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        position={{ top: 100, left: 200 }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        position={{ top: 100, left: 200 }}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on click outside", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <GrammarPopover
          analysis={MOCK_ANALYSIS}
          loading={false}
          error={null}
          position={{ top: 100, left: 200 }}
          onClose={onClose}
        />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on click inside", () => {
    const onClose = vi.fn();
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        position={{ top: 100, left: 200 }}
        onClose={onClose}
      />
    );

    fireEvent.mouseDown(screen.getByText("Hello"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("positions correctly via style", () => {
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        position={{ top: 50, left: 75 }}
        onClose={vi.fn()}
      />
    );

    const popover = document.querySelector("[data-grammar-popover]") as HTMLElement;
    expect(popover.style.top).toBe("50px");
    expect(popover.style.left).toBe("75px");
  });

  it("does not render note section when note is empty", () => {
    render(
      <GrammarPopover
        analysis={{ ...MOCK_ANALYSIS, note: "" }}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });

  it("applies color to known roles", () => {
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    const subjectBadge = screen.getByText("Subject");
    expect(subjectBadge.className).toContain("bg-blue");
  });

  it("applies default color to unknown roles", () => {
    const analysis = {
      ...MOCK_ANALYSIS,
      chunks: [
        { chunk: "了", pinyin: "le", role: "Aspect Marker", meaning: "completion" },
      ],
    };

    render(
      <GrammarPopover
        analysis={analysis}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    const badge = screen.getByText("Aspect Marker");
    expect(badge.className).toContain("bg-gray");
  });

  it("does not show correction card when sentence is correct", () => {
    render(
      <GrammarPopover
        analysis={MOCK_ANALYSIS}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.queryByText("Suggested fix")).not.toBeInTheDocument();
    expect(screen.queryByText("Feedback")).not.toBeInTheDocument();
  });

  it("shows correction, pinyin, and feedback when sentence is incorrect", () => {
    render(
      <GrammarPopover
        analysis={MOCK_INCORRECT}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Suggested fix")).toBeInTheDocument();
    expect(screen.getByText("wǒ zuótiān qù le xuéxiào")).toBeInTheDocument();
    expect(screen.getByText("我昨天去了学校")).toBeInTheDocument();
    expect(
      screen.getByText("Time words should be placed before the verb, not after the object.")
    ).toBeInTheDocument();
  });

  it("shows correction without feedback when feedback is absent", () => {
    const withoutFeedback = { ...MOCK_INCORRECT, feedback: undefined };
    render(
      <GrammarPopover
        analysis={withoutFeedback}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Suggested fix")).toBeInTheDocument();
    expect(screen.getByText("我昨天去了学校")).toBeInTheDocument();
    // No feedback paragraph
    expect(
      screen.queryByText("Time words should be placed before the verb, not after the object.")
    ).not.toBeInTheDocument();
  });

  it("renders dash fallback for empty meaning", () => {
    const analysis = {
      ...MOCK_ANALYSIS,
      chunks: [
        { chunk: "了", pinyin: "le", role: "Particle", meaning: "" },
      ],
    };

    render(
      <GrammarPopover
        analysis={analysis}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("does not render correctionPinyin when absent", () => {
    const withoutPinyin = { ...MOCK_INCORRECT, correctionPinyin: undefined };
    render(
      <GrammarPopover
        analysis={withoutPinyin}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    expect(screen.getByText("Suggested fix")).toBeInTheDocument();
    expect(screen.getByText("我昨天去了学校")).toBeInTheDocument();
    expect(screen.queryByText("wǒ zuótiān qù le xuéxiào")).not.toBeInTheDocument();
  });

  it("uses amber styling for correction card", () => {
    render(
      <GrammarPopover
        analysis={MOCK_INCORRECT}
        loading={false}
        error={null}
        {...DEFAULT_PROPS}
      />
    );

    const correctionLabel = screen.getByText("Suggested fix");
    expect(correctionLabel.className).toContain("text-amber");
    const card = correctionLabel.closest("div.rounded-md");
    expect(card?.className).toContain("border-amber");
    expect(card?.className).toContain("bg-amber");
  });
});
