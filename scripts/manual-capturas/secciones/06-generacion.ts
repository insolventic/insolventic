/**
 * Sección 6 — Generación de documentos, como la operadora, sobre el caso de
 * Jorge (lo crea la sección 4.1).
 *
 * Figuras (docs/manual-usuario/img/06-documentos/), Figura 6-N del manual:
 *   01 lista de paquetes, con el número de documentos de cada uno
 *   02 formulario completo, con el aviso de documentos ya generados
 *
 * No se pulsa "Generar Documentos" ni "Sincronizar con Drive": en local no
 * hay Drive (decisión P2). Los documentos "ya generados" del aviso los
 * siembra `sembrarDocumentosDeJorge`, con enlaces inválidos.
 */

import {
  anotar,
  capturar,
  esperarEstable,
  quitarAnotaciones,
} from '../anotaciones';
import type { Contexto } from '../capturar';
import { DEUDOR_EJEMPLO } from '../datos';

const CARPETA = '06-documentos';
const N = (sufijo: string) => `06-documentos-${sufijo}`;

export async function seccion06Generacion(ctx: Contexto): Promise<void> {
  await ctx.sembrarDocumentosDeJorge();
  const page = await ctx.paginaComo('operadora');
  await page.goto('/documents');
  const tarjeta = page.locator('[data-slot="card"]', {
    has: page.getByText('Generación de Documentos', { exact: true }),
  });
  await tarjeta.waitFor();
  await esperarEstable(page);
  const [selectorCaso, selectorPaquete, selectorFormato] = [0, 1, 2].map((i) =>
    // CSS y no getByRole: con una lista abierta, Radix oculta el resto a la
    // accesibilidad (aria-hidden) y getByRole deja de encontrar los selectores.
    tarjeta.locator('button[role="combobox"]').nth(i),
  );

  // Caso de Jorge.
  await selectorCaso.click();
  await page
    .getByPlaceholder('Buscar por número de caso, deudor o tipo...')
    .fill('Salazar');
  await page
    .getByRole('option', { name: new RegExp(DEUDOR_EJEMPLO.nombre) })
    .click();
  await tarjeta.getByText(/doc\. existentes/).waitFor();

  // 01 — Lista de paquetes abierta.
  await selectorPaquete.click();
  const lista = page.getByRole('listbox');
  await lista.waitFor();
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: selectorPaquete, numero: 1, badge: 'arriba-der' },
    { objetivo: lista, numero: 2, badge: 'arriba-der' },
  ]);
  await capturar(page, CARPETA, N('01-paquetes'), {
    // La lista sobresale por debajo de la tarjeta: se recorta la unión.
    recorte: [tarjeta, lista],
    margen: 16,
  });
  await quitarAnotaciones(page);
  await page.getByRole('option', { name: /^Paquete 1 - / }).click();

  // 02 — Formulario completo: formato y aviso de documentos existentes.
  await selectorFormato.click();
  await page.getByRole('option', { name: 'Ambos (PDF + Word)' }).click();
  const aviso = tarjeta.getByText(/Este caso ya tiene \d+ documento/);
  await aviso.waitFor();
  await esperarEstable(page);
  await anotar(page, [
    { objetivo: selectorCaso, numero: 1, badge: 'arriba-der' },
    { objetivo: selectorPaquete, numero: 2, badge: 'arriba-der' },
    { objetivo: selectorFormato, numero: 3, badge: 'arriba-der' },
    { objetivo: aviso, numero: 4, badge: 'izq' },
    {
      objetivo: tarjeta.getByRole('button', { name: 'Generar Documentos' }),
      numero: 5,
      badge: 'arriba-der',
    },
  ]);
  await capturar(page, CARPETA, N('02-formulario'), {
    recorte: tarjeta,
    margen: 24,
  });
  await quitarAnotaciones(page);
  await page.close();
}
