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
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  /**
   * El registro autoservicio está CERRADO desde C-2 (auditoría 2026-08-25):
   * sin verificación de email permitía suplantar a un deudor real, porque la
   * identidad del modo cliente se resuelve por email. Los usuarios los crea
   * un administrador del centro desde /users.
   *
   * Este test afirmaba lo contrario — que /register renderizaba su
   * formulario — y por eso llevaba rojo desde el despliegue de Semanas 1-2.
   * No era un bug: el test estaba desactualizado respecto a un cierre
   * deliberado.
   *
   * Hay DOS capas cerrando la puerta:
   *   1. El middleware (C-1): '/register' no está en PUBLIC_ROUTES
   *      (src/middleware.ts:26), así que un visitante sin sesión se va a
   *      /login?redirect=%2Fregister antes de tocar la página.
   *   2. La página (C-2): src/app/register/page.tsx es un redirect('/login').
   *
   * Para un visitante sin sesión gana la primera. La cadena medida contra la
   * app desplegada es:
   *
   *   /register?db=… → /login?redirect=%2Fregister → /
   *
   * El último salto es porque ese /login llega sin `db` y rebota al selector
   * de centro. Por eso el regex es `/\/login|\/$/` y no `/\/login/` a secas:
   * la URL pasa por /login pero se asienta en /, y acoplarse a un instante
   * concreto de la cadena haría el test flaky. Es además la misma aserción
   * que usan los otros cuatro tests de ruta protegida de esta suite
   * (`/dashboard` aquí arriba, y los tres de Route protection en cases.e2e).
   *
   * Si alguien reabriera el registro sin verificación de email, este test se
   * pone rojo. Esa es su razón de existir ahora.
   */
  test('registration is closed — /register redirects away from the form', async ({
    page,
  }) => {
    await page.goto(`/register?db=${E2E_TENANT}`);

    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 10_000 });

    // Evidencia directa de que la redirección ocurrió, independiente de dónde
    // acabe asentándose la cadena.
    expect(new URL(page.url()).pathname).not.toBe('/register');

    // Y el formulario de registro no se renderiza en ninguna de las dos
    // paradas. `input#name` y `input#confirmPassword` eran exclusivos de él.
    await expect(page.locator('input#name')).toHaveCount(0);
    await expect(page.locator('input#confirmPassword')).toHaveCount(0);
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
