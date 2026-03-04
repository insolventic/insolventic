/**
 * E2E Tests: Authentication Flows
 * Tests login, logout, registration, password reset via browser.
 * Requires: running dev server (playwright.config.ts handles this).
 *
 * Run: npx playwright test tests/e2e/auth.e2e.test.ts
 */

import { test, expect } from '@playwright/test';

// Configure tenant for E2E tests
const TENANT_SLUG = process.env.E2E_TENANT || 'insolventic';
const TEST_EMAIL = process.env.E2E_EMAIL || 'admin@insolventic.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'admin123';

test.describe('Authentication E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh — clear cookies
    await page.context().clearCookies();
  });

  test('should show login page when accessing protected route unauthenticated', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display login form with required fields', async ({ page }) => {
    await page.goto('/login');

    // Verify form elements exist
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in wrong credentials
    await page.fill('input[type="email"], input[name="email"]', 'wrong@email.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');

    // Select tenant if dropdown exists
    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ label: new RegExp(TENANT_SLUG, 'i') });
    }

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(
      page.locator('text=Credenciales inválidas, text=inválidas, [role="alert"]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);

    // Select tenant if dropdown exists
    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ label: new RegExp(TENANT_SLUG, 'i') });
    }

    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('should set httpOnly cookies after login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);

    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ label: new RegExp(TENANT_SLUG, 'i') });
    }

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verify cookies were set
    const cookies = await page.context().cookies();
    const accessTokenCookie = cookies.find((c) => c.name === 'access-token');
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie!.httpOnly).toBe(true);
  });

  test('should logout and redirect to home', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);

    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ label: new RegExp(TENANT_SLUG, 'i') });
    }

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Find and click logout button
    const logoutBtn = page.locator(
      'button:has-text("Cerrar sesión"), button:has-text("Salir"), [data-testid="logout"]',
    );
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/^\/$|\/login/, { timeout: 10000 });
    }
  });

  test('should redirect authenticated user from /login to /dashboard', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);

    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ label: new RegExp(TENANT_SLUG, 'i') });
    }

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Try going to /login again — should redirect to dashboard
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});

test.describe('Registration E2E', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[type="email"], input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'different123');
    await page.fill('input[name="phone"]', '3001234567');
    await page.fill('input[name="address"]', 'Test Address');
    await page.fill('input[name="professionalCard"]', 'TP-999');

    await page.click('button[type="submit"]');

    // Should show password mismatch error
    await expect(
      page.locator('text=coinciden, text=no coinciden'),
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Password Reset E2E', () => {
  test('should display forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for non-existent email', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.fill('input[type="email"], input[name="email"]', 'nonexistent@test.com');

    const tenantSelect = page.locator('select[name="tenantId"], [data-testid="tenant-select"]');
    if (await tenantSelect.isVisible()) {
      await tenantSelect.selectOption({ index: 1 });
    }

    await page.click('button[type="submit"]');

    await expect(
      page.locator('text=no está registrado, text=no encontrado, [role="alert"]'),
    ).toBeVisible({ timeout: 10000 });
  });
});
