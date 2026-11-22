/**
 * Secciones 8.4 y 9 — Reportes, como la administradora (permiso "Ver
 * reportes"). No se exporta: el botón solo se señala.
 *
 * Figuras (docs/manual-usuario/img/09-reportes/):
 *   9-1   09-reportes-01-estado-casos        pestaña Estado de Casos
 *   8.4-1 09-reportes-02-trazabilidad-pagos  pestaña Trazabilidad de Pagos
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';

const CARPETA = '09-reportes';
const N = (sufijo: string) => `09-reportes-${sufijo}`;

export async function seccion09Reportes(ctx: Contexto): Promise<void> {
  const page = await ctx.paginaComo('admin');
  await page.goto('/reports');
  const exportar = () =>
    page.locator('button:visible', { hasText: 'Exportar Excel' }).first();
  await exportar().waitFor();
  await page.waitForTimeout(1500); // gráficos de Recharts
  await esperarEstable(page);

  // 9-1 — Estado de Casos.
  await anotar(page, [
    { objetivo: page.getByRole('tablist'), numero: 1 },
    { objetivo: exportar(), numero: 2, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, N('01-estado-casos'));
  await quitarAnotaciones(page);

  // 8.4-1 — Trazabilidad de Pagos.
  await page.getByRole('tab', { name: 'Trazabilidad de Pagos' }).click();
  const filaLuz = page.getByRole('row', { name: /INSOL-000003/ }).first();
  await filaLuz.waitFor();
  await page.waitForTimeout(1000);
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: exportar(), numero: 1, badge: 'izq' },
    { objetivo: filaLuz, numero: 2, badge: 'izq', holgura: 1 },
  ]);
  await capturar(page, CARPETA, N('02-trazabilidad-pagos'));
  await quitarAnotaciones(page);
  await page.close();
}
