/**
 * Sección 4 (resto) — listado, papelera y cambio de fase.
 *
 * Figuras (docs/manual-usuario/img/04-casos/):
 *   4.2-1   04-casos-listado-01-vista-general        listado, operadora
 *   4.3.1-1 04-casos-papelera-01-eliminar            diálogo "Eliminar Caso"
 *   4.3.1-2 04-casos-papelera-02-operadora           papelera: solo Restaurar
 *   4.3.1-3 04-casos-papelera-03-administrador       papelera: también borrar del todo
 *   4.3.1-4 04-casos-papelera-04-confirmar-borrado   confirmación del borrado definitivo
 *   4.4-1   04-casos-fases-01-transiciones           transiciones válidas
 *   4.4-2   04-casos-fases-02-subtipo                Fracaso: subtipo y fecha
 *
 * Nada de esta sección cambia la base: los diálogos se cancelan. El caso de
 * la papelera (CONC-000002) viene sembrado, con fecha estable.
 */

import type { Locator, Page } from '@playwright/test';

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { DEUDOR_EJEMPLO } from '../datos';

const CARPETA = '04-casos';

async function abrirListado(
  ctx: Contexto,
  rol: 'operadora' | 'admin',
): Promise<Page> {
  const page = await ctx.paginaComo(rol);
  await page.goto('/cases');
  await page.getByRole('row', { name: /INSOL-000001/ }).waitFor();
  await esperarEstable(page);
  return page;
}

function fila(page: Page, texto: string | RegExp): Locator {
  return page.getByRole('row', { name: texto });
}

/**
 * Radix enfoca el primer control al abrir un diálogo (suele ser la X de
 * cerrar) y el anillo de foco saldría en la figura. Quitar el foco no cambia
 * nada más del estado.
 */
async function sinFoco(page: Page): Promise<void> {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
}

/** 4.2 — Listado de casos con sus controles. */
export async function seccion042Listado(ctx: Contexto): Promise<void> {
  const page = await abrirListado(ctx, 'operadora');
  const primera = fila(page, new RegExp(DEUDOR_EJEMPLO.nombre));
  const filtros = page
    .getByPlaceholder('Buscar por nombre, ID o cédula...')
    .locator('xpath=../..');
  await anotar(page, [
    {
      objetivo: page.locator('button', { hasText: 'Crear nuevo caso' }),
      numero: 1,
      badge: 'arriba-der',
    },
    {
      objetivo: page.getByRole('button', { name: 'Papelera' }),
      numero: 2,
      badge: 'izq',
    },
    { objetivo: filtros, numero: 3 },
    {
      objetivo: primera.getByRole('cell').last(),
      numero: 4,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-listado-01-vista-general');
  await quitarAnotaciones(page);
  await page.close();
}

/** 4.3.1 — Eliminar y restaurar (papelera). */
export async function seccion0431Papelera(ctx: Contexto): Promise<void> {
  // 01 — Diálogo "Eliminar Caso", con el número escrito. Se cancela.
  let page = await abrirListado(ctx, 'operadora');
  await fila(page, /INSOL-000004/)
    .getByTitle('Eliminar caso')
    .click();
  let dlg = page.getByRole('dialog');
  await dlg.waitFor();
  const confirmar = dlg.locator('#confirmar-numero-caso');
  await confirmar.fill('INSOL-000004');
  await confirmar.blur();
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: dlg
        .getByText('Información del Caso', { exact: true })
        .locator('xpath=..'),
      numero: 1,
    },
    { objetivo: confirmar, numero: 2, badge: 'arriba-der' },
    {
      objetivo: dlg.getByRole('button', { name: 'Eliminar Caso' }),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-papelera-01-eliminar', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await dlg.waitFor({ state: 'hidden' });

  // 02 — Papelera vista por la operadora: puede restaurar, no borrar del todo.
  await page.getByRole('button', { name: 'Papelera' }).click();
  dlg = page.getByRole('dialog');
  let filaPapelera = dlg.getByRole('row', { name: /CONC-000002/ });
  await filaPapelera.waitFor();
  await sinFoco(page);
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: filaPapelera.getByRole('cell').nth(3), numero: 1 },
    {
      objetivo: filaPapelera.getByRole('button', { name: 'Restaurar' }),
      numero: 2,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-papelera-02-operadora', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await page.close();

  // 03 — Papelera vista por la administradora: aparece el borrado definitivo.
  page = await abrirListado(ctx, 'admin');
  await page.getByRole('button', { name: 'Papelera' }).click();
  dlg = page.getByRole('dialog');
  filaPapelera = dlg.getByRole('row', { name: /CONC-000002/ });
  await filaPapelera.waitFor();
  await sinFoco(page);
  await esperarEstable(page);
  const borrar = dlg.getByRole('button', {
    name: 'Eliminar definitivamente CONC-000002',
  });
  await anotar(page, [
    {
      objetivo: filaPapelera.getByRole('button', { name: 'Restaurar' }),
      numero: 1,
      badge: 'izq',
    },
    { objetivo: borrar, numero: 2, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, '04-casos-papelera-03-administrador', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);

  // 04 — Confirmación del borrado definitivo. Se vuelve atrás sin borrar.
  await borrar.click();
  const purga = dlg.locator('#confirmar-purga');
  await purga.waitFor();
  await sinFoco(page);
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: dlg
        .getByText(/No se puede deshacer/)
        .locator('xpath=ancestor::div[contains(@class,"bg-")][1]'),
      numero: 1,
    },
    { objetivo: purga, numero: 2, badge: 'arriba-der' },
    {
      objetivo: dlg.getByRole('button', {
        name: 'Eliminar definitivamente',
        exact: true,
      }),
      numero: 3,
      badge: 'arriba-izq',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-papelera-04-confirmar-borrado', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await dlg.getByRole('button', { name: 'Volver' }).click();
  await page.close();
}

/** 4.4 — Cambio de fase desde la acción de la fila. */
export async function seccion044Fases(ctx: Contexto): Promise<void> {
  const page = await abrirListado(ctx, 'operadora');

  // 01 — Caso de Jorge (fase Inicial): solo las transiciones válidas.
  await fila(page, new RegExp(DEUDOR_EJEMPLO.nombre))
    .getByTitle('Cambiar fase')
    .click();
  let dlg = page.getByRole('dialog');
  await dlg.getByText('Transiciones disponibles:').waitFor();
  await sinFoco(page);
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: dlg.getByText('Fase actual:').locator('xpath=..'),
      numero: 1,
      badge: 'arriba-der',
    },
    {
      objetivo: dlg.getByText('Transiciones disponibles:').locator('xpath=..'),
      numero: 2,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-fases-01-transiciones', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'hidden' });

  // 02 — Caso en negociación hacia Fracaso: pide subtipo y fecha. Se cancela.
  await fila(page, /INSOL-000001/)
    .getByTitle('Cambiar fase')
    .click();
  dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /Fracaso/ }).click();
  const subtipo = dlg.locator('#phase-transition-subtype');
  await subtipo.click();
  await page.getByRole('option', { name: 'Inasistencia del Deudor' }).click();
  await sinFoco(page);
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: subtipo, numero: 1, badge: 'arriba-der' },
    {
      objetivo: dlg.locator('#phase-transition-date'),
      numero: 2,
      badge: 'arriba-der',
    },
    {
      objetivo: dlg.getByRole('button', { name: 'Confirmar cambio de fase' }),
      numero: 3,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, '04-casos-fases-02-subtipo', {
    recorte: dlg,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  await page.close();
}
