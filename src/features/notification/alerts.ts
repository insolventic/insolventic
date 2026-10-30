/**
 * Proactive alert scanners — called from the cron route
 * (`/api/cron/alerts`) on a schedule (see `vercel.json`).
 *
 * Two alerts are supported today:
 *   1. `hearing_upcoming` — a case has a `hearingDate` or `firstHearingDate`
 *      within the configured lookahead window (default 48h).
 *   2. `payment_overdue` — a payment is still `pendiente` past its `dueDate`.
 *
 * Each scanner is:
 *   - Tenant-agnostic at the call site (iterate tenants at the cron layer).
 *   - Idempotent: if an identical notification (same type + relatedId + user)
 *     was already created inside the dedupe window (default 20h), skip it.
 *     This stops the daily cron from spamming the same operator.
 *   - Fire-and-forget on the email side: in-app notification is the source
 *     of truth; email is best-effort behind the `ALERTS_EMAIL_ENABLED` flag.
 *
 * This file is a plain module (no `'use server'`) so the cron route can
 * import it directly without going through the action layer.
 */

import type { PrismaClient } from '@prisma/client';

import { emailService } from '@/lib/email';
import { logger } from '@/lib/logger';

const HEARING_LOOKAHEAD_HOURS = Number(
  process.env.ALERTS_HEARING_LOOKAHEAD_HOURS ?? 48,
);
const DEDUPE_WINDOW_HOURS = Number(
  process.env.ALERTS_DEDUPE_WINDOW_HOURS ?? 20,
);

/**
 * Tope de ítems que revisa un escaneo por tenant y por corrida.
 *
 * Los dos `findMany` no tenían cota, y el conjunto que recorren **crece de
 * forma monótona**: un pago vencido sigue vencido hasta que se paga, así que
 * el cron de cada mañana revisa más filas que el de ayer. Con una cota, el
 * costo de una corrida tiene techo; sin cota, el cron empieza a fallar por
 * crecimiento de datos sin que cambie una línea de código (hallazgo O-3 de
 * `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * El orden es parte de la cota: audiencias por fecha ascendente (primero la
 * más próxima) y pagos por vencimiento ascendente (primero el más atrasado),
 * así que lo que queda afuera es siempre lo menos urgente. Y cuando se recorta,
 * el resultado lo dice (`truncated`): un tope silencioso se lee como
 * "revisó todo".
 */
const SCAN_LIMIT = 500;

export interface AlertScanResult {
  tenantId: string;
  created: number;
  skipped: number;
  errors: number;
  /** `true` si el escaneo llegó al tope y quedó trabajo sin revisar. */
  truncated: boolean;
}

/**
 * Los `relatedId` que ya se notificaron dentro de la ventana de deduplicación,
 * en **una** consulta para todo el lote.
 *
 * Antes esto era un `findFirst` por ítem dentro del loop: con 500 pagos
 * vencidos acumulados, 500 viajes secuenciales a la base solo para descubrir
 * que no había nada que hacer. Era el N+1 que hacía crecer el costo del cron
 * con la antigüedad del centro.
 *
 * La clave incluye el usuario porque la deduplicación es por destinatario: el
 * mismo pago notificado a dos operadores distintos son dos notificaciones.
 */
async function yaNotificados(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    type: 'hearing_upcoming' | 'payment_overdue';
    relatedIds: string[];
  },
): Promise<Set<string>> {
  if (params.relatedIds.length === 0) return new Set();

  const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
  const filas = await prisma.notification.findMany({
    where: {
      tenantId: params.tenantId,
      type: params.type,
      relatedId: { in: params.relatedIds },
      createdDate: { gte: since },
    },
    select: { relatedId: true, userId: true },
  });

  return new Set(filas.map((f) => `${f.userId}:${f.relatedId}`));
}

/** La clave con la que `yaNotificados` indexa el conjunto. */
const claveDedupe = (userId: string, relatedId: string) =>
  `${userId}:${relatedId}`;

/**
 * Format a DateTime in Bogotá timezone-agnostic, compact form for the
 * notification message. The DB stores UTC; users will read "dd/MM/yyyy HH:mm".
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Scan for upcoming hearings in the next {@link HEARING_LOOKAHEAD_HOURS}
 * and create `hearing_upcoming` notifications for the assigned operator.
 *
 * Considers both `hearingDate` (primary) and `firstHearingDate` (fallback).
 * Only cases with an `operatorId` (assigned) trigger alerts — unassigned
 * cases are ignored because there's nobody to notify.
 */
