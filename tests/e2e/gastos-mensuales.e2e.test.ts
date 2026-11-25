/**
 * E2E: gastos mensuales por concepto en el wizard de Insolvencia.
 *
 * Llena conceptos (uno prorrateado y una fila de "Otros"), verifica el total en
 * vivo y la tarjeta "Recursos disponibles", crea el caso, lo vuelve a abrir en
 * "Editar caso" y confirma que los valores persistieron tal como se digitaron.
 *
 * SÍ crea un caso en la base de la corrida (en CI, la descartable con seed),
 * igual que "Crear Caso con los datos completos" de
 * case-wizard-errores.e2e.test.ts. Para encontrarlo sin depender del orden de
 * los demás tests en paralelo, el concepto de "Otros" lleva un sufijo único y
 * se busca entre los casos más recientes.
 */

import { test, expect, type Page } from '@playwright/test';

import { loginAs } from './helpers';

const SUFIJO = Date.now().toString(36);
const CONCEPTO_OTRO = `Gas E2E ${SUFIJO}`;

/** Intl de es-CO separa "$" del número con un espacio duro. */
const sinNbsp = (t: string) => t.replace(/ /g, ' ');

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

test.describe('Gastos mensuales por concepto', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAs(page);
  });

  test('llenar conceptos, ver el total, crear y ver los valores al reabrir', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const dialogo = await abrirWizardInsolvencia(page);

    // Mínimos del servidor para crear (mismos que case-wizard-errores).
    await dialogo.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Carlos Rodríguez Silva/ }).click();
    await dialogo.getByLabel('Operador del caso').click();
    await page.getByRole('option').first().click();
    await dialogo
      .getByLabel('Sobreendeudamiento por falta de recursos')
      .click();

    // 2. Situación: gastos.
    await dialogo.getByRole('tab', { name: /2\. Situación/ }).click();
    const arriendo = dialogo.getByLabel('Arriendo', { exact: true });
    await arriendo.fill('800000');
    await expect(arriendo).toHaveValue('800.000');
    await dialogo.getByLabel('Impuestos', { exact: true }).fill('1,200,000');
    await dialogo.getByLabel('Impuestos', { exact: true }).blur();
    await expect(dialogo.getByLabel('Impuestos', { exact: true })).toHaveValue(
      '1.200.000',
    );
    await expect(dialogo.getByTestId('gasto-IMPUESTOS-mensual')).toContainText(
      '100.000',
    );

    await dialogo.getByRole('button', { name: /Agregar otro gasto/ }).click();
    const concepto = dialogo.getByLabel('Concepto del gasto 1');
    await expect(concepto).toBeFocused();
    await concepto.fill(CONCEPTO_OTRO);
    await dialogo.getByLabel('Valor mensual del gasto 1').fill('45000');

    const total = dialogo.getByLabel('Total gastos mensuales');
    await expect
      .poll(async () => sinNbsp(await total.inputValue()))
      .toBe('$ 945.000');
    // La tarjeta "Recursos disponibles" usa el mismo total (sin ingresos
    // cargados, "Disponible" queda en -945.000).
    const recursos = dialogo.getByText('Recursos disponibles').locator('..');
    await expect(recursos.getByText(/^\$\s945\.000$/)).toBeVisible();
    await expect(recursos.getByText(/^-\$\s945\.000$/)).toBeVisible();

    // Un decimal real se rechaza al salir del campo.
    const agua = dialogo.getByLabel('Agua', { exact: true });
    await agua.fill('1500.50');
    await agua.blur();
    await expect(dialogo.getByText(/pesos enteros/)).toBeVisible();
    await agua.fill('');
    await agua.blur();
    await expect(dialogo.getByText(/pesos enteros/)).toHaveCount(0);

    // Acreedor y anexos obligatorios.
    await dialogo.getByRole('tab', { name: /3\. Acreedores/ }).click();
    await dialogo.getByRole('button', { name: /Agregar Acreedor/ }).click();
    await dialogo
      .getByPlaceholder('Nombre de la entidad o persona que prestó el dinero')
      .fill('Banco E2E');
    await dialogo.locator('input[name="debts.0.interestRate"]').fill('24');
    await dialogo.getByText('Seleccione tipo').click();
    await page.getByRole('option', { name: 'Personal' }).click();
    await dialogo.getByRole('tab', { name: /7\. Documentos/ }).click();
    const anexos = dialogo.locator('input[type="file"]');
    for (let i = 0; i < 3; i++) {
      await anexos.nth(i).setInputFiles({
        name: `anexo-${i}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });
    }

    await dialogo.getByRole('button', { name: 'Crear Caso' }).click();
    await expect(page.getByText(/Caso creado/).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(dialogo).toBeHidden();

    // Recargar y abrir el caso en edición: buscarlo entre los más recientes.
    await page.reload();
    const botonesEditar = page.getByTitle('Editar caso');
    await expect(botonesEditar.first()).toBeVisible({ timeout: 15_000 });
    const candidatos = Math.min(await botonesEditar.count(), 5);
    let encontrado = false;
    for (let i = 0; i < candidatos && !encontrado; i++) {
      await botonesEditar.nth(i).click();
      const edicion = page.getByRole('dialog', { name: /Editar Caso/ });
      await expect(edicion).toBeVisible({ timeout: 10_000 });
      await edicion.getByRole('tab', { name: /Situación/ }).click();
      // El diálogo carga el caso después de abrir: se espera a que el
      // formulario muestre la fila de "Otros" de este caso, con tope.
      const fila = edicion.getByLabel('Concepto del gasto 1');
      const esEste = await expect(fila)
        .toHaveValue(CONCEPTO_OTRO, { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (esEste) {
        encontrado = true;
        await expect(
          edicion.getByLabel('Arriendo', { exact: true }),
        ).toHaveValue('800.000');
        await expect(
          edicion.getByLabel('Impuestos', { exact: true }),
        ).toHaveValue('1.200.000');
        await expect(
          edicion.getByLabel('Valor mensual del gasto 1'),
        ).toHaveValue('45.000');
        await expect
          .poll(async () =>
            sinNbsp(
              await edicion.getByLabel('Total gastos mensuales').inputValue(),
            ),
          )
          .toBe('$ 945.000');
      }
      await page.keyboard.press('Escape');
      await expect(edicion).toBeHidden();
    }
    expect(encontrado).toBe(true);
  });
});
