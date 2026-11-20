/**
 * Las firmas solo se leen en el servidor y solo dentro de la generación de
 * documentos. Ninguna página, ruta de API ni server action las expone.
 *
 * Es un guardián estático: recorre `src/` y falla si aparece un camino nuevo
 * hacia la tabla o hacia el resolver. Si un cambio legítimo lo rompe, la
 * revisión tiene que pasar por acá y por esta lista.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

function archivosFuente(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivosFuente(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const relativo = (p: string) =>
  path.relative(process.cwd(), p).split(path.sep).join('/');

const ARCHIVOS = archivosFuente(SRC).map((p) => ({
  ruta: relativo(p),
  codigo: fs.readFileSync(p, 'utf8'),
}));

const IMPORTA_MODULO =
  /from\s+['"](?:@\/lib|\.{1,2}(?:\/[\w.-]+)*)\/imagenes-privadas['"]/;

/** Quiénes pueden importar el módulo, y para qué. */
const IMPORTADORES_PERMITIDOS = new Set([
  // Resolución antes de generar (automática, etapas, regenerar, vista previa).
  'src/features/document/generate-documents.ts',
  // Generación manual por lotes desde /documents.
  'src/features/document/actions.ts',
  // Reconoce el error para notificar al usuario sin duplicar el evento.
  'src/features/document/generation-job.ts',
  // El mapper pone el ref simbólico; no lee la base.
  'src/features/document/placeholders/branding.ts',
  // Corta si un ref llega sin resolver; no lee la base.
  'src/lib/html-to-pdf.ts',
]);

describe('acceso a las firmas', () => {
  it('solo src/lib/imagenes-privadas.ts consulta la tabla', () => {
    const consultan = ARCHIVOS.filter((a) =>
      /\.imagenPrivada\b/.test(a.codigo),
    ).map((a) => a.ruta);
    expect(consultan).toEqual(['src/lib/imagenes-privadas.ts']);
  });

  it('solo los módulos de la generación importan el resolver', () => {
    const importan = ARCHIVOS.filter((a) => IMPORTA_MODULO.test(a.codigo)).map(
      (a) => a.ruta,
    );
    expect(importan.filter((r) => !IMPORTADORES_PERMITIDOS.has(r))).toEqual([]);
  });

  it('ninguna página, layout ni ruta de API lo importa', () => {
    const enApp = ARCHIVOS.filter(
      (a) => a.ruta.startsWith('src/app/') && IMPORTA_MODULO.test(a.codigo),
    );
    expect(enApp).toEqual([]);
  });

  it('ninguna server action lo reexporta ni devuelve sus funciones', () => {
    const reexportan = ARCHIVOS.filter(
      (a) =>
        /^['"]use server['"]/m.test(a.codigo) &&
        /export\s*(?:\*|\{[^}]*\})\s*from\s*['"][^'"]*imagenes-privadas['"]/.test(
          a.codigo,
        ),
    );
    expect(reexportan).toEqual([]);

    const actions = ARCHIVOS.find(
      (a) => a.ruta === 'src/features/document/actions.ts',
    )!;
    expect(actions.codigo).not.toMatch(
      /export\s+(?:async\s+)?function\s+\w*[Ii]magen/,
    );
  });

  it('el módulo no es una server action', () => {
    const modulo = ARCHIVOS.find(
      (a) => a.ruta === 'src/lib/imagenes-privadas.ts',
    )!;
    expect(modulo.codigo).not.toMatch(/^['"]use server['"]/m);
  });
});