export async function scanUpcomingHearings(
  prisma: PrismaClient,
  tenantId: string,
): Promise<AlertScanResult> {
  const now = new Date();
  const horizon = new Date(
    now.getTime() + HEARING_LOOKAHEAD_HOURS * 60 * 60 * 1000,
  );

  const result: AlertScanResult = {
    tenantId,
    created: 0,
    skipped: 0,
    errors: 0,
    truncated: false,
  };

  try {
    const cases = await prisma.case.findMany({
      where: {
        tenantId,
        OR: [
          { hearingDate: { gte: now, lte: horizon } },
          {
            // Only consider firstHearingDate if hearingDate is null.
            AND: [
              { hearingDate: null },
              { firstHearingDate: { gte: now, lte: horizon } },
            ],
          },
        ],
      },
      select: {
        id: true,
        caseNumber: true,
        debtorName: true,
        hearingDate: true,
        firstHearingDate: true,
        operatorId: true,
      },
      // Primero la audiencia más próxima: si hay que recortar, lo que queda
      // afuera es lo menos urgente.
      orderBy: { hearingDate: 'asc' },
      take: SCAN_LIMIT,
    });

    result.truncated = cases.length === SCAN_LIMIT;
    if (result.truncated) {
      logger.warn('El escaneo de audiencias llegó al tope de la corrida', {
        action: 'scanUpcomingHearings',
        tenantId,
        limite: SCAN_LIMIT,
      });
    }

    // Una sola consulta de deduplicación para todo el lote, antes del loop.
    const notificados = await yaNotificados(prisma, {
      tenantId,
      type: 'hearing_upcoming',
      relatedIds: cases.map((c) => c.id),
    });

    for (const c of cases) {
      if (!c.operatorId) {
        result.skipped += 1;
        continue;
      }
      const when = c.hearingDate ?? c.firstHearingDate;
      if (!when) {
        result.skipped += 1;
        continue;
      }

      if (notificados.has(claveDedupe(c.operatorId, c.id))) {
        result.skipped += 1;
        continue;
      }

      try {
        await prisma.notification.create({
          data: {
            type: 'hearing_upcoming',
            title: 'Audiencia próxima',
            message: `El caso ${c.caseNumber} (${c.debtorName}) tiene audiencia programada para el ${formatDateTime(when)}.`,
            userId: c.operatorId,
            caseId: c.id,
            relatedId: c.id,
            tenantId,
          },
        });
        result.created += 1;

        // Best-effort email
        if (process.env.ALERTS_EMAIL_ENABLED === 'true') {
          void sendHearingAlertEmail(prisma, {
            tenantId,
            operatorId: c.operatorId,
            caseNumber: c.caseNumber,
            debtorName: c.debtorName,
            when,
          });
        }
      } catch (error) {
        result.errors += 1;
        logger.error('No se pudo crear la alerta de audiencia próxima', error, {
          action: 'scanUpcomingHearings.create',
          tenantId,
          caseId: c.id,
        });
      }
    }
  } catch (error) {
    result.errors += 1;
    logger.error('Falló el escaneo de audiencias próximas', error, {
      action: 'scanUpcomingHearings',
      tenantId,
    });
  }

  return result;
}

/**
 * Scan for payments whose `dueDate` is in the past and whose status is still
 * `pendiente` or `parcial`. Creates `payment_overdue` notifications for the
 * case's assigned operator.
 *
 * Side-effect: also updates the payment status from `pendiente` → `vencido`
 * so the payment tracking UI reflects the real state. `parcial` is left
 * alone because a partial payment is still partially satisfied.
 */
