/**
 * E2E: el diálogo de aceptación de términos bloquea la app hasta aceptar
 * (N-G-07), y la aceptación queda en la base.
 *
 * Usa una cuenta que ningún otro E2E usa (Sofía, de Constructores de Paz) y le
 * borra las aceptaciones antes de empezar, así el test no depende del orden ni
 * de los reintentos. Borrar filas de esta tabla solo lo hace el test: la app no
 * tiene ninguna acción que lo permita.
 */

import { PrismaClient } from '@prisma/client';
import { test, expect } from '@playwright/test';

import { loginAs } from './helpers';

const TENANT = 'constructores-paz';
const EMAIL = 'sofia.torres@insolventic.com';

const prisma = new PrismaClient();
let userId: string;

test.beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({
    where: { email: EMAIL, tenant: { slug: TENANT } },
    select: { id: true },
  });
  userId = user.id;
});

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await prisma.aceptacionDocumentoLegal.deleteMany({ where: { userId } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('bloquea hasta aceptar, registra la aceptación y no vuelve a pedirla', async ({
  page,
}) => {
  await loginAs(page, { tenant: TENANT, email: EMAIL, aceptarTerminos: false });

  const dialogo = page.getByTestId('aceptacion-terminos');
  await expect(dialogo).toBeVisible({ timeout: 15_000 });

  // No se cierra con Escape ni con un clic afuera.
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(dialogo).toBeVisible();

  // El error aparece solo después de intentar aceptar sin marcar.
  await expect(dialogo.getByRole('alert')).toHaveCount(0);
  await dialogo.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText(
    'Marque las casillas para continuar.',
  );

  for (const casilla of await dialogo.getByRole('checkbox').all()) {
    await casilla.check();
  }
  await dialogo.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(dialogo).toBeHidden({ timeout: 10_000 });

  const filas = await prisma.aceptacionDocumentoLegal.findMany({
    where: { userId },
    select: { documento: true },
    orderBy: { documento: 'asc' },
  });
  expect(filas.map((f) => f.documento)).toEqual(['privacidad', 'terminos']);

  // Una carga completa no lo vuelve a pedir.
  await page.reload();
  await page
    .locator('[data-aceptacion-terminos="verificada"]')
    .waitFor({ state: 'attached', timeout: 15_000 });
  await expect(dialogo).toBeHidden();

  // Y el historial queda a la vista en el perfil.
  await page.goto('/profile');
  const historial = page.getByTestId('historial-aceptaciones');
  await expect(historial).toContainText('Términos de uso para operadores');
  await expect(historial).toContainText(
    'Política de tratamiento de datos personales',
  );
});

test('sin aceptar, la única salida es cerrar sesión', async ({ page }) => {
  await loginAs(page, { tenant: TENANT, email: EMAIL, aceptarTerminos: false });

  const dialogo = page.getByTestId('aceptacion-terminos');
  await expect(dialogo).toBeVisible({ timeout: 15_000 });
  await dialogo.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page).toHaveURL(/\/(login)?(\?.*)?$/, { timeout: 15_000 });
  expect(
    await prisma.aceptacionDocumentoLegal.count({ where: { userId } }),
  ).toBe(0);
});
