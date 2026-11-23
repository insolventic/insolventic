/**
 * Huellas sha256 de las firmas y sellos de los centros, para detectar una
 * copia versionada aunque tenga otro nombre o otra extensión.
 *
 * Uso:
 *   npx tsx scripts/imagenes-privadas/huellas.ts generar <carpeta>  # reescribe huellas.txt
 *   npx tsx scripts/imagenes-privadas/huellas.ts revisar            # sale con 1 si hay una copia
 *
 * `<carpeta>` es la misma que recibe `cargar.ts` (`<carpeta>/<centro>/<tipo>.png`).
 * `huellas.txt` se versiona: una huella no permite reconstruir la imagen, solo
 * reconocerla. `revisar` compara cada archivo que git versiona contra la lista;
 * lo corre el CI de cada PR (`.github/workflows/pr.yml`). Una imagen incrustada
 * en otro archivo (un PDF, un DOCX) no tiene la misma huella y no se detecta.
 */

import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const RUTA_HUELLAS = path.join(__dirname, 'huellas.txt');

const EXTENSIONES = new Set(['.png', '.jpg', '.jpeg']);
const LINEA = /^([0-9a-f]{64}) {2}(\S.*)$/;

export interface Huella {
  huella: string;
  /** `<centro>/<archivo>`: de dónde salió, para el mensaje de error. */
  etiqueta: string;
}

export function huellaSha256(datos: Buffer): string {
  return createHash('sha256').update(datos).digest('hex');
}

/** Las imágenes de `<raiz>/<centro>/`, ordenadas por etiqueta. */
export function huellasDeCarpeta(raiz: string): Huella[] {
  const huellas: Huella[] = [];
  for (const centro of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (!centro.isDirectory()) continue;
    const dirCentro = path.join(raiz, centro.name);
    for (const archivo of fs.readdirSync(dirCentro, { withFileTypes: true })) {
      if (!archivo.isFile()) continue;
      if (!EXTENSIONES.has(path.extname(archivo.name).toLowerCase())) continue;
      huellas.push({
        huella: huellaSha256(
          fs.readFileSync(path.join(dirCentro, archivo.name)),
        ),
        etiqueta: `${centro.name}/${archivo.name}`,
      });
    }
  }
  return huellas.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
}

export function formatearHuellas(huellas: Huella[]): string {
  return [
    '# Huellas sha256 de las firmas y sellos de los centros (docs/RUNBOOK.md §7.3).',
    '# Se genera con `npx tsx scripts/imagenes-privadas/huellas.ts generar <carpeta>`.',
    ...huellas.map((h) => `${h.huella}  ${h.etiqueta}`),
    '',
  ].join('\n');
}

/** Huella → etiquetas. Ignora comentarios y líneas vacías; una línea mal formada es un error. */
export function leerHuellas(texto: string): Map<string, string[]> {
  const huellas = new Map<string, string[]>();
  texto.split(/\r?\n/).forEach((linea, i) => {
    if (linea.trim() === '' || linea.startsWith('#')) return;
    const m = LINEA.exec(linea);
    if (!m) throw new Error(`huellas.txt, línea ${i + 1}: formato inválido`);
    huellas.set(m[1], [...(huellas.get(m[1]) ?? []), m[2]]);
  });
  return huellas;
}

export function buscarCopias(
  archivos: Iterable<{ ruta: string; datos: Buffer }>,
  huellas: Map<string, string[]>,
): Array<{ ruta: string; etiquetas: string[] }> {
  const copias: Array<{ ruta: string; etiquetas: string[] }> = [];
  for (const { ruta, datos } of archivos) {
    const etiquetas = huellas.get(huellaSha256(datos));
    if (etiquetas) copias.push({ ruta, etiquetas });
  }
  return copias;
}

/** Los archivos que git versiona y existen en el árbol de trabajo. */
function* archivosVersionados(): Generator<{ ruta: string; datos: Buffer }> {
  const salida = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  for (const ruta of salida.split('\0').filter(Boolean)) {
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(ruta);
    } catch {
      continue; // borrado en el árbol de trabajo
    }
    if (stat.isFile()) yield { ruta, datos: fs.readFileSync(ruta) };
  }
}

function revisar(): number {
  const huellas = leerHuellas(fs.readFileSync(RUTA_HUELLAS, 'utf8'));
  if (huellas.size === 0) {
    console.error(
      `::error::${RUTA_HUELLAS} no tiene huellas: la revisión no protegería nada.`,
    );
    return 1;
  }
  const copias = buscarCopias(archivosVersionados(), huellas);
  if (copias.length === 0) {
    console.log(
      `Ningún archivo versionado coincide con las ${huellas.size} huellas.`,
    );
    return 0;
  }
  console.error(
    '::error::Hay copias versionadas de firmas o sellos. Se cargan en la base (docs/RUNBOOK.md §7.3):',
  );
  for (const c of copias)
    console.error(`${c.ruta}  (igual a ${c.etiquetas.join(', ')})`);
  return 1;
}

function generar(carpeta: string | undefined): number {
  if (!carpeta)
    throw new Error('Falta la carpeta. Uso: huellas.ts generar <carpeta>');
  const raiz = path.resolve(carpeta);
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
    throw new Error(`No existe la carpeta ${raiz}`);
  }
  const huellas = huellasDeCarpeta(raiz);
  if (huellas.length === 0) throw new Error(`No hay imágenes en ${raiz}`);
  fs.writeFileSync(RUTA_HUELLAS, formatearHuellas(huellas));
  for (const h of huellas)
    console.log(`  ${h.etiqueta.padEnd(40)} sha256:${h.huella.slice(0, 12)}`);
  console.log(
    `\n${huellas.length} huellas escritas en ${path.relative(process.cwd(), RUTA_HUELLAS)}.`,
  );
  return 0;
}

if (require.main === module) {
  const [modo, carpeta] = process.argv.slice(2);
  try {
    if (modo === 'revisar') process.exit(revisar());
    if (modo === 'generar') process.exit(generar(carpeta));
    throw new Error('Uso: huellas.ts revisar | huellas.ts generar <carpeta>');
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
