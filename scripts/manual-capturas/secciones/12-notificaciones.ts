/**
 * Sección 12 — Notificaciones, como la operadora: las del alta del caso de
 * Jorge (sin leer) y dos anteriores ya leídas (`NOTIFICACIONES_OPERADORA`).
 * Antes se borra el aviso de "generación fallida", propio del entorno sin
 * Drive (decisión P2), y se fijan las fechas respecto de la fecha ancla.
 *
 * Figura (docs/manual-usuario/img/12-notificaciones/):
 *   12-1 12-notificaciones-01-centro   centro de notificaciones
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';

const CARPETA = '12-notificaciones';

export async function seccion12Notificaciones(ctx: Contexto): Promise<void> {
  await ctx.quitarAvisosDelEntorno();
  await ctx.normalizarFechas(5);
  const page = await ctx.paginaComo('operadora');
  await page.goto('/notifications');
  const marcar = page.locator('button', {
    hasText: 'Marcar todas como leídas',
  });
  await marcar.waitFor();
  const lista = page
    .locator('[data-slot="card"]')
    .filter({
      has: page.locator('[data-slot="card-title"]', {
        hasText: 'Todas las Notificaciones',
      }),
    })
    .first();
  const primera = lista
    .locator('[data-slot="card-content"] .space-y-4 > *')
    .first();
  await primera.waitFor();
  await esperarEstable(page);
  const campana = page
    .locator('button[aria-label="Notificaciones"]:visible')
    .first();
  await anotar(page, [
    { objetivo: campana, numero: 1, badge: 'izq' },
    { objetivo: marcar, numero: 2, badge: 'izq' },
    { objetivo: primera, numero: 3, badge: 'izq' },
  ]);
  await capturar(page, CARPETA, '12-notificaciones-01-centro');
  await quitarAnotaciones(page);
  await page.close();
}
