/**
 * Consultas a la base de capturas que necesita el script durante la corrida.
 * Siempre pasan por la guarda: solo 127.0.0.1:54330/insolventic_manual_test.
 */

import { PrismaClient } from '@prisma/client';

import { assertBaseDeCapturas } from './guarda-base';

/**
 * Espera a que no quede ninguna generación de documentos activa. Al crear un
 * caso, la app lanza la generación inicial en segundo plano; en local falla
 * (no hay Drive) y deja una notificación al terminar. Esperarla hace que lo
 * que se captura después no dependa de cuánto tardó.
 */
export async function esperarGeneracionesTerminadas(
  url: string,
  limiteMs = 90_000,
): Promise<void> {
  assertBaseDeCapturas({ ...process.env, DATABASE_URL: url, DIRECT_URL: url });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const fin = Date.now() + limiteMs;
    while (Date.now() < fin) {
      const activas = await prisma.documentGenerationRequest.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      });
      if (activas === 0) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(
      `Quedan generaciones de documentos activas después de ${limiteMs / 1000} s.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