export async function scanOverduePayments(
  prisma: PrismaClient,
  tenantId: string,
): Promise<AlertScanResult> {
  const now = new Date();

  const result: AlertScanResult = {
    tenantId,
    created: 0,
    skipped: 0,
    errors: 0,
    truncated: false,
  };

  try {
    const overdue = await prisma.payment.findMany({
      where: {
        tenantId,
        dueDate: { lt: now },
        status: { in: ['pendiente', 'parcial'] },
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
        case: {
          select: {
            id: true,
            caseNumber: true,
            debtorName: true,
            operatorId: true,
          },
        },
      },
      // Primero el pago más atrasado.
      orderBy: { dueDate: 'asc' },
      take: SCAN_LIMIT,
    });

    result.truncated = overdue.length === SCAN_LIMIT;
    if (result.truncated) {
      logger.warn('El escaneo de pagos vencidos llegó al tope de la corrida', {
        action: 'scanOverduePayments',
        tenantId,
        limite: SCAN_LIMIT,
      });
    }

    // `pendiente` -> `vencido` para todo el lote de una vez. Antes era un
    // `update` por pago dentro del loop. `parcial` se deja como está: un pago
    // parcial sigue parcialmente satisfecho.
    const aVencer = overdue
      .filter((p) => p.status === 'pendiente')
      .map((p) => p.id);
    if (aVencer.length > 0) {
      await prisma.payment.updateMany({
        where: { tenantId, id: { in: aVencer } },
        data: { status: 'vencido' },
      });
    }

    const notificados = await yaNotificados(prisma, {
      tenantId,
      type: 'payment_overdue',
      relatedIds: overdue.map((p) => p.id),
    });

    for (const p of overdue) {
      if (!p.case.operatorId) {
        result.skipped += 1;
        continue;
      }

      if (notificados.has(claveDedupe(p.case.operatorId, p.id))) {
        result.skipped += 1;
        continue;
      }

      try {
        const amount = p.amount.toString();
        const dueLabel = p.dueDate ? formatDateTime(p.dueDate) : '—';
        await prisma.notification.create({
          data: {
            type: 'payment_overdue',
            title: 'Pago vencido',
            message: `El caso ${p.case.caseNumber} (${p.case.debtorName}) tiene un pago vencido de ${amount} con fecha límite ${dueLabel}.`,
            userId: p.case.operatorId,
            caseId: p.case.id,
            relatedId: p.id,
            tenantId,
          },
        });
        result.created += 1;

        if (process.env.ALERTS_EMAIL_ENABLED === 'true') {
          void sendPaymentOverdueEmail(prisma, {
            tenantId,
            operatorId: p.case.operatorId,
            caseNumber: p.case.caseNumber,
            debtorName: p.case.debtorName,
            amount,
            dueDate: p.dueDate,
          });
        }
      } catch (error) {
        result.errors += 1;
        logger.error('No se pudo crear la alerta de pago vencido', error, {
          action: 'scanOverduePayments.create',
          tenantId,
          paymentId: p.id,
        });
      }
    }
  } catch (error) {
    result.errors += 1;
    logger.error('Falló el escaneo de pagos vencidos', error, {
      action: 'scanOverduePayments',
      tenantId,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Email helpers — intentionally minimal. Full branded templates live in
// `src/lib/email.ts`; we only format the payload here.
// ---------------------------------------------------------------------------

async function sendHearingAlertEmail(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    operatorId: string;
    caseNumber: string;
    debtorName: string;
    when: Date;
  },
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.operatorId },
      select: { email: true, name: true },
    });
    if (!user) return;
    await emailService.sendAlertEmail(user.email, {
      recipientName: user.name,
      database: params.tenantId,
      alertKind: 'hearing_upcoming',
      subject: `Audiencia próxima — Caso ${params.caseNumber}`,
      heading: 'Audiencia próxima',
      lines: [
        `Caso: ${params.caseNumber}`,
        `Deudor: ${params.debtorName}`,
        `Fecha y hora: ${formatDateTime(params.when)}`,
      ],
    });
  } catch (error) {
    logger.error('No se pudo enviar el correo de audiencia próxima', error, {
      action: 'sendHearingAlertEmail',
      tenantId: params.tenantId,
    });
  }
}

async function sendPaymentOverdueEmail(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    operatorId: string;
    caseNumber: string;
    debtorName: string;
    amount: string;
    dueDate: Date | null;
  },
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.operatorId },
      select: { email: true, name: true },
    });
    if (!user) return;
    await emailService.sendAlertEmail(user.email, {
      recipientName: user.name,
      database: params.tenantId,
      alertKind: 'payment_overdue',
      subject: `Pago vencido — Caso ${params.caseNumber}`,
      heading: 'Pago vencido',
      lines: [
        `Caso: ${params.caseNumber}`,
        `Deudor: ${params.debtorName}`,
        `Monto: ${params.amount}`,
        `Fecha límite: ${params.dueDate ? formatDateTime(params.dueDate) : '—'}`,
      ],
    });
  } catch (error) {
    logger.error('No se pudo enviar el correo de pago vencido', error, {
      action: 'sendPaymentOverdueEmail',
      tenantId: params.tenantId,
    });
  }
}
