/**
 * Consultas a la base de capturas que necesita el script durante la corrida.
 * Siempre pasan por la guarda: solo 127.0.0.1:54330/insolventic_manual_test.
 */

import { PrismaClient } from '@prisma/client';

import { FECHA_ANCLA } from './config';
import {
  DEUDOR_EJEMPLO,
  DOCUMENTOS_JORGE,
  ULTIMO_ACCESO_HORAS,
  USUARIOS,
} from './datos';
import { assertBaseDeCapturas } from './guarda-base';

async function conBase<T>(
  url: string,
  trabajo: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  assertBaseDeCapturas({ ...process.env, DATABASE_URL: url, DIRECT_URL: url });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await trabajo(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

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
  await conBase(url, async (prisma) => {
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
  });
}

/**
 * Registra como ya generados los documentos de `DOCUMENTOS_JORGE` en el caso
 * de Jorge (lo crea la sección 4.1). Idempotente: si ya están, no hace nada.
 * Los enlaces son inválidos a propósito (decisión P2: sin Drive).
 */
export async function sembrarDocumentosDeJorge(url: string): Promise<void> {
  await conBase(url, async (prisma) => {
    const caso = await prisma.case.findFirst({
      where: { debtor: { idNumber: DEUDOR_EJEMPLO.cedula }, deletedAt: null },
      select: { id: true, caseNumber: true, tenantId: true },
    });
    if (!caso)
      throw new Error('No existe el caso de Jorge: falta la sección 4.1.');
    const existentes = await prisma.document.count({
      where: { caseId: caso.id },
    });
    if (existentes > 0) return;
    for (const nombre of DOCUMENTOS_JORGE) {
      const archivo = nombre.toLowerCase().replace(/\s+/g, '-');
      await prisma.document.create({
        data: {
          name: `${nombre} - ${caso.caseNumber}`,
          type: 'pdf',
          status: 'generated',
          url: `https://example.invalid/documentos/${caso.caseNumber}/${archivo}.pdf`,
          fileName: `${archivo}.pdf`,
          mimeType: 'application/pdf',
          isGenerated: true,
          section: 'GENERADO',
          uploadDate: FECHA_ANCLA,
          caseId: caso.id,
          tenantId: caso.tenantId,
        },
      });
    }
  });
}

/**
 * Devuelve el "Último acceso" de cada usuario a los valores del seed: el
 * login de la corrida lo había cambiado a la hora real.
 */
export async function restituirUltimosAccesos(url: string): Promise<void> {
  await conBase(url, async (prisma) => {
    for (const u of USUARIOS) {
      await prisma.user.updateMany({
        where: { email: u.email },
        data: {
          lastLogin: new Date(
            FECHA_ANCLA.getTime() - ULTIMO_ACCESO_HORAS[u.clave] * 3600_000,
          ),
        },
      });
    }
  });
}
