import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { mockSupabaseNoAuth } from "./fixtures/auth-mocks";

test.beforeEach(async ({ page }) => {
  await mockSupabaseNoAuth(page);
  await mockAllAPIs(page);
});

test("sidebar navigation between pages", async ({ page }) => {
  await page.goto("/");

  // Click Flashcards link in sidebar
  await page.locator('a[href="/flashcards"]').first().click();
  await expect(page).toHaveURL(/\/flashcards/);

  // Click Editor link to go back
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL("/");
});

test("dark mode toggle persists", async ({ page }) => {
  await page.goto("/");

  // Clear any stored dark mode preference, then reload
  await page.evaluate(() => localStorage.removeItem("darkMode"));
  await page.reload();

  const html = page.locator("html");

  // Click dark mode toggle button
  const darkToggle = page.getByRole("button", { name: /toggle dark mode/i });
  await darkToggle.click();

  // html should have "dark" class
  await expect(html).toHaveClass(/dark/);

  // Reload the page — dark mode should persist via localStorage
  await page.reload();
  await expect(html).toHaveClass(/dark/);

  // Toggle back to light mode
  const lightToggle = page.getByRole("button", { name: /toggle dark mode/i });
  await lightToggle.click();
  await expect(html).not.toHaveClass(/dark/);
});

test("mobile menu opens and closes", async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Desktop sidebar should be hidden, hamburger visible
  const hamburger = page.getByRole("button", { name: /open menu/i });
  await expect(hamburger).toBeVisible();

  // Click hamburger to open mobile menu
  await hamburger.click();

  // Mobile sidebar should be visible (the aside inside the overlay)
  const mobileSidebar = page.locator("div.fixed.inset-0 aside");
  await expect(mobileSidebar).toBeVisible();

  // Close button should be visible
  const closeBtn = page.getByRole("button", { name: /close menu/i });
  await expect(closeBtn).toBeVisible();

  // Click close
  await closeBtn.click();

  // Mobile sidebar should be hidden
  await expect(mobileSidebar).not.toBeVisible();
});
