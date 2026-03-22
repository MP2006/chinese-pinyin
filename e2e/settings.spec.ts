import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { mockSupabaseNoAuth } from "./fixtures/auth-mocks";

test.beforeEach(async ({ page }) => {
  await mockSupabaseNoAuth(page);
  await mockAllAPIs(page);
});

test("language switch changes UI text", async ({ page }) => {
  await page.goto("/settings");

  // Default is English — heading should say "Settings"
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // Switch to Vietnamese
  const select = page.locator("#lang-select");
  await select.selectOption("vi");

  // Heading should change to "Cài đặt"
  await expect(
    page.getByRole("heading", { name: "Cài đặt" })
  ).toBeVisible();

  // Sidebar should show "Soạn thảo" (Editor in Vietnamese)
  await expect(page.getByText("Soạn thảo")).toBeVisible();
});

test("language persists across navigation", async ({ page }) => {
  // Pre-set language to Vietnamese before loading
  await page.addInitScript(() => {
    localStorage.setItem("settings-lang", "vi");
  });

  await page.goto("/settings");

  // Should be in Vietnamese
  await expect(
    page.getByRole("heading", { name: "Cài đặt" })
  ).toBeVisible();

  // Navigate to home page
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL("/");

  // Home page should be in Vietnamese — subtitle should be Vietnamese
  await expect(
    page.getByText("Nhập ký tự tiếng Trung để xem phiên âm và bản dịch")
  ).toBeVisible();
});
