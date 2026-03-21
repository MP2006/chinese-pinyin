// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// --- Mocks ---

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Use vi.hoisted to define mock chain BEFORE vi.mock factory runs
// This is necessary because useFlashcards.ts calls createClient() at module scope
const { mockChain, mockSupabase } = vi.hoisted(() => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const mockSupabase = {
    from: vi.fn(() => mockChain),
  };
  return { mockChain, mockSupabase };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

import { useFlashcards } from "../useFlashcards";

function resetChainMocks() {
  mockChain.select.mockClear().mockReturnThis();
  mockChain.eq.mockClear().mockReturnThis();
  mockChain.order.mockClear().mockResolvedValue({ data: [], error: null });
  mockChain.insert.mockClear().mockResolvedValue({ error: null });
  mockChain.update.mockClear().mockReturnThis();
  mockChain.delete.mockClear().mockReturnThis();
  mockChain.upsert.mockClear().mockResolvedValue({ error: null });
  mockSupabase.from.mockClear().mockReturnValue(mockChain);
}

describe("useFlashcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChainMocks();
  });

  describe("logged-out path", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });
    });

    it("returns empty cards when not logged in", () => {
      const { result } = renderHook(() => useFlashcards());
      expect(result.current.cards).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it("hasCard returns false when not logged in", () => {
      const { result } = renderHook(() => useFlashcards());
      expect(result.current.hasCard("你好")).toBe(false);
    });

    it("addCard is a no-op when not logged in", async () => {
      const { result } = renderHook(() => useFlashcards());

      await act(async () => {
        await result.current.addCard("你好", "nǐ hǎo", { en: "hello" });
      });

      expect(result.current.cards).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("logged-in path", () => {
    const fakeUser = { id: "user-123" };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: fakeUser, loading: false });
    });

    it("fetches cards from Supabase on mount", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0].word).toBe("你好");
      expect(result.current.cards[0].easeFactor).toBe(2.5);
    });

    it("addCard calls Supabase insert for new word", async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addCard("世界", "shì jiè", { en: "world" });
      });

      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0].word).toBe("世界");
      expect(mockSupabase.from).toHaveBeenCalledWith("flashcards");
      expect(mockChain.insert).toHaveBeenCalled();
    });

    it("addCard merges definitions for existing word via Supabase update", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Add same word with a new language definition
      await act(async () => {
        await result.current.addCard("你好", "nǐ hǎo", { vi: "xin chào" });
      });

      // Optimistic: definitions merged
      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0].definitions).toEqual({
        en: "hello",
        vi: "xin chào",
      });
      // Supabase update called (not insert)
      expect(mockChain.update).toHaveBeenCalled();
      expect(mockChain.insert).not.toHaveBeenCalled();
    });

    it("hasCard returns true for existing word via Supabase", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.cards).toHaveLength(1);
      });

      expect(result.current.hasCard("你好")).toBe(true);
      expect(result.current.hasCard("世界")).toBe(false);
    });

    it("reviewCard updates card optimistically and syncs to Supabase", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.cards).toHaveLength(1);
      });

      await act(async () => {
        await result.current.reviewCard("sb-1", "good");
      });

      // Optimistic update: reviewCount incremented, interval changed
      expect(result.current.cards[0].reviewCount).toBe(1);
      expect(result.current.cards[0].interval).toBe(1);
      // Supabase update called with SM-2 result
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: 1,
          review_count: 1,
        })
      );
    });

    it("removeCard calls Supabase delete", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.cards).toHaveLength(1);
      });

      await act(async () => {
        await result.current.removeCard("sb-1");
      });

      expect(result.current.cards).toHaveLength(0);
      expect(mockChain.delete).toHaveBeenCalled();
    });
  });

  describe("sync error handling", () => {
    const fakeUser = { id: "user-123" };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: fakeUser, loading: false });
    });

    it("sets syncError when addCard insert fails", async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });
      mockChain.insert.mockResolvedValue({ error: { message: "insert failed" } });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addCard("世界", "shì jiè", { en: "world" });
      });

      expect(result.current.syncError).toBe("Failed to save card: insert failed");
    });

    it("reverts optimistic update on sync failure", async () => {
      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你好",
          pinyin: "nǐ hǎo",
          definitions: { en: "hello" },
          created_at: "2024-06-15T00:00:00Z",
          next_review: "2024-06-15",
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.cards).toHaveLength(1);
      });

      // Make delete fail — eq needs to remain chainable, but last eq returns error
      const errorResult = { error: { message: "delete failed" } };
      mockChain.eq.mockReturnValueOnce({ ...errorResult, eq: vi.fn().mockReturnValue(errorResult) });

      await act(async () => {
        await result.current.removeCard("sb-1");
      });

      // After refresh, cards should be restored from the server data
      await waitFor(() => {
        expect(result.current.syncError).toBe("Failed to delete card: delete failed");
      });
    });

    it("clearSyncError resets error to null", async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });
      mockChain.insert.mockResolvedValue({ error: { message: "insert failed" } });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.addCard("世界", "shì jiè", { en: "world" });
      });

      expect(result.current.syncError).not.toBeNull();

      act(() => {
        result.current.clearSyncError();
      });

      expect(result.current.syncError).toBeNull();
    });
  });

  describe("dueCards", () => {
    it("filters to only cards due today or earlier", async () => {
      const fakeUser = { id: "user-123" };
      mockUseAuth.mockReturnValue({ user: fakeUser, loading: false });
      const today = new Date().toISOString().slice(0, 10);

      const dbRows = [
        {
          id: "sb-1",
          user_id: "user-123",
          word: "你",
          pinyin: "nǐ",
          definitions: { en: "you" },
          created_at: "2024-01-01T00:00:00Z",
          next_review: today,
          interval: 0,
          ease_factor: 2.5,
          review_count: 0,
        },
        {
          id: "sb-2",
          user_id: "user-123",
          word: "好",
          pinyin: "hǎo",
          definitions: { en: "good" },
          created_at: "2024-01-01T00:00:00Z",
          next_review: "2099-12-31",
          interval: 10,
          ease_factor: 2.5,
          review_count: 5,
        },
      ];
      mockChain.order.mockResolvedValue({ data: dbRows, error: null });

      const { result } = renderHook(() => useFlashcards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.dueCards).toHaveLength(1);
      expect(result.current.dueCards[0].word).toBe("你");
    });
  });
});
