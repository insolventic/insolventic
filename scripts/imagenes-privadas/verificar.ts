/**
 * Verifica que cada centro de la base tenga todas sus firmas cargadas y válidas.
 *
 * Uso:
 *   npx tsx scripts/imagenes-privadas/verificar.ts
 *
 * Solo lee. Sale con código 1 si a algún centro le falta una firma o si alguna
 * no es válida (formato o tamaño): un centro así no puede generar documentos.
 * Va en el checklist de despliegue, después de cargar y antes de promover.
 * La base es la de `DATABASE_URL`.
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import {
  esTipoImagenPrivada,
  motivoImagenInvalida,
  TIPOS_IMAGEN_PRIVADA,
} from '../../src/lib/imagenes-privadas';
import { hostDeLaBase } from './base';

async function main() {
  console.log(`Base: ${hostDeLaBase()}\n`);

  const prisma = new PrismaClient();
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { slug: 'asc' },
    });
    const filas = await prisma.imagenPrivada.findMany({
      select: { tenantId: true, tipo: true, mimeType: true, datos: true },
    });

    if (tenants.length === 0) {
      console.error('No hay centros en la base.');
      process.exitCode = 1;
      return;
    }

    let fallas = 0;
    for (const tenant of tenants) {
      console.log(`${tenant.name} (${tenant.slug})`);
      for (const tipo of TIPOS_IMAGEN_PRIVADA) {
        const fila = filas.find(
          (f) => f.tenantId === tenant.id && f.tipo === tipo,
        );
        const motivo = fila
          ? motivoImagenInvalida(fila.datos, fila.mimeType)
          : 'no está cargada';
        if (motivo) fallas++;
        const detalle =
          fila && !motivo
            ? `${fila.mimeType}, ${fila.datos.length} bytes`
            : motivo;
        console.log(
          `  ${motivo ? 'FALTA' : 'ok   '}  ${tipo.padEnd(16)} ${detalle}`,
        );
      }
      for (const fila of filas) {
        if (fila.tenantId === tenant.id && !esTipoImagenPrivada(fila.tipo)) {
          console.log(
            `  aviso  ${fila.tipo.padEnd(16)} tipo desconocido; no se usa`,
          );
        }
      }
    }

    if (fallas > 0) {
      console.error(`\n${fallas} firma(s) faltante(s) o inválida(s).`);
      process.exitCode = 1;
    } else {
      console.log('\nTodos los centros tienen sus firmas.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
