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
 *
 * Detalle del deploy (commit, rama, versión): NO es público. Solo se
 * devuelve si la request trae `x-health-token` con el valor de
 * HEALTH_DETAILS_TOKEN. Saber qué commit corre en producción le ahorra
 * trabajo de reconocimiento a un atacante (permite mapear el binario
 * desplegado contra el repositorio y sus vulnerabilidades conocidas), así
 * que va detrás de un secreto compartido. Sin la env var configurada, el
 * bloque nunca se emite (fail closed).
 */

import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import pkg from '../../../../package.json';

// Prisma no corre en el Edge; y un health check nunca debe servirse cacheado.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Corta la sonda si la BD no responde: un health check colgado es un fallo. */
const DB_TIMEOUT_MS = 5_000;

/** Header que habilita el bloque de detalle del deploy. */
const DETAILS_HEADER = 'x-health-token';

type CheckStatus = 'ok' | 'error';

/**
 * Comparación en tiempo constante contra HEALTH_DETAILS_TOKEN — mismo
 * patrón que el endpoint del cron. Un `!==` filtraría el secreto byte a
 * byte por timing. `timingSafeEqual` exige buffers del mismo largo, así
 * que primero se compara el largo (seguro de filtrar).
 */
function hasValidDetailsToken(provided: string | null): boolean {
  const expected = process.env.HEALTH_DETAILS_TOKEN;
  // Sin secreto configurado el detalle no se expone nunca.
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Identificación del build. Las VERCEL_GIT_* las inyecta Vercel cuando el
 * proyecto tiene habilitado "Automatically expose System Environment
 * Variables"; si no están, se devuelve 'unknown' en vez de romper.
 */
function getDeploymentDetails(): Record<string, string> {
  return {
    version: pkg.version,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    deploymentEnv: process.env.VERCEL_ENV ?? 'unknown',
  };
}

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

export async function GET(request: Request): Promise<NextResponse> {
  const database = await checkDatabase();
  const healthy = database.status === 'ok';
  const showDetails = hasValidDetailsToken(
    request.headers.get(DETAILS_HEADER),
  );

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      environment:
        process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks: { database },
      ...(showDetails ? { deployment: getDeploymentDetails() } : {}),
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
