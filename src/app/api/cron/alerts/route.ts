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
import { sweepStaleGenerationRequests } from '@/features/document/generation-request';

// Node runtime — Prisma can't run on the Edge.
export const runtime = 'nodejs';
// Cron endpoints should always execute fresh, never a cached response.
export const dynamic = 'force-dynamic';

// Hard upper bound for the whole cron run. Vercel Cron on Hobby caps
// functions at 10s / Pro at 5 min — we stay safely under either.
const CRON_TIMEOUT_MS = 60_000;

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
  const generations: { tenantId: string; released: number }[] = [];
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
        truncated: false,
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
        truncated: false,
      });
    }

    // R-3: barrido de solicitudes de generación huérfanas. Va en este cron
    // porque es el único que corre, y es una consulta por centro. Sin esto, una
    // generación que muere a mitad deja su lock tomado hasta que alguien
    // reintenta — y si nadie reintenta, para siempre.
    try {
      generations.push(
        await sweepStaleGenerationRequests({ tenantId: tenant.id }),
      );
    } catch (error) {
      logger.error(
        'Cron de alertas: falló el barrido de generaciones huérfanas',
        error,
        {
          action: 'cron.alerts.sweepStaleGenerationRequests',
          tenantId: tenant.id,
          requestId,
        },
      );
      generations.push({ tenantId: tenant.id, released: -1 });
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

  // `truncated` en cualquiera de los escaneos significa que quedó trabajo sin
  // revisar: el runbook lo mira para saber si hay que subir el tope o el plan.
  const truncated = [...hearings, ...payments].some((r) => r.truncated);

  return NextResponse.json({
    ok: !timedOut,
    requestId,
    durationMs,
    timedOut,
    truncated,
    totalCreated,
    totalErrors,
    hearings,
    payments,
    generations,
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
