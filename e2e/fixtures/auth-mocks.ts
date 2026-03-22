import { Page } from "@playwright/test";
import { MOCK_USER, MOCK_SESSION } from "./test-data";

import * as fs from "fs";
import * as path from "path";

function getSupabaseUrl(): string {
  const envPath = path.resolve(__dirname, "../../.env.local");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return "https://sffzrauluqpwvamzauyq.supabase.co";
}

const SUPABASE_URL = getSupabaseUrl();
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

/** Mock Supabase auth — intercepts getUser, token refresh, and sets session cookie */
export async function mockSupabaseAuth(page: Page) {
  // Mock getUser endpoint
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  });

  // Mock token refresh endpoint
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION),
    });
  });

  // Set auth session cookie via addInitScript (runs before page JS)
  // @supabase/ssr createBrowserClient uses document.cookie by default
  const sessionData = JSON.stringify(MOCK_SESSION);
  const cookieName = `sb-${PROJECT_REF}-auth-token`;

  await page.addInitScript(
    ({ cookieName, sessionData }) => {
      // Set cookie (path=/ so it's accessible everywhere)
      document.cookie = `${cookieName}=${encodeURIComponent(sessionData)}; path=/; max-age=3600`;
      // Also set in localStorage as fallback (some Supabase versions check this)
      try {
        localStorage.setItem(cookieName, sessionData);
      } catch {}
    },
    { cookieName, sessionData }
  );
}

interface FlashcardRow {
  id: string;
  user_id: string;
  word: string;
  pinyin: string;
  definitions: Record<string, string>;
  interval: number;
  ease_factor: number;
  review_count: number;
  next_review: string;
  last_rating: string | null;
  created_at: string;
}

/** Mock Supabase flashcards REST API */
export async function mockSupabaseFlashcards(
  page: Page,
  cards: FlashcardRow[]
) {
  const currentCards = [...cards];

  await page.route(`${SUPABASE_URL}/rest/v1/flashcards**`, (route) => {
    const method = route.request().method();

    if (method === "GET") {
      const prefer = route.request().headers()["prefer"] || "";
      if (prefer.includes("count=exact")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "content-range": `0-${Math.max(0, currentCards.length - 1)}/${currentCards.length}`,
          },
          body: JSON.stringify(currentCards),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentCards),
        });
      }
    } else if (method === "POST") {
      let body: FlashcardRow;
      try {
        body = route.request().postDataJSON();
      } catch {
        route.fulfill({ status: 400, body: "Bad request" });
        return;
      }
      const newCard = { ...body, id: body.id || `card-${Date.now()}` };
      currentCards.push(newCard);
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newCard),
      });
    } else if (method === "PATCH") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    } else if (method === "DELETE") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    } else {
      route.continue();
    }
  });
}

/** Mock Supabase with no authenticated user */
export async function mockSupabaseNoAuth(page: Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_token",
        error_description: "Invalid token",
      }),
    });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    });
  });
}
