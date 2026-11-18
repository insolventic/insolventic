/**
 * F2 (auditoría 2026-10-27) en la edición de casos: la longitud máxima se
 * exige solo a los textos que cambian respecto de lo guardado. `updateCase`
 * ya lee de la base las columnas que va a escribir (para la auditoría), y la
 * comparación usa esa misma lectura.
 *
 * Arnés copiado de `update-case-fechas.test.ts`.
 */
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { P } from '@/lib/permissions';
import { updateCase } from '@/features/case/actions';

/** Columnas `DateTime` de `Case` que la edición puede mandar. */
const payloadBase = {
  id: 'case-1',
  version: 1,
  debtorId: 'debtor-1',
  operatorId: 'user-1',
  type: 'INSOLVENCY' as const,
  creditors: 1,
};

beforeEach(() => {
  resetAllMocks();
  mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
  mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-1' });
  jest.clearAllMocks();
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'Operadora',
      permissions: [P.EDITAR_CASOS, P.VER_TODOS_CASOS],
    },
    tenantId: 'tenant-1',
  });
  mockPrisma.case.findUnique.mockResolvedValue({
    id: 'case-1',
    tenantId: 'tenant-1',
    version: 1,
    phase: 'Inicial',
    filingDate: null,
    createdDate: new Date('2026-03-01T12:00:00Z'),
  });
  mockPrisma.case.update.mockResolvedValue({
    id: 'case-1',
    caseNumber: 'INSOL-000001',
    debtorName: 'Ana Torres',
    type: 'INSOLVENCY',
    totalDebt: 0,
    creditors: 1,
    phase: 'Inicial',
    createdDate: new Date(),
    operatorId: 'user-1',
    tenantId: 'tenant-1',
  });
});

const LARGO = 'A'.repeat(10_001);

function conGuardado(otherCauseDetail: string) {
  mockPrisma.case.findUnique.mockResolvedValue({
    id: 'case-1',
    tenantId: 'tenant-1',
    version: 1,
    phase: 'Inicial',
    filingDate: null,
    createdDate: new Date('2026-03-01T12:00:00Z'),
    otherCauseDetail,
  });
}

describe('updateCase — longitud máxima solo de lo que cambia (F2)', () => {
  it('un texto libre nuevo de más de 10.000 caracteres se rechaza', async () => {
    conGuardado('corto');
    const r = await updateCase({
      ...payloadBase,
      otherCauseDetail: LARGO,
    } as never);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/«otherCauseDetail».*10.000/);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('un texto viejo largo que se reenvía igual no bloquea la edición', async () => {
    conGuardado(LARGO);
    await updateCase({ ...payloadBase, otherCauseDetail: LARGO } as never);
    expect(mockPrisma.case.update).toHaveBeenCalled();
  });
});
