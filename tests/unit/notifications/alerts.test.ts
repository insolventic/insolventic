/**
 * Unit Tests — src/features/notification/alerts.ts
 *
 * Focus on behavior the cron relies on:
 *   1. Upcoming-hearing scan creates one notification per case in window.
 *   2. Dedupe: if an identical notification was written recently, skip it.
 *   3. Overdue-payment scan flips pendiente → vencido and notifies operator.
 *   4. Cases/payments with no operator are skipped (nothing to notify).
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
    // Simulate an existing notification from 2h ago.
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

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
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.payment.update.mockResolvedValue({});
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
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
    mockPrisma.notification.findFirst.mockResolvedValue(null);

    const result = await scanOverduePayments(mockPrisma as never, 'armonia');

    expect(result.created).toBe(1);
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
