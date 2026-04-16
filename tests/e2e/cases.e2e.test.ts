/**
 * E2E Tests: Case Management Flows
 *
 * Tests listing, creation dialog visibility, and route protection.
 * Requires the app running on `E2E_BASE_URL` and a seeded database
 * (`npm run db:seed` — handled by the CI workflow).
 */

import { test, expect } from '@playwright/test';

import { loginAs } from './helpers';

test.describe('Case Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test('can navigate to /cases after login', async ({ page }) => {
    await page.goto('/cases');
    await expect(page).toHaveURL(/\/cases/);
    // Either the table is rendered or we get an empty-state message.
    await expect(
      page.locator('table, [data-testid="cases-table"], text=/caso/i'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('admin user sees the "Crear caso" entry point', async ({ page }) => {
    await page.goto('/cases');
    const createBtn = page.locator(
      'button:has-text("Crear"), button:has-text("Nuevo"), [data-testid="create-case"]',
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Route protection E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('/cases redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/cases');
    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 10_000 });
  });

  test('/users redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 10_000 });
  });

  test('/reports redirects unauthenticated users to /login', async ({
    page,
  }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 10_000 });
  });
});
