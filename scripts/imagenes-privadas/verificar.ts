/**
 * Verifica que cada centro de la base tenga cargadas y válidas todas sus
 * imágenes privadas (las firmas y, en los centros que lo usan, el sello) y
 * los datos de su membrete.
 *
 * Uso:
 *   npx tsx scripts/imagenes-privadas/verificar.ts
 *
 * Solo lee. Sale con código 1 si a algún centro le falta una firma, si alguna
 * no es válida (formato o tamaño) o si su membrete no dice quién firma la
 * Designación del Conciliador (nombre y cargo del director): un centro así no
 * puede generar documentos. Los demás datos del membrete que falten salen
 * como aviso: solo cortan las plantillas que los usan.
 * Va en el checklist de despliegue, después de cargar y antes de promover.
 * La base es la de `DATABASE_URL`.
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import {
  motivoImagenInvalida,
  tiposRequeridos,
} from '../../src/lib/imagenes-privadas';
import { revisarMembrete } from '../../src/lib/membrete-centro';
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
      const requeridos = tiposRequeridos(tenant.slug);
      for (const tipo of requeridos) {
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
        const sobra = !(requeridos as readonly string[]).includes(fila.tipo);
        if (fila.tenantId === tenant.id && sobra) {
          console.log(`  aviso  ${fila.tipo.padEnd(16)} este centro no lo usa`);
        }
      }

      const membrete = revisarMembrete(tenant.slug);
      for (const dato of membrete.bloquean) {
        fallas++;
        console.log(`  FALTA  ${'membrete'.padEnd(16)} ${dato}`);
      }
      if (membrete.bloquean.length === 0) {
        console.log(`  ok     ${'membrete'.padEnd(16)} director`);
      }
      for (const dato of membrete.avisos) {
        console.log(`  aviso  ${'membrete'.padEnd(16)} falta ${dato}`);
      }
    }

    if (fallas > 0) {
      console.error(
        `\n${fallas} imagen(es) o dato(s) del membrete faltante(s) o inválido(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log('\nTodos los centros tienen sus imágenes y su director.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
