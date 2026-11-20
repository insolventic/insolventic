/**
 * Carga las firmas de cada centro en la tabla `imagenes_privadas`.
 *
 * Uso:
 *   npx tsx scripts/imagenes-privadas/cargar.ts <carpeta>              # simulación
 *   npx tsx scripts/imagenes-privadas/cargar.ts <carpeta> --confirmar  # escribe
 *
 * `<carpeta>` tiene una subcarpeta por centro, con el slug del centro, y dentro
 * un archivo por firma con el nombre del tipo:
 *
 *   <carpeta>/armonia/firma-operador.png
 *   <carpeta>/armonia/firma-director.jpg
 *   <carpeta>/constructores-paz/firma-operador.png
 *   ...
 *
 * Si dos centros usan la misma firma, el archivo va en las dos subcarpetas: cada
 * centro tiene su propia fila. Es idempotente (upsert por centro y tipo) y valida
 * todo antes de escribir: si un archivo no sirve, no se carga ninguno. Nunca lee
 * archivos versionados en el repositorio. Imprime qué carga, nunca el contenido.
 * La base es la de `DATABASE_URL`.
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';

import {
  detectarMimeImagen,
  esTipoImagenPrivada,
  motivoImagenInvalida,
  type TipoImagenPrivada,
} from '../../src/lib/imagenes-privadas';
import { hostDeLaBase } from './base';

const EXTENSIONES = new Set(['.png', '.jpg', '.jpeg']);

interface Archivo {
  centro: string;
  tipo: TipoImagenPrivada;
  ruta: string;
  datos: Buffer;
  mimeType: string;
}

/** Los archivos de la lista que git versiona: esos no se cargan nunca. */
function versionadosEnGit(rutas: string[]): string[] {
  if (rutas.length === 0) return [];
  try {
    const salida = execFileSync(
      'git',
      ['ls-files', '--full-name', '--', ...rutas],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return salida.split('\n').filter(Boolean);
  } catch {
    // Fuera de un repositorio git no hay nada versionado que proteger.
    return [];
  }
}

function leerCarpeta(raiz: string): { archivos: Archivo[]; errores: string[] } {
  const archivos: Archivo[] = [];
  const errores: string[] = [];

  for (const centro of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (!centro.isDirectory()) continue;
    const dirCentro = path.join(raiz, centro.name);

    for (const entrada of fs.readdirSync(dirCentro, { withFileTypes: true })) {
      if (!entrada.isFile()) continue;
      const ruta = path.join(dirCentro, entrada.name);
      const nombre = `${centro.name}/${entrada.name}`;
      const ext = path.extname(entrada.name).toLowerCase();
      const tipo = path.basename(entrada.name, path.extname(entrada.name));

      if (!EXTENSIONES.has(ext) || !esTipoImagenPrivada(tipo)) {
        console.log(`  ignorado     ${nombre}`);
        continue;
      }

      const datos = fs.readFileSync(ruta);
      const mimeType = detectarMimeImagen(datos) ?? 'desconocido';
      const motivo = motivoImagenInvalida(datos, mimeType);
      if (motivo) {
        errores.push(`${nombre}: ${motivo}`);
        continue;
      }
      if (archivos.some((a) => a.centro === centro.name && a.tipo === tipo)) {
        errores.push(`${nombre}: hay más de un archivo para ${tipo}`);
        continue;
      }
      archivos.push({ centro: centro.name, tipo, ruta, datos, mimeType });
    }
  }

  for (const versionado of versionadosEnGit(archivos.map((a) => a.ruta))) {
    errores.push(`${versionado}: está versionado en el repositorio`);
  }
  return { archivos, errores };
}

async function main() {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirmar');
  const carpeta = args.find((a) => !a.startsWith('--'));
  if (!carpeta) {
    throw new Error('Falta la carpeta. Uso: cargar.ts <carpeta> [--confirmar]');
  }
  const raiz = path.resolve(carpeta);
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
    throw new Error(`No existe la carpeta ${raiz}`);
  }

  console.log(`Base:    ${hostDeLaBase()}`);
  console.log(`Carpeta: ${raiz}`);
  console.log(
    confirmar
      ? 'Modo:    escritura'
      : 'Modo:    simulación (agregar --confirmar para escribir)',
  );

  const { archivos, errores } = leerCarpeta(raiz);
  const prisma = new PrismaClient();
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, slug: true },
    });
    const idPorSlug = new Map(tenants.map((t) => [t.slug, t.id]));
    for (const a of archivos) {
      if (!idPorSlug.has(a.centro)) {
        errores.push(
          `${a.centro}/: no hay ningún centro con ese slug en la base`,
        );
      }
    }

    if (errores.length > 0) {
      console.error('\nNo se cargó nada:');
      for (const e of errores) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }

    const existentes = await prisma.imagenPrivada.findMany({
      select: { tenantId: true, tipo: true, datos: true },
    });

    for (const a of archivos) {
      const tenantId = idPorSlug.get(a.centro)!;
      const actual = existentes.find(
        (e) => e.tenantId === tenantId && e.tipo === a.tipo,
      );
      const estado = !actual
        ? 'nueva'
        : Buffer.from(actual.datos).equals(a.datos)
          ? 'sin cambios'
          : 'reemplaza';

      if (confirmar && estado !== 'sin cambios') {
        await prisma.imagenPrivada.upsert({
          where: { tenantId_tipo: { tenantId, tipo: a.tipo } },
          create: {
            tenantId,
            tipo: a.tipo,
            mimeType: a.mimeType,
            datos: new Uint8Array(a.datos),
          },
          update: { mimeType: a.mimeType, datos: new Uint8Array(a.datos) },
        });
      }

      const huella = createHash('sha256')
        .update(a.datos)
        .digest('hex')
        .slice(0, 12);
      console.log(
        `  ${`${a.centro}/${a.tipo}`.padEnd(36)} ${a.mimeType.padEnd(10)} ` +
          `${String(a.datos.length).padStart(8)} bytes  sha256:${huella}  ${estado}`,
      );
    }

    if (archivos.length === 0) console.log('  (no hay archivos para cargar)');
    if (!confirmar) console.log('\nSimulación: no se escribió nada.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
