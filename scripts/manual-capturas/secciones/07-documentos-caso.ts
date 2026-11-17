/**
 * Sección 7 — Documentos del caso: pestaña "8. Documentos" del detalle del
 * caso de Jorge, como la operadora. Los documentos listados son los sembrados
 * (`DOCUMENTOS_JORGE`, enlaces a `https://example.invalid/…`, decisión P2).
 * No se pulsa ningún botón de generar.
 *
 * Figuras (docs/manual-usuario/img/07-documentos-caso/):
 *   7-1 07-documentos-caso-01-pestana     pestaña y estado de los documentos
 *   7-2 07-documentos-caso-02-por-etapa   generación por etapa
 *   7-3 07-documentos-caso-03-generados   lista de documentos generados
 */

import type { Locator } from '@playwright/test';

import {
  anotar,
  capturar,
  desplazarAlInicio,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { DEUDOR_EJEMPLO } from '../datos';

const CARPETA = '07-documentos-caso';
const N = (sufijo: string) => `07-documentos-caso-${sufijo}`;

export async function seccion07DocumentosCaso(ctx: Contexto): Promise<void> {
  await ctx.sembrarDocumentosDeJorge();
  const page = await ctx.paginaComo('operadora');
  await page.goto('/cases');
  const fila = page.getByRole('row', {
    name: new RegExp(DEUDOR_EJEMPLO.nombre),
  });
  await fila.waitFor();
  await fila.getByTitle('Ver detalles').click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: '8. Documentos' }).click();
  const tarjeta = (titulo: string | RegExp): Locator =>
    dlg
      .locator('[data-slot="card"]')
      .filter({
        has: page.locator('[data-slot="card-title"]', { hasText: titulo }),
      })
      .first();
  const estado = tarjeta('Estado de Documentos');
  const porEtapa = tarjeta('Generar Documentos por Etapa');
  const generados = tarjeta(/Documentos Generados/);
  await generados.waitFor();
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await esperarEstable(page);

  // 01 — Pestaña y estado de los documentos. Sin marco en "Fase actual":
  // la segunda fila de pestañas se monta encima y el marco la taparía.
  const pestana = dlg.getByRole('tab', { name: '8. Documentos' });
  await anotar(page, [
    { objetivo: pestana, numero: 1, badge: 'arriba-der' },
    { objetivo: estado, numero: 2, badge: 'arriba-der', holgura: -4 },
  ]);
  await capturar(page, CARPETA, N('01-pestana'), {
    recorte: [dlg.getByRole('tablist'), estado],
    anchoDe: dlg,
    margen: 16,
  });
  await quitarAnotaciones(page);

  // 02 — Generación por etapa: botones por paquete y requisitos.
  await desplazarAlInicio(porEtapa, 24);
  await anotar(page, [
    {
      objetivo: porEtapa.getByRole('button', { name: 'Generar', exact: true }),
      numero: 1,
      badge: 'izq',
    },
    {
      objetivo: porEtapa.getByText(/Requiere fechas de radicación/),
      numero: 2,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('02-por-etapa'), {
    recorte: porEtapa,
    anchoDe: dlg,
    margen: 12,
  });
  await quitarAnotaciones(page);

  // 03 — Documentos generados, con su botón Ver.
  await desplazarAlInicio(generados, 24);
  await anotar(page, [
    { objetivo: generados, numero: 1, badge: 'arriba-der', holgura: -4 },
    {
      objetivo: generados.getByRole('button', { name: 'Ver' }).first(),
      numero: 2,
      badge: 'izq',
    },
  ]);
  await capturar(page, CARPETA, N('03-generados'), {
    recorte: generados,
    anchoDe: dlg,
    margen: 12,
  });
  await quitarAnotaciones(page);
  await page.close();
}
