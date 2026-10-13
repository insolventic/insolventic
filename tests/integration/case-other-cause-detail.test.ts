/**
 * Integration Tests: `otherCauseDetail` entre creación y edición.
 *
 * `updateCaseSchema` no declaraba `otherCauseDetail`, y `z.object` descarta en
 * silencio las claves que no conoce: editar un caso existente perdía el valor
 * antes de llegar a `prisma.case.update`, aunque `createCaseSchema` sí lo
 * aceptaba. Estos tests ejercen create -> edit sobre un store en memoria que
 * emula la columna (Prisma ignora los campos `undefined` en `update`).
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('next/server', () => ({
  after: jest.fn(),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/centro-conciliacion', () => ({
  resolveCenterFolderName: jest.fn().mockReturnValue('Centro Test'),
}));

import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import { updateCaseSchema } from '@/features/case/schemas';
import { createCase, updateCase } from '@/features/case/actions';

const VALID_CASE_PAYLOAD = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: '3',
  operatorId: ADMIN_USER.id,
  causes: ['OTRA'],
  debts: [
    {
      creditor: 'Banco Test',
      type: 'TARJETA_CREDITO',
      interestRate: '2.5',
      capitalAmount: '50000000',
      interestAmount: '0',
    },
  ],
};

const EDIT_BASE = {
  id: 'new-case-id',
  debtorId: DEBTOR.id,
  operatorId: ADMIN_USER.id,
};

/** Fila del caso tal como quedaría en la columna (una sola fila en memoria). */
let stored: Record<string, unknown>;

/** Aplica `data` como lo hace Prisma: las claves `undefined` no tocan nada. */
const applyUpdate = (data: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'version' || key === 'debtor' || key === 'operator') continue;
    stored[key] = value;
  }
};

/** `data` que updateCase le pasó a prisma.case.update en la última llamada. */
const updatedData = (): Record<string, unknown> => {
  const calls = mockPrisma.case.update.mock.calls;
  return (calls[calls.length - 1][0] as { data: Record<string, unknown> }).data;
};

describe('otherCauseDetail — create -> edit', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();

    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });

    stored = {};

    mockPrisma.case.findFirst.mockResolvedValue(null);
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.debtor.findUnique.mockResolvedValue(DEBTOR);
    mockPrisma.debtor.update.mockResolvedValue(DEBTOR);

    mockPrisma.case.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        stored = {
          ...CASE_DATA,
          id: 'new-case-id',
          caseNumber: 'CASO-000001',
          otherCauseDetail: data.otherCauseDetail ?? null,
        };
        return stored;
      },
    );
    // updateCase lee versión y fase persistidas antes de escribir.
    mockPrisma.case.findUnique.mockResolvedValue({
      version: 1,
      phase: CASE_DATA.phase,
    });
    mockPrisma.case.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        applyUpdate(data);
        return stored;
      },
    );
  });

  it('updateCaseSchema conserva otherCauseDetail al parsear (z.object descarta las claves que no conoce)', () => {
    const parsed = updateCaseSchema.parse({
      ...EDIT_BASE,
      otherCauseDetail: 'Pérdida del empleo',
    });

    expect(parsed.otherCauseDetail).toBe('Pérdida del empleo');
  });

  it('crear con otherCauseDetail y editarlo: el valor nuevo persiste', async () => {
    const created = await createCase({
      ...VALID_CASE_PAYLOAD,
      otherCauseDetail: 'Enfermedad del deudor',
    });
    expect(created.success).toBe(true);
    expect(stored.otherCauseDetail).toBe('Enfermedad del deudor');

    const edited = await updateCase({
      ...EDIT_BASE,
      otherCauseDetail: 'Pérdida del empleo',
    });

    expect(edited.success).toBe(true);
    expect(updatedData()).toMatchObject({
      otherCauseDetail: 'Pérdida del empleo',
    });
    expect(stored.otherCauseDetail).toBe('Pérdida del empleo');
  });

  it('una edición que no envía otherCauseDetail no lo borra', async () => {
    await createCase({
      ...VALID_CASE_PAYLOAD,
      otherCauseDetail: 'Enfermedad del deudor',
    });

    const edited = await updateCase({ ...EDIT_BASE, attorney: 'Dr. Nuevo' });

    expect(edited.success).toBe(true);
    expect(updatedData()).not.toHaveProperty('otherCauseDetail');
    expect(stored.otherCauseDetail).toBe('Enfermedad del deudor');
    expect(stored.attorney).toBe('Dr. Nuevo');
  });
});
