// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWordDefinition } from "../useWordDefinition";

vi.mock("@/lib/apiUsage", () => ({
  logApiCall: vi.fn(),
}));

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
    vi.stubGlobal("fetch", vi.fn());
  });

  it("starts with no selected word", () => {
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useWordDefinition(containerRef, new Set(["en"]))
    );

    expect(result.current.selectedWord).toBeNull();
    expect(result.current.definitionLoading).toBe(false);
  });

  it("fetches definition on word click", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        pinyin: "nǐ hǎo",
        definitions: { en: "hello" },
      }),
    } as Response);

    const { result } = renderHook(() =>
      useWordDefinition(containerRef, new Set(["en"]))
    );

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(result.current.selectedWord).toBe("你好");
    expect(result.current.wordDefinition.pinyin).toBe("nǐ hǎo");
    expect(result.current.wordDefinition.definitions.en).toBe("hello");
    expect(result.current.definitionLoading).toBe(false);
  });

  it("uses cache on second click for same word", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        pinyin: "nǐ hǎo",
        definitions: { en: "hello" },
      }),
    } as Response);

    const { result } = renderHook(() =>
      useWordDefinition(containerRef, new Set(["en"]))
    );

    // First click — fetches
    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    // Clear and click again — should use cache
    act(() => {
      result.current.clearSelection();
    });

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    // Still only 1 fetch call (cached)
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.wordDefinition.pinyin).toBe("nǐ hǎo");
  });

  it("clearSelection resets state", async () => {
    const containerRef = makeContainerRef();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        pinyin: "nǐ hǎo",
        definitions: { en: "hello" },
      }),
    } as Response);

    const { result } = renderHook(() =>
      useWordDefinition(containerRef, new Set(["en"]))
    );

    await act(async () => {
      await result.current.handleWordClick("你好", makeMouseEvent());
    });

    expect(result.current.selectedWord).toBe("你好");

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedWord).toBeNull();
  });
});
