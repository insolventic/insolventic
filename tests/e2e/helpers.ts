/**
 * Shared helpers and constants for Playwright E2E tests.
 *
 * Credentials default to the deterministic values produced by `npm run db:seed`
 * so the CI workflow (`.github/workflows/e2e.yml`) works out of the box with
 * a clean Postgres service. Override via env vars when pointing at a
 * non-seeded environment.
 */

import { expect, type Page } from '@playwright/test';

export const E2E_TENANT = process.env.E2E_TENANT || 'armonia';
export const E2E_EMAIL =
  process.env.E2E_EMAIL || 'beatriz.malavera@insolventic.com';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || '123456';

/**
 * Navigate to `/login?db=<tenant>` and submit valid credentials. On success
 * the user lands on `/dashboard`. Throws if the redirect doesn't happen
 * within 15s — login is the gate for every other E2E test so we fail loud.
 */
export async function loginAs(
  page: Page,
  {
    tenant = E2E_TENANT,
    email = E2E_EMAIL,
    password = E2E_PASSWORD,
  }: { tenant?: string; email?: string; password?: string } = {},
): Promise<void> {
  await page.goto(`/login?db=${tenant}`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
