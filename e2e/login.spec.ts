import { test, expect } from "@playwright/test";
import { mockSupabaseNoAuth } from "./fixtures/auth-mocks";

test.beforeEach(async ({ page }) => {
  await mockSupabaseNoAuth(page);
});

test("login form renders all elements", async ({ page }) => {
  await page.goto("/login");

  // Heading
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible();

  // Google OAuth button
  await expect(page.getByText("Continue with Google")).toBeVisible();

  // Email and password inputs
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();

  // Sign in button
  await expect(
    page.getByRole("button", { name: "Sign in" })
  ).toBeVisible();
});

test("shows error for invalid credentials", async ({ page }) => {
  await page.goto("/login");

  // Fill in the form
  await page.getByPlaceholder("Email").fill("bad@example.com");
  await page.getByPlaceholder("Password").fill("wrongpassword");

  // Submit the form
  await page.getByRole("button", { name: "Sign in" }).click();

  // Error message should appear (Supabase token endpoint returns 400)
  await expect(page.locator("p.text-red-500, p.text-red-400")).toBeVisible({
    timeout: 10000,
  });
});

test("toggle login/signup modes", async ({ page }) => {
  await page.goto("/login");

  // Initially in login mode
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible();

  // Click "Sign up" toggle link
  await page.getByRole("button", { name: "Sign up" }).click();

  // Should now show "Create account" heading
  await expect(
    page.getByRole("heading", { name: "Create account" })
  ).toBeVisible();

  // Click "Sign in" to switch back
  await page.getByRole("button", { name: "Sign in" }).click();

  // Should be back to "Welcome back"
  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible();
});
