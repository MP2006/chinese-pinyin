import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { mockSupabaseNoAuth } from "./fixtures/auth-mocks";
import { SAMPLE_TEXT, MOCK_TRANSLATION } from "./fixtures/test-data";

test.beforeEach(async ({ page }) => {
  await mockSupabaseNoAuth(page);
  await mockAllAPIs(page);
});

test("editor loads and accepts Chinese text", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await page.reload();

  const editor = page.locator(".tiptap");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.insertText(SAMPLE_TEXT);

  await expect(editor).toContainText(SAMPLE_TEXT);
});

test("pinyin renders for Chinese text", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".tiptap");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.insertText(SAMPLE_TEXT);

  // Pinyin display should show ruby elements with rt annotations
  const rubyElements = page.locator(".pinyin-display ruby");
  await expect(rubyElements.first()).toBeVisible();

  const rtElements = page.locator(".pinyin-display rt");
  await expect(rtElements.first()).toBeVisible();
});

test("click word shows definition popup", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".tiptap");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.insertText(SAMPLE_TEXT);

  // Wait for pinyin display to render
  await expect(page.locator(".pinyin-display ruby").first()).toBeVisible();

  // Click on a word span with data-word attribute
  const wordSpan = page.locator('[data-word="你好"]').first();
  await expect(wordSpan).toBeVisible();
  await wordSpan.click();

  // Definition popup should appear with pinyin and "Sign in to save" link
  await expect(page.getByText("Sign in to save")).toBeVisible();
});

test("translation appears after typing", async ({ page }) => {
  await page.goto("/");
  const editor = page.locator(".tiptap");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.insertText(SAMPLE_TEXT);

  // Wait for the translation section heading to appear (exact match to avoid subtitle)
  await expect(
    page.getByRole("heading", { name: "Translation" })
  ).toBeVisible();

  // The mock translation text should appear (after 300ms debounce + fetch)
  await expect(page.getByText(MOCK_TRANSLATION)).toBeVisible({ timeout: 10000 });
});

test("editor content persists via sessionStorage", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".tiptap");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.insertText(SAMPLE_TEXT);
  await expect(editor).toContainText(SAMPLE_TEXT);

  // Verify sessionStorage was written
  const stored = await page.evaluate(() =>
    sessionStorage.getItem("editor-content")
  );
  expect(stored).toBeTruthy();
  expect(stored).toContain(SAMPLE_TEXT);

  // Reload — sessionStorage survives, editor should restore content
  await page.reload();

  const editorAfter = page.locator(".tiptap");
  await expect(editorAfter).toContainText(SAMPLE_TEXT, { timeout: 10000 });
});
