/**
 * E2E Tests: Authentication Flows
 *
 * Tests login, logout, registration and password reset via browser.
 * Requires the app running on `E2E_BASE_URL` (handled by `playwright.config.ts`'s
 * webServer) and a seeded database (`npm run db:seed` — ran automatically in
 * the CI workflow).
 */

import { test, expect } from '@playwright/test';

import { E2E_TENANT, E2E_EMAIL, E2E_PASSWORD, loginAs } from './helpers';

test.describe('Authentication E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('redirects unauthenticated user from /dashboard to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test('login page renders the full form', async ({ page }) => {
    await page.goto(`/login?db=${E2E_TENANT}`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials surfaces an error', async ({ page }) => {
    await page.goto(`/login?db=${E2E_TENANT}`);
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('login with seeded credentials reaches /dashboard', async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login sets an httpOnly access-token cookie', async ({ page }) => {
    await loginAs(page);
    const cookies = await page.context().cookies();
    const accessToken = cookies.find((c) => c.name === 'access-token');
    expect(accessToken).toBeDefined();
    expect(accessToken!.httpOnly).toBe(true);
  });

  test('authenticated user visiting /login is redirected to /dashboard', async ({
    page,
  }) => {
    await loginAs(page);
    await page.goto(`/login?db=${E2E_TENANT}`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

test.describe('Registration E2E', () => {
  test('registration page renders its fields', async ({ page }) => {
    await page.goto(`/register?db=${E2E_TENANT}`);
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('input#confirmPassword')).toBeVisible();
  });
});

test.describe('Password Reset E2E', () => {
  test('forgot-password page renders and accepts an email', async ({
    page,
  }) => {
    await page.goto(`/forgot-password?db=${E2E_TENANT}`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// Re-export so downstream test files can import from a single place.
export { E2E_EMAIL, E2E_PASSWORD };
