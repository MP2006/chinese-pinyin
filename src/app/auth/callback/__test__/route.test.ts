import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  }),
}));

import { GET } from "../route";

function makeRequest(url: string) {
  return new Request(url);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects to next path on successful auth", async () => {
    const res = await GET(
      makeRequest("http://localhost/auth/callback?code=abc&next=/flashcards")
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/flashcards");
  });

  it("redirects to / when no next param", async () => {
    const res = await GET(
      makeRequest("http://localhost/auth/callback?code=abc")
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("blocks open redirect with //evil.com", async () => {
    const res = await GET(
      makeRequest("http://localhost/auth/callback?code=abc&next=//evil.com")
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("blocks open redirect with https://evil.com", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/auth/callback?code=abc&next=https://evil.com"
      )
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("blocks open redirect with http://evil.com", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/auth/callback?code=abc&next=http://evil.com"
      )
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("blocks relative protocol //evil.com/path", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/auth/callback?code=abc&next=//evil.com/path"
      )
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("allows valid deep path /flashcards?tab=browse", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/auth/callback?code=abc&next=/flashcards?tab=browse"
      )
    );
    const location = res.headers.get("location")!;
    expect(new URL(location).pathname).toBe("/flashcards");
  });

  it("redirects to /login?error=auth when no code provided", async () => {
    const res = await GET(makeRequest("http://localhost/auth/callback"));
    const location = res.headers.get("location")!;
    expect(new URL(location).pathname).toBe("/login");
    expect(new URL(location).searchParams.get("error")).toBe("auth");
  });

  it("redirects to /login?error=auth when auth exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid code"),
    });
    const res = await GET(
      makeRequest("http://localhost/auth/callback?code=bad")
    );
    const location = res.headers.get("location")!;
    expect(new URL(location).pathname).toBe("/login");
  });
});
