/**
 * Shared helpers and constants for Playwright E2E tests.
 *
 * Credentials default to the users created by `npm run db:seed`. The seed has
 * no literal password (see `src/prisma/seed-guard.ts`): it hashes
 * `SEED_PASSWORD`, so the password used here is `E2E_PASSWORD` or, failing
 * that, the same `SEED_PASSWORD` the seed ran with. `.github/workflows/e2e.yml`
 * sets `SEED_PASSWORD` for both steps. Override via env vars when pointing at a
 * non-seeded environment.
 */

import { expect, type Page } from '@playwright/test';

export const E2E_TENANT = process.env.E2E_TENANT || 'armonia';
export const E2E_EMAIL =
  process.env.E2E_EMAIL || 'beatriz.malavera@insolventic.com';
export const E2E_PASSWORD =
  process.env.E2E_PASSWORD || process.env.SEED_PASSWORD || '';

/**
 * Navigate to `/login?db=<tenant>` and submit valid credentials. On success
 * the user lands on `/dashboard`. Throws if the redirect doesn't happen
 * within 15s — login is the gate for every other E2E test so we fail loud.
 *
 * Si aparece el diálogo de aceptación de términos (N-G-07), lo acepta: bloquea
 * toda la app, y la primera corrida contra un seed recién hecho siempre lo
 * muestra. `aceptarTerminos: false` lo deja abierto para el test que lo prueba.
 */
export async function loginAs(
  page: Page,
  {
    tenant = E2E_TENANT,
    email = E2E_EMAIL,
    password = E2E_PASSWORD,
    aceptarTerminos = true,
  }: {
    tenant?: string;
    email?: string;
    password?: string;
    aceptarTerminos?: boolean;
  } = {},
): Promise<void> {
  if (!password) {
    throw new Error(
      'E2E sin contraseña: definí E2E_PASSWORD o SEED_PASSWORD (la misma con ' +
        'la que corrió `npm run db:seed`).',
    );
  }
  await page.goto(`/login?db=${tenant}`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  if (aceptarTerminos) await aceptarTerminosSiSeMuestran(page);
}

/**
 * Espera a que el header termine de consultar la aceptación y, si el diálogo
 * está abierto, marca las casillas y acepta.
 */
export async function aceptarTerminosSiSeMuestran(page: Page): Promise<void> {
  await page
    .locator('[data-aceptacion-terminos="verificada"]')
    .waitFor({ state: 'attached', timeout: 15_000 });
  const dialogo = page.getByTestId('aceptacion-terminos');
  if (!(await dialogo.isVisible())) return;
  for (const casilla of await dialogo.getByRole('checkbox').all()) {
    await casilla.check();
  }
  await dialogo.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(dialogo).toBeHidden({ timeout: 10_000 });
}
