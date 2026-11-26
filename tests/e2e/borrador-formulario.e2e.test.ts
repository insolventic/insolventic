/**
 * E2E: persistencia del formulario de alta de caso.
 *
 * - El diálogo no se cierra con Esc (tampoco el Esc de un Select) ni con clic
 *   fuera.
 * - Con cambios, la X pide confirmación; "Salir" cierra y deja el borrador.
 * - Al reabrir, el aviso del borrador permite restaurar lo que se había
 *   escrito.
 *
 * No crea casos. Termina descartando el borrador para no dejarlo a otros
 * tests del mismo usuario.
 */

import { test, expect, type Page } from '@playwright/test';

import { loginAs } from './helpers';

const OCUPACION = `Ocupación E2E ${Date.now().toString(36)}`;

async function abrirWizardInsolvencia(page: Page) {
  await page.goto('/cases');
  await page.getByRole('button', { name: /Crear nuevo caso/ }).click();
  await page.getByRole('menuitem', { name: 'Insolvencia' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Crear Nuevo Caso' });
  await expect(dialogo).toBeVisible({ timeout: 10_000 });
  await expect(dialogo.getByText('Cargando deudores...')).toHaveCount(0, {
    timeout: 10_000,
  });
  return dialogo;
}

test.describe('Alta de caso — borrador y cierre protegido', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test('llenar en parte, cerrar por error, reabrir y restaurar', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    let dialogo = await abrirWizardInsolvencia(page);

    // Esc y clic fuera no cierran.
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialogo).toBeVisible();

    // Esc dentro de un Select cierra el Select, no el diálogo.
    await dialogo.getByLabel('Operador del caso').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(dialogo).toBeVisible();

    // Llenar en parte (pestaña 2) y esperar el autoguardado (1 s).
    await dialogo.getByRole('tab', { name: /2\. Situación/ }).click();
    await dialogo
      .getByPlaceholder('Ej: Empleado, Independiente')
      .fill(OCUPACION);
    await dialogo.getByLabel('Arriendo', { exact: true }).fill('800000');
    // El autoguardado terminó cuando aparece "Descartar borrador".
    await expect(
      dialogo.getByRole('button', { name: /Descartar borrador/ }),
    ).toBeVisible({ timeout: 15_000 });

    // Cerrar "por error" con la X: pide confirmación.
    await dialogo.getByRole('button', { name: 'Close' }).click();
    const confirmar = page.getByRole('alertdialog', {
      name: '¿Salir sin guardar?',
    });
    await expect(confirmar).toBeVisible();
    await expect(
      confirmar.getByRole('button', { name: 'Seguir editando' }),
    ).toBeFocused();
    await confirmar.getByRole('button', { name: 'Salir' }).click();
    await expect(dialogo).toBeHidden();

    // Reabrir: aviso del borrador y restaurar.
    dialogo = await abrirWizardInsolvencia(page);
    await expect(
      dialogo.getByText(/Tienes un borrador sin guardar de/),
    ).toBeVisible({ timeout: 10_000 });
    await dialogo.getByRole('button', { name: 'Restaurar' }).click();
    await dialogo.getByRole('tab', { name: /2\. Situación/ }).click();
    await expect(
      dialogo.getByPlaceholder('Ej: Empleado, Independiente'),
    ).toHaveValue(OCUPACION);
    await expect(dialogo.getByLabel('Arriendo', { exact: true })).toHaveValue(
      '800.000',
    );

    // Limpieza: descartar el borrador; sin cambios, "Cancelar" cierra directo.
    await dialogo.getByRole('button', { name: /Descartar borrador/ }).click();
    await expect(
      dialogo.getByPlaceholder('Ej: Empleado, Independiente'),
    ).toHaveValue('');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();

    // Y ya no se ofrece.
    dialogo = await abrirWizardInsolvencia(page);
    await page.waitForTimeout(1000);
    await expect(
      dialogo.getByText(/Tienes un borrador sin guardar/),
    ).toHaveCount(0);
  });

  test('"Empezar de cero" descarta el borrador y deja el formulario vacío', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    let dialogo = await abrirWizardInsolvencia(page);
    await dialogo.getByRole('tab', { name: /2\. Situación/ }).click();
    await dialogo
      .getByPlaceholder('Ej: Empleado, Independiente')
      .fill(OCUPACION);
    // El autoguardado terminó cuando aparece "Descartar borrador".
    await expect(
      dialogo.getByRole('button', { name: /Descartar borrador/ }),
    ).toBeVisible({ timeout: 15_000 });
    await dialogo.getByRole('button', { name: 'Close' }).click();
    await page
      .getByRole('alertdialog', { name: '¿Salir sin guardar?' })
      .getByRole('button', { name: 'Salir' })
      .click();

    dialogo = await abrirWizardInsolvencia(page);
    await dialogo.getByRole('button', { name: 'Empezar de cero' }).click();
    await dialogo.getByRole('tab', { name: /2\. Situación/ }).click();
    await expect(
      dialogo.getByPlaceholder('Ej: Empleado, Independiente'),
    ).toHaveValue('');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
  });
});
