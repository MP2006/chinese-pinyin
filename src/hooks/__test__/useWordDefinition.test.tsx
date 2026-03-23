// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWordDefinition } from "../useWordDefinition";

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: vi.fn(() => ({ lang: "en" })),
}));

vi.mock("@/lib/cedict", () => ({
  defineWord: vi.fn(),
}));

import { defineWord } from "@/lib/cedict";
import { useSettings } from "@/contexts/SettingsContext";

function makeContainerRef() {
  const div = document.createElement("div");
  // Mock getBoundingClientRect for the container
  div.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    bottom: 500,
    right: 600,
    width: 600,
    height: 500,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  return { current: div };
}

function makeMouseEvent(targetRect: Partial<DOMRect> = {}): React.MouseEvent {
  const rect = {
    top: 100,
    left: 50,
    bottom: 120,
    right: 100,
    width: 50,
    height: 20,
    x: 50,
    y: 100,
    toJSON: () => {},
  };
  return {
    currentTarget: {
      getBoundingClientRect: () => ({ ...rect, ...targetRect }),
    },
  } as unknown as React.MouseEvent;
}

describe("useWordDefinition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettings).mockReturnValue({
      lang: "en",
      setLang: vi.fn(),
    });
  });

  it("starts with no selected word", () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() => useWordDefinition(containerRef));

    expect(result.current.selectedWord).toBeNull();
    expect(result.current.definitionLoading).toBe(false);
  });

  it("fetches definition on word click (English)", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockResolvedValue({
      pinyin: "nǐ hǎo",
      definitions: { en: "hello" },
    });

    const { result } = renderHook(() => useWordDefinition(containerRef));

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(result.current.selectedWord).toBe("你好");
    expect(result.current.wordDefinition.pinyin).toBe("nǐ hǎo");
    expect(result.current.wordDefinition.definitions.en).toBe("hello");
    expect(result.current.definitionLoading).toBe(false);
    expect(defineWord).toHaveBeenCalledWith("你好", "en");
  });

  it("fetches definition on word click (Vietnamese)", async () => {
    vi.mocked(useSettings).mockReturnValue({
      lang: "vi",
      setLang: vi.fn(),
    });
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockResolvedValue({
      pinyin: "nǐ hǎo",
      definitions: { vi: "xin chào" },
    });

    const { result } = renderHook(() => useWordDefinition(containerRef));

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(result.current.wordDefinition.definitions.vi).toBe("xin chào");
    expect(defineWord).toHaveBeenCalledWith("你好", "vi");
  });

  it("uses cache on second click for same word", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockResolvedValue({
      pinyin: "nǐ hǎo",
      definitions: { en: "hello" },
    });

    const { result } = renderHook(() => useWordDefinition(containerRef));

    // First click — calls defineWord
    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(defineWord).toHaveBeenCalledTimes(1);

    // Clear and click again — should use cache
    act(() => {
      result.current.clearSelection();
    });

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    // Still only 1 defineWord call (cached)
    expect(defineWord).toHaveBeenCalledTimes(1);
    expect(result.current.wordDefinition.pinyin).toBe("nǐ hǎo");
  });

  it("clearSelection resets state", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockResolvedValue({
      pinyin: "nǐ hǎo",
      definitions: { en: "hello" },
    });

    const { result } = renderHook(() => useWordDefinition(containerRef));

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(result.current.selectedWord).toBe("你好");

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedWord).toBeNull();
  });

  it("handles defineWord error gracefully", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useWordDefinition(containerRef));

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    // Should not crash, loading should finish
    expect(result.current.definitionLoading).toBe(false);
  });

  it("clamps popup position when near right edge", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(defineWord).mockResolvedValue({
      pinyin: "nǐ hǎo",
      definitions: { en: "hello" },
    });

    const { result } = renderHook(() => useWordDefinition(containerRef));

    // Click near right edge (left=500, container width=600, popup=288)
    await act(async () => {
      await result.current.handleWordClick(
        "你好",
        makeMouseEvent({ left: 500, right: 550 })
      );
    });

    // maxLeft = 600 - 288 = 312, so left should be clamped to 312
    expect(result.current.wordPosition.left).toBe(312);
  });
});
