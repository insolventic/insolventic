/**
 * E2E: el wizard de Insolvencia no muestra errores al abrir.
 *
 * Regla de producto: los errores de validación se muestran solo después de una
 * acción del usuario (salir de un campo, "Siguiente", "Crear Caso"), nunca al
 * abrir. En producción se veían sin que el usuario guardara: "La deuda total
 * es requerida" en rojo, el ícono de error en "1. Solicitante" y el toast
 * "Campos incompletos".
 *
 * Dos de las causas solo se ven en un navegador real, por eso este E2E:
 *   - el botón "Crear nuevo deudor" era submit implícito del formulario;
 *   - "Siguiente" en la penúltima pestaña enviaba el formulario porque React
 *     convertía ese mismo <button> en submit antes de la acción por defecto
 *     del clic (jsdom no reproduce ese orden).
 *
 * No crea nada: ningún paso llega a enviar un formulario válido.
 */

import { test, expect, type Page } from '@playwright/test';

import { loginAs } from './helpers';

async function abrirWizardInsolvencia(page: Page) {
  await page.goto('/cases');
  await page.getByRole('button', { name: /Crear nuevo caso/ }).click();
  await page.getByRole('menuitem', { name: 'Insolvencia' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Crear Nuevo Caso' });
  await expect(dialogo).toBeVisible({ timeout: 10_000 });
  // Que termine la carga de deudores/usuarios del efecto de apertura.
  await expect(dialogo.getByText('Cargando deudores...')).toHaveCount(0, {
    timeout: 10_000,
  });
  return dialogo;
}

/** Ningún mensaje de error de campo, ícono de pestaña ni toast. */
async function esperarSinErrores(page: Page) {
  const dialogo = page.getByRole('dialog', { name: 'Crear Nuevo Caso' });
  await expect(dialogo.locator('p.text-destructive')).toHaveCount(0);
  await expect(dialogo.getByRole('tab').locator('svg')).toHaveCount(0);
  await expect(page.getByText('Campos incompletos')).toHaveCount(0);
  await expect(page.getByText('La deuda total es requerida')).toHaveCount(0);
}

test.describe('Wizard de Insolvencia — errores solo tras la acción', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test('al abrir no hay errores visibles', async ({ page }) => {
    await abrirWizardInsolvencia(page);
    await esperarSinErrores(page);
  });

  test('"Crear nuevo deudor" abre su diálogo sin errores en ninguno de los dos', async ({
    page,
  }) => {
    await abrirWizardInsolvencia(page);

    await page.getByTitle('Crear nuevo deudor').click();
    const deudor = page.getByRole('dialog', { name: 'Crear Nuevo Deudor' });
    await expect(deudor).toBeVisible();

    await expect(deudor.getByText('El nombre es obligatorio')).toHaveCount(0);
    await esperarSinErrores(page);
  });

  test('recorrer el wizard con "Siguiente" llega a "7. Documentos" sin enviarlo', async ({
    page,
  }) => {
    const dialogo = await abrirWizardInsolvencia(page);
    const siguiente = dialogo.getByRole('button', { name: 'Siguiente' });

    for (let i = 0; i < 6; i++) {
      await siguiente.click();
    }

    await expect(
      dialogo.getByRole('tab', { name: '7. Documentos', selected: true }),
    ).toBeVisible();
    await expect(
      dialogo.getByRole('button', { name: 'Crear Caso' }),
    ).toBeVisible();
    await expect(page.getByText('Campos incompletos')).toHaveCount(0);
  });

  test('"Crear Caso" con campos vacíos sí muestra los errores', async ({
    page,
  }) => {
    const dialogo = await abrirWizardInsolvencia(page);

    await dialogo.getByRole('tab', { name: /7\. Documentos/ }).click();
    await dialogo.getByRole('button', { name: 'Crear Caso' }).click();

    await expect(page.getByText('Campos incompletos')).toBeVisible();
    await expect(
      dialogo.getByRole('tab', { name: /1\. Solicitante/, selected: true }),
    ).toBeVisible();
    await expect(dialogo.getByText('El operador es requerido')).toBeVisible();
  });
});
