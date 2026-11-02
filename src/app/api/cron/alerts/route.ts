/**
 * Cron endpoint — runs proactive alert scanners.
 *
 * Security: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron
 * injects this header automatically when configured via `vercel.json`.
 * Manual invocation (curl, uptime monitor) works too with the same token.
 *
 * When `CRON_SECRET` is unset (local dev / staging without secret yet), the
 * endpoint returns 503 instead of silently running — we don't want anyone
 * on the public internet triggering DB writes.
 *
 * Scans are run serially per tenant and aggregated into a single JSON
 * response for the caller (Vercel dashboard shows the body in logs).
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import prisma, { getAvailableTenants } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  scanUpcomingHearings,
  scanOverduePayments,
  type AlertScanResult,
} from '@/features/notification/alerts';

// Node runtime — Prisma can't run on the Edge.
export const runtime = 'nodejs';
// Cron endpoints should always execute fresh, never a cached response.
export const dynamic = 'force-dynamic';
// Presupuesto que la plataforma le da a ESTA función. Sin este export Vercel
// aplica su default (10 s en Hobby) y mata la corrida antes de que el
// presupuesto interno de abajo llegue a cerrarla: el `deadline`, el flag
// `timedOut` y la respuesta agregada quedaban inalcanzables. 60 s es el máximo
// en Hobby; en Pro puede subirse hasta 300 (y con él, CRON_TIMEOUT_MS).
export const maxDuration = 60;

// Presupuesto interno de la corrida, estrictamente POR DEBAJO de
// `maxDuration`: si fuesen iguales, el deadline nunca se alcanzaría antes del
// corte de la plataforma y este control no serviría de nada. El deadline se
// chequea *entre* tenants, así que después del chequeo todavía cabe un escaneo
// completo; el margen de 10 s es para que ese último escaneo termine y la
// respuesta agregada salga, en vez de morir cortada sin dejar rastro.
const CRON_TIMEOUT_MS = 50_000;

function unauthorized(message: string, requestId: string) {
  return NextResponse.json(
    { ok: false, error: message, requestId },
    { status: 401 },
  );
}

/**
 * Constant-time comparison of the Authorization header against the expected
 * value. Using plain `!==` would leak information via timing side-channel
 * (early-exit on first mismatched byte). `timingSafeEqual` requires equal
 * buffer lengths, so we first compare lengths (safe to leak) and only then
 * compare the bytes.
 */
function matchesBearer(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(authHeader: string | null): Promise<NextResponse> {
  const requestId = randomUUID();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error:
          'CRON_SECRET is not configured on the server. Set it in the Vercel environment variables to enable proactive alerts.',
      },
      { status: 503 },
    );
  }

  if (!matchesBearer(authHeader, secret)) {
    return unauthorized('Invalid or missing cron token', requestId);
  }

  const tenants = getAvailableTenants();
  const startedAt = Date.now();
  const deadline = startedAt + CRON_TIMEOUT_MS;

  const hearings: AlertScanResult[] = [];
  const payments: AlertScanResult[] = [];
  let timedOut = false;

  for (const tenant of tenants) {
    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }
    try {
      hearings.push(await scanUpcomingHearings(prisma, tenant.id));
    } catch (error) {
      logger.error(
        'Cron de alertas: falló el escaneo de audiencias de un tenant',
        error,
        {
          action: 'cron.alerts.scanUpcomingHearings',
          tenantId: tenant.id,
          requestId,
        },
      );
      hearings.push({
        tenantId: tenant.id,
        created: 0,
        skipped: 0,
        errors: 1,
      });
    }

    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }

    try {
      payments.push(await scanOverduePayments(prisma, tenant.id));
    } catch (error) {
      logger.error(
        'Cron de alertas: falló el escaneo de pagos vencidos de un tenant',
        error,
        {
          action: 'cron.alerts.scanOverduePayments',
          tenantId: tenant.id,
          requestId,
        },
      );
      payments.push({
        tenantId: tenant.id,
        created: 0,
        skipped: 0,
        errors: 1,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  const totalCreated = [...hearings, ...payments].reduce(
    (acc, r) => acc + r.created,
    0,
  );
  const totalErrors = [...hearings, ...payments].reduce(
    (acc, r) => acc + r.errors,
    0,
  );

  return NextResponse.json({
    ok: !timedOut,
    requestId,
    durationMs,
    timedOut,
    totalCreated,
    totalErrors,
    hearings,
    payments,
  });
}

// Vercel Cron fires GET by default.
export async function GET(request: Request): Promise<NextResponse> {
  return run(request.headers.get('authorization'));
}

// POST is supported for ad-hoc manual triggers.
export async function POST(request: Request): Promise<NextResponse> {
  return run(request.headers.get('authorization'));
}
