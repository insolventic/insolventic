/**
 * Optimización de las figuras del manual: PNG con paleta de 256 colores.
 *
 * Por qué paleta y no "sin pérdida": las capturas de Playwright ya vienen bien
 * comprimidas y una recompresión sin pérdida no baja ni un 1 %. La paleta
 * (libimagequant, calidad 90) reduce cada figura a la mitad o menos; los
 * píxeles que cambian están en los bordes suavizados y no afectan la
 * legibilidad (comparado a 2x en el piloto de la sección 4.1).
 *
 * Usa el `sharp` que ya instala Next.js como dependencia opcional: no se
 * declara en package.json a propósito. Se carga en tiempo de ejecución y sin
 * importar sus tipos, para que `next build` (que también revisa los tipos de
 * scripts/) no dependa de un paquete opcional.
 *
 * Idempotente por construcción: un PNG que ya es de paleta no se vuelve a
 * cuantizar (re-cuantizar podría cambiarlo), y un archivo cuyo contenido ya
 * coincide byte a byte no se reescribe. Los metadatos se descartan.
 *
 * Uso directo, sobre todas las figuras o las que se indiquen:
 *   npx tsx scripts/manual-capturas/optimizar.ts [archivo.png ...]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { CARPETA_IMG } from './config';

/** Lo poco de la API de sharp que se usa aquí. */
type Sharp = (entrada: Buffer) => {
  png(opciones: {
    palette: boolean;
    quality: number;
    effort: number;
    compressionLevel: number;
  }): {
    toBuffer(): Promise<Buffer>;
  };
};

/** Opciones de la paleta. Cambiarlas cambia los bytes de todas las figuras. */
const OPCIONES_PNG = {
  palette: true,
  quality: 90,
  effort: 10,
  compressionLevel: 9,
};

/** Tipo de color 3 en el encabezado IHDR: PNG indexado (de paleta). */
export function esPngDePaleta(png: Buffer): boolean {
  const firma = '89504e470d0a1a0a';
  return (
    png.length > 25 &&
    png.subarray(0, 8).toString('hex') === firma &&
    png[25] === 3
  );
}

let sharpCargado: Sharp | undefined;

function cargarSharp(): Sharp {
  if (sharpCargado) return sharpCargado;
  try {
    const cargar = createRequire(__filename);
    sharpCargado = cargar('sharp') as Sharp;
    return sharpCargado;
  } catch {
    throw new Error(
      'No se encontró `sharp`. Lo instala Next.js como dependencia opcional: ' +
        'correr `npm ci` (sin --omit=optional). No se agrega a package.json.',
    );
  }
}

/** Convierte un PNG a paleta de 256 colores; si ya lo es, lo devuelve igual. */
export async function optimizarPng(png: Buffer): Promise<Buffer> {
  if (esPngDePaleta(png)) return png;
  return cargarSharp()(png).png(OPCIONES_PNG).toBuffer();
}

/**
 * Escribe `contenido` optimizado en `destino`, salvo que el archivo ya tenga
 * exactamente esos bytes. Devuelve si escribió.
 */
export async function guardarOptimizado(
  destino: string,
  contenido: Buffer,
): Promise<boolean> {
  const optimizado = await optimizarPng(contenido);
  let actual: Buffer | undefined;
  try {
    actual = readFileSync(destino);
  } catch {
    // no existe todavía
  }
  if (actual?.equals(optimizado)) return false;
  writeFileSync(destino, optimizado);
  return true;
}

function listarPng(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = path.join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return listarPng(ruta);
    return nombre.endsWith('.png') ? [ruta] : [];
  });
}

async function main(): Promise<void> {
  const archivos = process.argv.slice(2);
  const objetivos = archivos.length
    ? archivos.map((a) => path.resolve(a))
    : listarPng(CARPETA_IMG);
  let cambiados = 0;
  for (const ruta of objetivos) {
    const antes = statSync(ruta).size;
    if (await guardarOptimizado(ruta, readFileSync(ruta))) {
      cambiados++;
      const despues = statSync(ruta).size;
      console.log(
        `${path.relative(CARPETA_IMG, ruta)}: ${Math.round(antes / 1024)} → ${Math.round(despues / 1024)} KB`,
      );
    }
  }
  console.log(
    `${objetivos.length} figuras revisadas, ${cambiados} reescritas.`,
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
