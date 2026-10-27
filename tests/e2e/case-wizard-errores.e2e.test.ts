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
 * El primer bloque no crea nada. El segundo ("Crear Caso" con los datos
 * completos) sí crea un caso por wizard: ver su encabezado.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

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

// ─── Los 3 wizards: "Siguiente" pasa, "Crear Caso" bloquea o crea ──────────
//
// Decisión de producto: "Siguiente" no bloquea (marca la pestaña que se deja
// y avanza). "Crear Caso" sí: con errores no crea, marca las pestañas, lleva
// a la primera con error y enfoca su primer campo; completo, crea.
//
// "Crear completo" SÍ crea un caso en la base de la corrida (en CI es una
// base descartable con seed). Sin credenciales de Drive, la generación de
// documentos y la subida de anexos fallan sin salir a Google; el caso queda
// creado igual y el toast lo dice.

const WIZARDS = [
  {
    menu: 'Insolvencia',
    segunda: '2. Situación',
    ultima: /7\. Documentos/,
  },
  { menu: 'Conciliación', segunda: '2. Partes', ultima: /3\. Solicitud/ },
  { menu: 'Acuerdos de apoyo', segunda: '2. Partes', ultima: /3\. Acuerdo/ },
] as const;

async function abrirWizard(page: Page, menu: string) {
  await page.goto('/cases');
  await page.getByRole('button', { name: /Crear nuevo caso/ }).click();
  await page.getByRole('menuitem', { name: menu }).click();
  const dialogo = page.getByRole('dialog', { name: 'Crear Nuevo Caso' });
  await expect(dialogo).toBeVisible({ timeout: 10_000 });
  await expect(dialogo.getByText('Cargando deudores...')).toHaveCount(0, {
    timeout: 10_000,
  });
  return dialogo;
}

async function elegirPrimeraOpcion(page: Page, combo: Locator) {
  await combo.click();
  await page.getByRole('option').first().click();
}

test.describe('Wizards de casos — "Siguiente" pasa, "Crear Caso" bloquea o crea', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  for (const w of WIZARDS) {
    test(`${w.menu}: "Siguiente" con la pestaña vacía avanza y marca la pestaña`, async ({
      page,
    }) => {
      const dialogo = await abrirWizard(page, w.menu);

      await dialogo.getByRole('button', { name: 'Siguiente' }).click();

      await expect(
        dialogo.getByRole('tab', { name: w.segunda, selected: true }),
      ).toBeVisible();
      await expect(
        dialogo.getByRole('tab', { name: /1\. Solicitante/ }).locator('svg'),
      ).toHaveCount(1);
      await expect(page.getByText('Campos incompletos')).toHaveCount(0);
    });

    test(`${w.menu}: "Crear Caso" con errores no crea, lleva a la primera pestaña con error y enfoca el campo`, async ({
      page,
    }) => {
      const dialogo = await abrirWizard(page, w.menu);

      await dialogo.getByRole('tab', { name: w.ultima }).click();
      await dialogo.getByRole('button', { name: 'Crear Caso' }).click();

      await expect(page.getByText('Campos incompletos')).toBeVisible();
      await expect(dialogo).toBeVisible();
      await expect(
        dialogo.getByRole('tab', { name: /1\. Solicitante/, selected: true }),
      ).toBeVisible();
      // Primer campo con error de "1. Solicitante": el selector de deudor.
      const selectorDeudor = dialogo.getByRole('combobox').first();
      await expect(selectorDeudor).toBeFocused();
      await expect(selectorDeudor).toHaveAttribute('aria-invalid', 'true');
    });

    test(`${w.menu}: "Crear Caso" con los datos completos crea`, async ({
      page,
    }) => {
      const dialogo = await abrirWizard(page, w.menu);

      // Deudor soltero del seed: con uno casado o en unión libre el servidor
      // exige además los datos del cónyuge (validateSpouseData).
      await dialogo.getByRole('combobox').first().click();
      await page
        .getByRole('option', { name: /Carlos Rodríguez Silva/ })
        .click();
      await elegirPrimeraOpcion(page, dialogo.getByLabel('Operador del caso'));

      if (w.menu === 'Insolvencia') {
        // Lo que además exige el servidor para insolvencia: una causa y un
        // acreedor (nombre, tipo y tasa); y el cliente, los 3 anexos.
        await dialogo
          .getByLabel('Sobreendeudamiento por falta de recursos')
          .click();
        await dialogo.getByRole('tab', { name: /3\. Acreedores/ }).click();
        await dialogo.getByRole('button', { name: /Agregar Acreedor/ }).click();
        await dialogo
          .getByPlaceholder(
            'Nombre de la entidad o persona que prestó el dinero',
          )
          .fill('Banco E2E');
        await dialogo.locator('input[name="debts.0.interestRate"]').fill('24');
        await dialogo.getByText('Seleccione tipo').click();
        await page.getByRole('option', { name: 'Personal' }).click();

        await dialogo.getByRole('tab', { name: w.ultima }).click();
        const anexos = dialogo.locator('input[type="file"]');
        for (let i = 0; i < 3; i++) {
          await anexos.nth(i).setInputFiles({
            name: `anexo-${i}.pdf`,
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
          });
        }
      } else {
        await dialogo.getByRole('tab', { name: w.ultima }).click();
      }

      await dialogo.getByRole('button', { name: 'Crear Caso' }).click();

      await expect(page.getByText(/Caso creado/).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(dialogo).toBeHidden();
      await expect(page.getByText('Campos incompletos')).toHaveCount(0);
    });
  }
});

test.describe('Wizard de Insolvencia — pestaña "7. Documentos"', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test('los obligatorios entran neutros y se pintan en rojo solo al salir de la pestaña sin cargarlos', async ({
    page,
  }) => {
    const dialogo = await abrirWizard(page, 'Insolvencia');

    await dialogo.getByRole('tab', { name: /7\. Documentos/ }).click();
    await expect(dialogo.getByText('Obligatorio', { exact: true })).toHaveCount(
      3,
    );
    await expect(dialogo.locator('[data-falta]')).toHaveCount(0);

    await dialogo.getByRole('tab', { name: /1\. Solicitante/ }).click();
    await dialogo.getByRole('tab', { name: /7\. Documentos/ }).click();

    await expect(dialogo.locator('[data-falta]')).toHaveCount(3);
    await expect(dialogo.getByLabel('Falta este documento')).toHaveCount(3);
  });
});
