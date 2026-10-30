/**
 * Unit Tests — src/features/notification/alerts.ts
 *
 * Focus on behavior the cron relies on:
 *   1. Upcoming-hearing scan creates one notification per case in window.
 *   2. Dedupe: if an identical notification was written recently, skip it.
 *   3. Overdue-payment scan flips pendiente → vencido and notifies operator.
 *   4. Cases/payments with no operator are skipped (nothing to notify).
 *   5. Los dos escaneos están acotados (`take`) y lo dicen cuando recortan.
 *   6. La deduplicación es UNA consulta por lote, no una por ítem (O-3).
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('@/lib/email', () => ({
  emailService: {
    sendAlertEmail: jest.fn().mockResolvedValue(true),
  },
}));

// El reporte de errores va por el logger (único punto hacia Sentry); se mockea
// para silenciar la consola y poder afirmar qué se reporta.
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
import { logger } from '@/lib/logger';

import {
  scanUpcomingHearings,
  scanOverduePayments,
} from '@/features/notification/alerts';

// Fixed "now" for deterministic windowing.
const FIXED_NOW = new Date('2026-04-15T10:00:00.000Z');

describe('alerts.ts — scanUpcomingHearings', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a notification for each case with hearingDate in window', async () => {
    const inWindow = new Date(FIXED_NOW.getTime() + 12 * 60 * 60 * 1000);

    mockPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        caseNumber: 'C-001',
        debtorName: 'Juan Pérez',
        hearingDate: inWindow,
        firstHearingDate: null,
        operatorId: 'user-1',
      },
    ]);
    mockPrisma.notification.findFirst.mockResolvedValue(null); // no dedupe hit
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'hearing_upcoming',
        userId: 'user-1',
        caseId: 'case-1',
        relatedId: 'case-1',
        tenantId: 'armonia',
      }),
    });
  });

  it('reporta por el logger (con action, tenant y caso) si falla crear una alerta y sigue con las demás', async () => {
    const inWindow = new Date(FIXED_NOW.getTime() + 12 * 60 * 60 * 1000);
    const row = (id: string) => ({
      id,
      caseNumber: id,
      debtorName: 'Juan Pérez',
      hearingDate: inWindow,
      firstHearingDate: null,
      operatorId: 'user-1',
    });
    mockPrisma.case.findMany.mockResolvedValue([row('case-1'), row('case-2')]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    const boom = new Error('db down');
    mockPrisma.notification.create
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce({ id: 'notif-2' });

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.errors).toBe(1);
    expect(result.created).toBe(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      boom,
      expect.objectContaining({
        action: 'scanUpcomingHearings.create',
        tenantId: 'armonia',
        caseId: 'case-1',
      }),
    );
  });

  it('skips cases that were notified within the dedupe window', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        caseNumber: 'C-001',
        debtorName: 'Juan Pérez',
        hearingDate: new Date(FIXED_NOW.getTime() + 3 * 60 * 60 * 1000),
        firstHearingDate: null,
        operatorId: 'user-1',
      },
    ]);
    // Una notificación de hace 2 h. La deduplicación es por lote: una sola
    // consulta que devuelve los pares (userId, relatedId) ya notificados.
    mockPrisma.notification.findMany.mockResolvedValue([
      { relatedId: 'case-1', userId: 'user-1' },
    ]);

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('skips cases with no assigned operator', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-orphan',
        caseNumber: 'C-002',
        debtorName: 'Ana Gómez',
        hearingDate: new Date(FIXED_NOW.getTime() + 2 * 60 * 60 * 1000),
        firstHearingDate: null,
        operatorId: null,
      },
    ]);

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('falls back to firstHearingDate when hearingDate is null', async () => {
    mockPrisma.case.findMany.mockResolvedValue([
      {
        id: 'case-1',
        caseNumber: 'C-001',
        debtorName: 'Juan Pérez',
        hearingDate: null,
        firstHearingDate: new Date(FIXED_NOW.getTime() + 6 * 60 * 60 * 1000),
        operatorId: 'user-1',
      },
    ]);
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
  });
});

describe('alerts.ts — scanOverduePayments', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates notification + flips pendiente → vencido for overdue payments', async () => {
    const pastDue = new Date(FIXED_NOW.getTime() - 24 * 60 * 60 * 1000);

    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        amount: { toString: () => '500000' },
        dueDate: pastDue,
        status: 'pendiente',
        case: {
          id: 'case-1',
          caseNumber: 'C-001',
          debtorName: 'Juan Pérez',
          operatorId: 'user-1',
        },
      },
    ]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
    // Un solo `updateMany` para todo el lote, en vez de un `update` por pago.
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'armonia', id: { in: ['pay-1'] } },
      data: { status: 'vencido' },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'payment_overdue',
        userId: 'user-1',
        caseId: 'case-1',
        relatedId: 'pay-1',
        tenantId: 'armonia',
      }),
    });
  });

  it('does not change status of partial payments but still notifies', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-2',
        amount: { toString: () => '250000' },
        dueDate: new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: 'parcial',
        case: {
          id: 'case-1',
          caseNumber: 'C-001',
          debtorName: 'Ana',
          operatorId: 'user-1',
        },
      },
    ]);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
    // Un pago parcial sigue parcialmente satisfecho: no entra en el lote que
    // pasa a `vencido`.
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });

  it('skips payments on cases with no operator', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-orphan',
        amount: { toString: () => '100000' },
        dueDate: new Date(FIXED_NOW.getTime() - 60 * 1000),
        status: 'pendiente',
        case: {
          id: 'case-orphan',
          caseNumber: 'C-003',
          debtorName: 'Carlos',
          operatorId: null,
        },
      },
    ]);

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
/**
 * La cota de los escaneos — O-3.
 *
 * Los dos `findMany` no tenían `take`, y el conjunto que recorren crece de
 * forma monótona: un pago vencido sigue vencido hasta que se paga. El costo de
 * la corrida de mañana es mayor que el de hoy sin que cambie una línea de
 * código, y el cron no tenía presupuesto para eso.
 */
