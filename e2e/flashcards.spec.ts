import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import {
  mockSupabaseAuth,
  mockSupabaseFlashcards,
} from "./fixtures/auth-mocks";
import { SEED_CARDS } from "./fixtures/test-data";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await mockAllAPIs(page);
});

test("add card via modal on empty state", async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockSupabaseFlashcards(page, []);

  await page.goto("/flashcards");

  // Should show empty state with "No flashcards yet" text
  await expect(page.getByText("No flashcards yet")).toBeVisible();

  // Click "Add Card" button
  await page.getByRole("button", { name: "Add Card" }).click();

  // Modal should appear
  await expect(page.getByText("Add Card").nth(1)).toBeVisible();

  // Fill in the form
  await page.getByPlaceholder("e.g. 你好").fill("学习");
  await page.getByPlaceholder("e.g. nǐ hǎo").fill("xué xí");
  await page.getByPlaceholder("e.g. hello").fill("to study");

  // Submit
  await page.locator("form button[type='submit']").click();

  // Modal should close — verify by checking the modal backdrop is gone
  await expect(page.locator(".fixed.inset-0.z-50")).not.toBeVisible();
});

test("mode selector shows all modes", async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockSupabaseFlashcards(page, SEED_CARDS);

  await page.goto("/flashcards");

  // Wait for cards to load — "3 cards saved" subtitle
  await expect(page.getByText("3 cards saved")).toBeVisible();

  // All 5 mode buttons should be visible
  await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Learn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Match" })).toBeVisible();
});

test("search filters cards", async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockSupabaseFlashcards(page, SEED_CARDS);

  await page.goto("/flashcards");
  await expect(page.getByText("3 cards saved")).toBeVisible();

  const searchInput = page.getByPlaceholder(
    "Search words, pinyin, or definitions..."
  );
  await expect(searchInput).toBeVisible();

  // Search for "hello" — should match 你好 card
  await searchInput.fill("hello");
  await expect(page.getByText("Terms in this set (1)")).toBeVisible();

  // Clear search — all 3 cards should be visible
  await searchInput.clear();
  await expect(page.getByText("Terms in this set (3)")).toBeVisible();

  // Search for something that doesn't match
  await searchInput.fill("xyz");
  await expect(page.getByText(/No cards match/)).toBeVisible();
});

test("delete card with confirmation", async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockSupabaseFlashcards(page, SEED_CARDS);

  await page.goto("/flashcards");
  await expect(page.getByText("3 cards saved")).toBeVisible();

  // Scroll down to the card list and find the first card row
  // Card rows contain the word text — find a row with "你好"
  const cardRow = page.locator("div.group", { hasText: "你好" }).first();
  await cardRow.scrollIntoViewIfNeeded();
  await cardRow.hover();

  // Click delete button (first click = ask confirmation)
  // The button is hidden with opacity-0 but hovering the row reveals it
  const deleteBtn = cardRow.getByRole("button", { name: "Delete card" });
  await deleteBtn.click({ force: true });

  // Now it should show "Confirm delete" — click again
  const confirmBtn = cardRow.getByRole("button", {
    name: "Confirm delete",
  });
  await confirmBtn.click({ force: true });
});

test("navigate between modes", async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockSupabaseFlashcards(page, SEED_CARDS);

  await page.goto("/flashcards");
  await expect(page.getByText("3 cards saved")).toBeVisible();

  // Click Browse
  await page.getByRole("button", { name: "Browse" }).click();

  // Back button should be visible
  const backBtn = page.getByText("Back to modes");
  await expect(backBtn).toBeVisible();

  // Go back
  await backBtn.click();
  await expect(page.getByText("3 cards saved")).toBeVisible();

  // Click Learn
  await page.getByRole("button", { name: "Learn" }).click();
  await expect(page.getByText("Back to modes")).toBeVisible();

  // Go back
  await page.getByText("Back to modes").click();
  await expect(page.getByText("3 cards saved")).toBeVisible();
});
