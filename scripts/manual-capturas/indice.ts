/**
 * Índice de figuras y anchos de las imágenes del manual.
 *
 * Reescribe la sección "## Índice de figuras" de `docs/MANUAL_USUARIO.md` a
 * partir de los pies `_Figura <sección>-<n>. Texto._`, en el orden en que
 * aparecen, y fija el `width` de cada `<img>` en la mitad de los píxeles del
 * PNG (las figuras se capturan a escala 2). Conserva los finales de línea del
 * archivo. Al terminar corre las verificaciones de `verificar.ts`.
 *
 * Uso:
 *   npx tsx scripts/manual-capturas/indice.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { RAIZ_REPO } from './config';

export const RUTA_MANUAL = path.join(RAIZ_REPO, 'docs', 'MANUAL_USUARIO.md');
const TITULO_INDICE = '## Índice de figuras';

/** `4.3.1-2` → `figura-4-3-1-2`. */
export function anclaDeFigura(numero: string): string {
  return `figura-${numero.replace(/\./g, '-')}`;
}

/** Pies de figura del cuerpo del manual, en orden: número y texto. */
export function piesDeFigura(
  cuerpo: string,
): Array<{ numero: string; texto: string }> {
  return [...cuerpo.matchAll(/_Figura ([0-9.]+-\d+)\. (.+?)_\n/g)].map((m) => ({
    numero: m[1],
    texto: m[2],
  }));
}

/** Separa el manual (con saltos `\n`) en cuerpo e índice. */
export function partirManual(md: string): { cuerpo: string; resto: string } {
  const inicio = md.indexOf(TITULO_INDICE);
  if (inicio < 0) throw new Error(`El manual no tiene "${TITULO_INDICE}".`);
  return { cuerpo: md.slice(0, inicio), resto: md.slice(inicio) };
}

/** Ancho de un PNG, leído de su cabecera IHDR. */
export function anchoPng(rutaRelativaADocs: string): number {
  const png = readFileSync(path.join(RAIZ_REPO, 'docs', rutaRelativaADocs));
  return png.readUInt32BE(16);
}

/** El manual con el índice regenerado y los anchos al día (saltos `\n`). */
export function manualRegenerado(md: string): string {
  const { cuerpo, resto } = partirManual(md);
  const finIndice = resto.indexOf('\n---\n');
  if (finIndice < 0)
    throw new Error('El índice de figuras debe cerrar con una línea "---".');
  const lista = piesDeFigura(cuerpo)
    .map(
      (p) => `- [Figura ${p.numero}](#${anclaDeFigura(p.numero)}). ${p.texto}`,
    )
    .join('\n');
  const conIndice = `${cuerpo}${TITULO_INDICE}\n\n${lista}\n${resto.slice(finIndice)}`;
  return conIndice.replace(
    /<img src="([^"]+)"([^>]*?) width="\d+">/g,
    (_todo, src: string, medio: string) =>
      `<img src="${src}"${medio} width="${Math.round(anchoPng(src) / 2)}">`,
  );
}

async function main(): Promise<void> {
  const original = readFileSync(RUTA_MANUAL, 'utf8');
  const crlf = original.includes('\r\n');
  const md = original.replace(/\r\n/g, '\n');
  const nuevo = manualRegenerado(md);
  if (nuevo === md) {
    console.log('Índice y anchos ya estaban al día.');
  } else {
    writeFileSync(RUTA_MANUAL, crlf ? nuevo.replace(/\n/g, '\r\n') : nuevo);
    console.log('Índice y anchos actualizados.');
  }
  const { verificarManual } = await import('./verificar');
  const errores = verificarManual();
  if (errores.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