describe('alerts.ts — la cota de los escaneos', () => {
  const LIMITE = 500;

  /** `n` casos con audiencia dentro de la ventana. */
  const casos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `case-${i}`,
      caseNumber: `C-${i}`,
      debtorName: 'Deudor',
      hearingDate: new Date(FIXED_NOW.getTime() + 3 * 60 * 60 * 1000),
      firstHearingDate: null,
      operatorId: 'user-1',
    }));

  /** `n` pagos vencidos. */
  const pagos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `pay-${i}`,
      amount: { toString: () => '1000' },
      dueDate: new Date(FIXED_NOW.getTime() - 24 * 60 * 60 * 1000),
      status: 'parcial',
      case: {
        id: `case-${i}`,
        caseNumber: `C-${i}`,
        debtorName: 'Deudor',
        operatorId: 'user-1',
      },
    }));

  beforeEach(() => {
    resetAllMocks();
    // El logger se mockea a nivel de modulo: sin esto, los `warn` de un test
    // sobreviven al siguiente y el que afirma que NO se registro nada falla.
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.create.mockResolvedValue({ id: 'n-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('el escaneo de audiencias pide `take` y el orden que hace útil el recorte', async () => {
    mockPrisma.case.findMany.mockResolvedValue([]);

    await scanUpcomingHearings(mockPrisma as never, 'armonia');

    const args = mockPrisma.case.findMany.mock.calls[0][0];
    expect(args.take).toBe(LIMITE);
    // Primero la audiencia más próxima: lo que queda afuera es lo menos
    // urgente, no una fila al azar.
    expect(args.orderBy).toEqual({ hearingDate: 'asc' });
  });

  it('el escaneo de pagos pide `take` y ordena por vencimiento', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([]);

    await scanOverduePayments(mockPrisma as never, 'armonia');

    const args = mockPrisma.payment.findMany.mock.calls[0][0];
    expect(args.take).toBe(LIMITE);
    expect(args.orderBy).toEqual({ dueDate: 'asc' });
  });

  it('cuando llega al tope lo dice en el resultado y lo registra', async () => {
    mockPrisma.case.findMany.mockResolvedValue(casos(LIMITE));

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    // Un tope silencioso se lee como "revisó todo".
    expect(result.truncated).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('tope'),
      expect.objectContaining({ tenantId: 'armonia', limite: LIMITE }),
    );
  });

  it('por debajo del tope, `truncated` es false y no registra nada', async () => {
    mockPrisma.case.findMany.mockResolvedValue(casos(3));

    const result = await scanUpcomingHearings(mockPrisma as never, 'armonia');

    expect(result.truncated).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('la deduplicación es UNA consulta para todo el lote, no una por ítem', async () => {
    mockPrisma.case.findMany.mockResolvedValue(casos(120));

    await scanUpcomingHearings(mockPrisma as never, 'armonia');

    // Era un `findFirst` por caso: 120 viajes secuenciales a la base solo
    // para descubrir que no había nada que hacer.
    expect(mockPrisma.notification.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.notification.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'armonia',
          type: 'hearing_upcoming',
          relatedId: { in: expect.arrayContaining(['case-0', 'case-119']) },
        }),
      }),
    );
  });

  it('el paso de `pendiente` a `vencido` es un solo `updateMany` para el lote', async () => {
    const lote = pagos(50).map((p, i) => ({
      ...p,
      status: i % 2 === 0 ? 'pendiente' : 'parcial',
    }));
    mockPrisma.payment.findMany.mockResolvedValue(lote);
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 25 });

    await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.payment.updateMany.mock.calls[0][0];
    // Solo los 25 `pendiente`; los `parcial` quedan como están.
    expect(args.where.id.in).toHaveLength(25);
    expect(args.data).toEqual({ status: 'vencido' });
  });

  it('un lote sin ningún `pendiente` no escribe nada', async () => {
    mockPrisma.payment.findMany.mockResolvedValue(pagos(10));

    await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('la deduplicación distingue destinatarios: el mismo pago a otro operador sí se notifica', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        amount: { toString: () => '1000' },
        dueDate: new Date(FIXED_NOW.getTime() - 60 * 1000),
        status: 'parcial',
        case: {
          id: 'case-1',
          caseNumber: 'C-001',
          debtorName: 'Deudor',
          operatorId: 'user-2',
        },
      },
    ]);
    // Ya notificado, pero a OTRO usuario.
    mockPrisma.notification.findMany.mockResolvedValue([
      { relatedId: 'pay-1', userId: 'user-1' },
    ]);
    mockPrisma.notification.create.mockResolvedValue({ id: 'n-1' });

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
