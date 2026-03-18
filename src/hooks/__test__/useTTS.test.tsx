// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTTS } from "../useTTS";

// Mock apiUsage
vi.mock("@/lib/apiUsage", () => ({
  logApiCall: vi.fn(),
}));
import { logApiCall } from "@/lib/apiUsage";

// Mock Audio
let audioInstances: Array<{
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}>;

beforeEach(() => {
  audioInstances = [];

  // Use a class so `new Audio()` works properly
  class MockAudio {
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      audioInstances.push(this);
    }
  }
  vi.stubGlobal("Audio", MockAudio);

  vi.stubGlobal(
    "URL",
    Object.assign({}, globalThis.URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
      revokeObjectURL: vi.fn(),
    })
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["audio-data"])),
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTTS", () => {
  it("speak() fetches /api/tts with correct POST body", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    expect(fetch).toHaveBeenCalledWith("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "你好" }),
    });
  });

  it("speaking becomes true during playback", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    // After speak resolves (play returned), speaking should be true
    // (it stays true until onended fires)
    expect(result.current.speaking).toBe(true);
  });

  it("speaking becomes false when audio ends", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    expect(result.current.speaking).toBe(true);

    // Trigger onended
    act(() => {
      audioInstances[0].onended?.();
    });

    expect(result.current.speaking).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("empty text does not fetch", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("");
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetch error sets speaking to false", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    expect(result.current.speaking).toBe(false);
  });

  it("previous audio paused when speak() called again", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    const firstAudio = audioInstances[0];

    await act(async () => {
      await result.current.speak("世界");
    });

    expect(firstAudio.pause).toHaveBeenCalled();
  });

  it("cleanup pauses audio on unmount", async () => {
    const { result, unmount } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好");
    });

    const audio = audioInstances[0];
    unmount();

    expect(audio.pause).toHaveBeenCalled();
  });

  it("logApiCall called with correct args", async () => {
    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await result.current.speak("你好世界");
    });

    expect(logApiCall).toHaveBeenCalledWith("/api/tts", 4);
  });
});
