import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  translateWithLingva,
  translateWithMyMemory,
  translateText,
} from "../translate";

describe("translate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("translateWithLingva", () => {
    it("calls correct URL and returns cleaned translation", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ translation: "hello (= greeting)" }), {
          status: 200,
        })
      );

      const result = await translateWithLingva("你好", "en");
      expect(result).toBe("hello");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("lingva.ml/api/v1/zh/en/"),
        expect.any(Object)
      );
    });

    it("throws on non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("", { status: 500 })
      );

      await expect(translateWithLingva("你好", "en")).rejects.toThrow(
        "Lingva returned 500"
      );
    });
  });

  describe("translateWithMyMemory", () => {
    it("returns translation from responseData", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            responseData: { translatedText: "hello;" },
          }),
          { status: 200 }
        )
      );

      const result = await translateWithMyMemory("你好", "en");
      expect(result).toBe("hello");
    });

    it("throws on rate limit warning", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            responseData: {
              translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE",
            },
          }),
          { status: 200 }
        )
      );

      await expect(translateWithMyMemory("你好", "en")).rejects.toThrow(
        "MyMemory rate limited"
      );
    });

    it("throws on non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response("", { status: 429 })
      );

      await expect(translateWithMyMemory("你好", "en")).rejects.toThrow(
        "MyMemory returned 429"
      );
    });
  });

  describe("translateText", () => {
    it("returns first successful result", async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ translation: "hello" }), { status: 200 })
      );

      const result = await translateText("你好", "en");
      expect(result).toBe("hello");
    });

    it("succeeds if one API fails and other succeeds", async () => {
      let callCount = 0;
      vi.mocked(fetch).mockImplementation(async (url) => {
        callCount++;
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("lingva")) {
          throw new Error("Lingva down");
        }
        return new Response(
          JSON.stringify({ responseData: { translatedText: "hello" } }),
          { status: 200 }
        );
      });

      const result = await translateText("你好", "en");
      expect(result).toBe("hello");
    });

    it("rejects if both APIs fail", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      await expect(translateText("你好", "en")).rejects.toThrow();
    });
  });
});
