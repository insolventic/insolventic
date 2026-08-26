/**
 * Health check — sonda de disponibilidad para smoke tests post-deploy y
 * monitoreo externo de uptime (A-5, auditoría 2026-08-25).
 *
 * Público a propósito: un health check detrás de auth no sirve para
 * verificar un deploy. Por eso la respuesta es deliberadamente pobre en
 * información — estado, si la BD responde y cuánto tardó. Nunca versiones
 * de dependencias, connection strings, nombres de host ni env vars: eso
 * sería reconocimiento gratis para un atacante.
 *
 * Contrato:
 *   200 {status:"ok",       checks:{database:{status:"ok",  latencyMs}}}
 *   503 {status:"degraded", checks:{database:{status:"error"}}}
 * El smoke test de deploy corta por el status HTTP.
 */

import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Prisma no corre en el Edge; y un health check nunca debe servirse cacheado.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Corta la sonda si la BD no responde: un health check colgado es un fallo. */
const DB_TIMEOUT_MS = 5_000;

type CheckStatus = 'ok' | 'error';

async function checkDatabase(): Promise<{
  status: CheckStatus;
  latencyMs: number;
}> {
  const startedAt = Date.now();
  // El timer se limpia siempre: si gana la query y queda pendiente, mantiene
  // viva la lambda hasta DB_TIMEOUT_MS después de haber respondido.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timeout tras ${DB_TIMEOUT_MS}ms`)),
          DB_TIMEOUT_MS,
        );
      }),
    ]);
    return { status: 'ok', latencyMs: Date.now() - startedAt };
  } catch (error) {
    // Este sí es un error real de infraestructura: va a Sentry.
    logger.error('Health check: la base de datos no responde', error, {
      action: 'health.database',
    });
    return { status: 'error', latencyMs: Date.now() - startedAt };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse> {
  const database = await checkDatabase();
  const healthy = database.status === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      environment:
        process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks: { database },
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}

/** HEAD para monitores de uptime que no necesitan cuerpo. */
export async function HEAD(): Promise<NextResponse> {
  const database = await checkDatabase();
  return new NextResponse(null, {
    status: database.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
