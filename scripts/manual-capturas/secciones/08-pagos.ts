/**
 * Sección 8 — Trazabilidad de pagos, como la administradora (es quien tiene
 * el permiso "Registrar pagos").
 *
 * Figuras (docs/manual-usuario/img/08-pagos/):
 *   8.1-1 08-pagos-01-sin-cronograma      caso sin cronograma (INSOL-000001)
 *   8.1-2 08-pagos-02-cronograma          cronograma del acuerdo de Luz
 *   8.2-1 08-pagos-03-registrar-pago      diálogo de pago de la cuota 7
 *   8.2-2 08-pagos-04-comprobante-pesado  comprobante de más de 4 MB rechazado
 *
 * Nada se envía: el diálogo de pago se cancela (subir el comprobante
 * intentaría Drive). El cronograma viene sembrado (`CRONOGRAMA_LUZ`), con
 * comprobantes en `https://example.invalid/…`.
 */

import type { Locator, Page } from '@playwright/test';

import {
  anotar,
  capturar,
  desplazarAlInicio,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { pdfSintetico } from './04-1-crear-caso';

const CARPETA = '08-pagos';
const N = (sufijo: string) => `08-pagos-${sufijo}`;

async function abrirPagos(page: Page, numero: string): Promise<Locator> {
  await page.goto('/cases');
  const fila = page.getByRole('row', { name: new RegExp(numero) });
  await fila.waitFor();
  await fila.getByTitle('Ver detalles').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: /Pagos/ }).click();
  // Sin cronograma el título es Seguimiento de Pagos; con cronograma, la
  // tabla Cronograma de Pagos.
  await dlg
    .getByText(/^(Seguimiento de Pagos|Cronograma de Pagos)$/)
    .first()
    .waitFor();
  await esperarEstable(page);
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  return dlg;
}

export async function seccion08Pagos(ctx: Contexto): Promise<void> {
  const page = await ctx.paginaComo('admin');

  // 01 — Caso sin cronograma.
  let dlg = await abrirPagos(page, 'INSOL-000001');
  const seguimiento = dlg.locator('[data-slot="card"]', {
    has: page.getByText('Seguimiento de Pagos', { exact: true }),
  });
  await anotar(page, [
    {
      objetivo: dlg.getByRole('button', {
        name: 'Generar Cronograma de Pagos',
      }),
      numero: 1,
      badge: 'arriba-izq',
    },
    {
      objetivo: dlg.getByRole('button', { name: 'Registrar Pago Manual' }),
      numero: 2,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('01-sin-cronograma'), {
    recorte: seguimiento,
    margen: 12,
  });
  await quitarAnotaciones(page);
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'hidden' });

  // 02 — Cronograma con cuotas pagadas, vencida y pendientes.
  dlg = await abrirPagos(page, 'INSOL-000003');
  const resumen = dlg
    .getByText('Total', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  const filaCuota = (n: number) =>
    dlg.getByRole('row').filter({
      has: page.getByRole('cell', { name: String(n), exact: true }),
    });
  await desplazarAlInicio(dlg.getByRole('tablist'), 16);
  await anotar(page, [
    { objetivo: resumen, numero: 1, badge: 'arriba-izq', holgura: -6 },
    { objetivo: filaCuota(6), numero: 2, badge: 'arriba-der', holgura: 1 },
    { objetivo: filaCuota(7), numero: 3, badge: 'arriba-izq', holgura: 1 },
    {
      objetivo: filaCuota(7).getByRole('button', { name: 'Pagar' }),
      numero: 4,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('02-cronograma'), {
    recorte: [dlg.getByRole('tablist'), filaCuota(9)],
    anchoDe: dlg,
    margen: 12,
  });
  await quitarAnotaciones(page);

  // 03 — Diálogo de pago de la cuota 7, diligenciado. Se cancela.
  await filaCuota(7).getByRole('button', { name: 'Pagar' }).click();
  const pago = page.getByRole('dialog', { name: 'Registrar Pago' });
  await pago.waitFor();
  const metodo = pago.getByRole('combobox');
  await metodo.click();
  await page.getByRole('option', { name: 'PSE' }).click();
  const observaciones = pago.locator('textarea');
  await observaciones.fill(
    'Pago de la cuota 7 realizado por PSE el día siguiente al vencimiento.',
  );
  const archivo = pago.locator('input[type=file]');
  await archivo.setInputFiles({
    name: 'comprobante-cuota-07.pdf',
    mimeType: 'application/pdf',
    buffer: pdfSintetico('Comprobante de pago - cuota 7 - ejemplo'),
  });
  await observaciones.blur();
  await esperarEstable(page);
  await anotar(page, [
    {
      objetivo: pago.locator('input[type=number]'),
      numero: 1,
      badge: 'arriba-der',
    },
    { objetivo: metodo, numero: 2, badge: 'der' },
    { objetivo: observaciones, numero: 3, badge: 'arriba-der' },
    { objetivo: archivo.locator('xpath=..'), numero: 4, badge: 'arriba-der' },
    {
      objetivo: pago.getByRole('button', { name: 'Registrar Pago' }),
      numero: 5,
      badge: 'arriba-izq',
    },
  ]);
  await capturar(page, CARPETA, N('03-registrar-pago'), {
    recorte: pago,
    margen: 0,
  });
  await quitarAnotaciones(page);

  // 04 — Comprobante de más de 4 MB: se rechaza al elegirlo.
  await archivo.setInputFiles({
    name: 'comprobante-cuota-07-escaneado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.concat([
      pdfSintetico('Comprobante escaneado'),
      Buffer.alloc(5_450_000, 0x20),
    ]),
  });
  const error = pago.locator('p.text-red-600');
  await error.waitFor();
  await esperarEstable(page);
  await anotar(page, [{ objetivo: error, numero: 1, badge: 'arriba-der' }]);
  await capturar(page, CARPETA, N('04-comprobante-pesado'), {
    recorte: pago,
    margen: 0,
  });
  await quitarAnotaciones(page);
  await pago.getByRole('button', { name: 'Cancelar' }).click();

  await page.close();
}
