/**
 * Sección 11 — Auditoría, como la administradora. Mezcla las entradas
 * sembradas (`AUDITORIA_SEMBRADA`) con las que deja la corrida (alta del caso
 * de Jorge), llevadas antes a fechas fijas respecto de la fecha ancla.
 *
 * Figura (docs/manual-usuario/img/11-auditoria/):
 *   11-1 11-auditoria-01-bitacora   filtros y registros
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';

const CARPETA = '11-auditoria';

export async function seccion11Auditoria(ctx: Contexto): Promise<void> {
  await ctx.normalizarFechas(5);
  const page = await ctx.paginaComo('admin');
  await page.goto('/audit-log');
  const registros = page
    .locator('[data-slot="card"]')
    .filter({
      has: page.locator('[data-slot="card-title"]', { hasText: 'Registros' }),
    })
    .first();
  const filtros = page
    .locator('[data-slot="card"]')
    .filter({
      has: page.locator('[data-slot="card-title"]', { hasText: 'Filtros' }),
    })
    .first();
  await registros.locator('tbody tr').first().waitFor();
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: filtros, numero: 1, badge: 'arriba-der', holgura: -4 },
    {
      objetivo: registros.locator('tbody tr').first(),
      numero: 2,
      badge: 'izq',
      holgura: 1,
    },
  ]);
  await capturar(page, CARPETA, '11-auditoria-01-bitacora');
  await quitarAnotaciones(page);
  await page.close();
}
