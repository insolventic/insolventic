/**
 * Sección 5 — Deudores y acreedores, como la operadora.
 *
 * Figuras (docs/manual-usuario/img/05-deudores/):
 *   5-1 05-deudores-01-lista           lista de deudores
 *   5-2 05-deudores-02-nuevo-deudor    alta de un deudor (se cancela)
 *   5-3 05-deudores-03-acreedores      lista de acreedores
 *
 * Nada se guarda: el diálogo de alta se cierra sin enviar.
 */

import type { Page } from '@playwright/test';

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { DEUDOR_EJEMPLO } from '../datos';

const CARPETA = '05-deudores';

/** Deudor que solo se escribe en el formulario; nunca se guarda. */
const NUEVO_DEUDOR = { nombre: 'Marta Lucía Herrera Cano', cedula: '52987341' };
const N = (sufijo: string) => `05-deudores-${sufijo}`;

async function sinFoco(page: Page): Promise<void> {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
}

export async function seccion05DeudoresAcreedores(
  ctx: Contexto,
): Promise<void> {
  const page = await ctx.paginaComo('operadora');

  // 01 — Lista de deudores.
  await page.goto('/debtors');
  const filaJorge = page.getByRole('row', {
    name: new RegExp(DEUDOR_EJEMPLO.nombre),
  });
  await filaJorge.waitFor();
  await esperarEstable(page);
  const nuevoDeudor = page.locator('button', { hasText: 'Nuevo Deudor' });
  await anotar(page, [
    { objetivo: nuevoDeudor, numero: 1, badge: 'izq' },
    {
      objetivo: page
        .getByPlaceholder('Buscar deudores...')
        .locator('xpath=../..'),
      numero: 2,
    },
    {
      objetivo: filaJorge.getByRole('cell').last(),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('01-lista'));
  await quitarAnotaciones(page);

  // 02 — Alta de un deudor. Se cierra sin enviar.
  await nuevoDeudor.click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('heading', { name: 'Nuevo Deudor' }).waitFor();
  // Datos sintéticos en los dos campos cuyos placeholders de la app traen un
  // nombre y una cédula de ejemplo: así la figura no muestra ninguno de los dos.
  await dlg.getByPlaceholder('María González Pérez').fill(NUEVO_DEUDOR.nombre);
  await dlg.getByPlaceholder('52123456').fill(NUEVO_DEUDOR.cedula);
  await sinFoco(page);
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: dlg.getByRole('tablist'), numero: 1 },
    {
      objetivo: dlg.locator('[data-slot="card"]').first(),
      numero: 2,
      badge: 'arriba-der',
      holgura: -4,
    },
    {
      objetivo: dlg.getByRole('button', { name: 'Guardar Deudor' }),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('02-nuevo-deudor'), {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'hidden' });

  // 03 — Lista de acreedores.
  await page.goto('/creditors');
  const filaBanco = page.getByRole('row', { name: /Banco Andino/ }).first();
  await filaBanco.waitFor();
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: page.locator('button', { hasText: 'Nuevo Acreedor' }),
      numero: 1,
      badge: 'izq',
    },
    {
      objetivo: page
        .getByPlaceholder('Buscar acreedores...')
        .locator('xpath=../..'),
      numero: 2,
    },
    {
      objetivo: filaBanco.getByRole('cell').last(),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('03-acreedores'));
  await quitarAnotaciones(page);
  await page.close();
}
