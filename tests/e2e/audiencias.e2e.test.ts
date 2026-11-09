/**
 * E2E: programar, reprogramar y cancelar una audiencia desde la pantalla.
 *
 * Usa el caso ACU-2025-003 del seed, que arranca sin audiencia, y lo deja como
 * estaba: el último paso cancela lo que se programó.
 */

import { test, expect, type Page } from '@playwright/test';

import { loginAs } from './helpers';

const CASO = 'ACU-2025-003';

function enNDias(cuantos: number) {
  const d = new Date(Date.now() + cuantos * 24 * 60 * 60 * 1000);
  const iso = d.toISOString().slice(0, 10);
  const [anio, mes, dia] = iso.split('-');
  return {
    iso,
    visible: `${dia}/${mes}/${anio}`,
    dia: Number(dia),
    mes: Number(mes),
  };
}

function filaDelCaso(page: Page) {
  return page.getByRole('row').filter({ hasText: CASO });
}

async function abrirDialogo(page: Page) {
  await filaDelCaso(page).getByTitle('Programar audiencia').click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  return dialogo;
}

test('programar, ver en el calendario, reprogramar y cancelar', async ({
  page,
}) => {
  await loginAs(page);
  const primera = enNDias(10);
  const segunda = enNDias(12);

  await page.goto('/cases');
  await expect(filaDelCaso(page)).toContainText('No programada', {
    timeout: 30_000,
  });

  // Programar
  let dialogo = await abrirDialogo(page);
  await expect(
    dialogo.getByRole('heading', { name: 'Programar audiencia' }),
  ).toBeVisible();
  await dialogo.getByLabel('Fecha *').fill(primera.iso);
  await dialogo.getByLabel('Hora *').fill('09:30');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(filaDelCaso(page)).toContainText(
    `${primera.visible} a las 09:30`,
  );

  // Reprogramar
  dialogo = await abrirDialogo(page);
  await expect(
    dialogo.getByRole('heading', { name: 'Reprogramar audiencia' }),
  ).toBeVisible();
  await expect(dialogo.getByLabel('Fecha *')).toHaveValue(primera.iso);
  await dialogo.getByLabel('Fecha *').fill(segunda.iso);
  await dialogo.getByLabel('Hora *').fill('15:00');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(filaDelCaso(page)).toContainText(
    `${segunda.visible} a las 15:00`,
  );

  // Se ve en el calendario, en su día
  await page.goto('/calendar');
  const main = page.locator('main');
  await expect(
    main.getByRole('heading', { name: 'Calendario de Audiencias' }),
  ).toBeVisible();
  if (segunda.mes !== new Date().getMonth() + 1) {
    await main.getByRole('button').nth(1).click();
  }
  await main
    .getByRole('button', { name: String(segunda.dia), exact: true })
    .click();
  await expect(main.getByText(CASO).first()).toBeVisible();
  await expect(main.getByText('15:00').first()).toBeVisible();

  // Cancelar
  await page.goto('/cases');
  dialogo = await abrirDialogo(page);
  await dialogo.getByRole('button', { name: 'Cancelar audiencia' }).click();
  await dialogo.getByRole('button', { name: 'Sí, cancelar audiencia' }).click();
  await expect(dialogo).toBeHidden();
  await expect(filaDelCaso(page)).toContainText('No programada');
});

test('quien no puede editar casos ve el botón deshabilitado', async ({
  page,
}) => {
  await loginAs(page, { email: 'maria.gonzalez@insolventic.com' });
  await page.goto('/cases');
  const boton = filaDelCaso(page).getByTitle('Programar audiencia');
  await expect(boton).toBeVisible({ timeout: 30_000 });
  await expect(boton).toBeDisabled();
});

test.describe('quién abre el calendario', () => {
  for (const [rol, email] of [
    ['Operadora', 'sofia.torres@insolventic.com'],
    ['Abogado', 'maximiliano.jaramillo@insolventic.com'],
  ]) {
    test(`${rol}: lo abre, y su tarjeta está en el dashboard`, async ({
      page,
    }) => {
      await loginAs(page, { email });
      await expect(
        page.getByText('Calendario de audiencias programadas'),
      ).toBeVisible();
      await page.goto('/calendar');
      await expect(page).toHaveURL(/\/calendar/);
      await expect(
        page.getByRole('heading', { name: 'Calendario de Audiencias' }),
      ).toBeVisible({ timeout: 30_000 });
    });
  }

  test('Secretaria: vuelve al dashboard', async ({ page }) => {
    await loginAs(page, { email: 'maria.gonzalez@insolventic.com' });
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test('la fase "Audiencia programada" se habilita al programar', async ({
  page,
}) => {
  await loginAs(page);
  await page.goto('/cases');
  // INS-2025-001 (En negociación) es el que puede pasar a esa fase; el seed le
  // deja una fecha pasada, que no cuenta como audiencia programada.
  const caso = page.getByRole('row').filter({ hasText: 'INS-2025-001' });
  await expect(caso).toBeVisible({ timeout: 30_000 });

  await caso.getByTitle('Cambiar fase').click();
  let dialogo = page.getByRole('dialog');
  const opcion = dialogo.getByRole('button', { name: /Audiencia programada/ });
  await expect(opcion).toBeDisabled();
  await page.keyboard.press('Escape');

  await caso.getByTitle('Programar audiencia').click();
  dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Fecha *').fill(enNDias(15).iso);
  await dialogo.getByLabel('Hora *').fill('11:00');
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(caso).toContainText(`${enNDias(15).visible} a las 11:00`);

  await caso.getByTitle('Cambiar fase').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Audiencia programada/ })
    .click();
  await expect(caso).toContainText('Audiencia programada');

  // Cancelar lo devuelve a "En negociación".
  await caso.getByTitle('Programar audiencia').click();
  dialogo = page.getByRole('dialog');
  await dialogo.getByRole('button', { name: 'Cancelar audiencia' }).click();
  await dialogo.getByRole('button', { name: 'Sí, cancelar audiencia' }).click();
  await expect(dialogo).toBeHidden();
  await expect(caso).toContainText('En negociación');
});
