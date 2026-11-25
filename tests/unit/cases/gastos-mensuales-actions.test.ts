/**
 * `createCase` y `updateCase` calculan los gastos mensuales en el servidor.
 *
 * Fija la regla del proyecto "reglas de negocio en el backend": el detalle y el
 * total que se escriben salen de `calcularGastos` sobre los valores digitados;
 * ningún total, divisor ni equivalente enviado por el cliente llega a la base.
 * También que el bloque se valide en el borde (negativos y decimales se
 * rechazan con el mismo mensaje que en la UI), que las 7 columnas viejas ya no
 * se escriban y que el gasto del deudor (dato maestro) se sincronice con el
 * total calculado al crear.
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
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
  generateDocumentsForAdmission: jest.fn().mockResolvedValue([]),
  generateDocumentsForAgreement: jest.fn().mockResolvedValue([]),
  generateDocumentsForFailure: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/payment/actions', () => ({
  generatePaymentSchedule: jest.fn().mockResolvedValue({ success: true }),
}));

import { Prisma } from '@prisma/client';

import { P } from '@/lib/permissions';
import { createCase, updateCase } from '@/features/case/actions';
import { MENSAJE_PESOS_ENTEROS } from '@/features/case/gastos-mensuales';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../../helpers/fixtures';

const GASTOS = {
  conceptos: {
    ARRIENDO: { valor: '1.000.000' },
    IMPUESTOS: { valor: '1,200,000' },
    MATRICULA: { valor: '1.200.000', periodicidad: 'UNIVERSIDAD' },
  },
  otros: [{ concepto: 'Gas', valor: '40.000' }],
};
const TOTAL = 1_000_000 + 100_000 + 200_000 + 40_000;

const datosDe = (mock: unknown): Record<string, unknown> =>
  (
    (mock as jest.Mock).mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    }
  ).data;

describe('createCase', () => {
  const base = {
    debtorId: DEBTOR.id,
    type: 'INSOLVENCY' as const,
    totalDebt: '0',
    creditors: '1',
    operatorId: ADMIN_USER.id,
    causes: ['SOBREENDEUDAMIENTO'],
    monthlyExpenses: 2_750_000,
    // Un acreedor chico: las reglas del trámite exigen al menos uno.
    debts: [
      {
        creditor: 'Banco Test',
        type: 'TARJETA_CREDITO',
        interestRate: '2,5',
        capitalAmount: '1.000.000',
        interestAmount: '0',
      },
    ],
  };

  beforeEach(() => {
    resetAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });
    mockPrisma.debtor.findUnique.mockResolvedValue({
      name: DEBTOR.name,
      maritalStatus: 'SOLTERO',
    });
    mockPrisma.case.findFirst.mockResolvedValue(null);
    mockPrisma.case.create.mockResolvedValue({
      ...CASE_DATA,
      id: 'new-case-id',
    });
  });

  it('escribe el detalle y el total calculados en el servidor', async () => {
    const r = await createCase({ ...base, gastosMensuales: GASTOS } as never);
    expect(r.error).toBeUndefined();

    const data = datosDe(mockPrisma.case.create);
    expect(data.totalGastosMensuales).toBe(TOTAL);
    expect(data.gastosMensualesDetalle).toEqual({
      version: 1,
      conceptos: [
        {
          clave: 'ARRIENDO',
          valor: 1000000,
          periodicidad: 'MENSUAL',
          divisor: 1,
          mensual: 1000000,
        },
        {
          clave: 'MATRICULA',
          valor: 1200000,
          periodicidad: 'UNIVERSIDAD',
          divisor: 6,
          mensual: 200000,
        },
        {
          clave: 'IMPUESTOS',
          valor: 1200000,
          periodicidad: 'ANUAL',
          divisor: 12,
          mensual: 100000,
        },
      ],
      otros: [{ concepto: 'Gas', valor: 40000, mensual: 40000 }],
      total: TOTAL,
    });
  });

  it('ignora el total y las columnas viejas que mande el cliente', async () => {
    await createCase({
      ...base,
      gastosMensuales: { ...GASTOS, total: 1 },
      totalGastosMensuales: 999,
      gastosVivienda: 123,
      serviciosManutencion: [{ tipo: 'GAS', nombre: 'Gas' }],
    } as never);

    const data = datosDe(mockPrisma.case.create);
    expect(data.totalGastosMensuales).toBe(TOTAL);
    expect(data).not.toHaveProperty('gastosVivienda');
    expect(data).not.toHaveProperty('serviciosManutencion');
    expect(data.gastosMensualesDetalle).not.toHaveProperty('total', 1);
  });

  it('sincroniza el gasto del deudor con el total calculado', async () => {
    await createCase({ ...base, gastosMensuales: GASTOS } as never);
    expect(datosDe(mockPrisma.debtor.update)).toMatchObject({
      monthlyExpenses: TOTAL,
    });
  });

  it('sin ningún gasto cargado no escribe detalle y conserva el gasto del deudor', async () => {
    await createCase({
      ...base,
      gastosMensuales: { conceptos: { ARRIENDO: { valor: '' } }, otros: [] },
    } as never);

    const data = datosDe(mockPrisma.case.create);
    expect(data).not.toHaveProperty('gastosMensualesDetalle');
    expect(data).not.toHaveProperty('totalGastosMensuales');
    expect(datosDe(mockPrisma.debtor.update)).toMatchObject({
      monthlyExpenses: 2_750_000,
    });
  });

  it.each([
    ['decimal', { ARRIENDO: { valor: '1.000,50' } }, MENSAJE_PESOS_ENTEROS],
    [
      'negativo',
      { ARRIENDO: { valor: '-1' } },
      'El valor no puede ser negativo',
    ],
  ])('rechaza un valor %s sin escribir nada', async (_, conceptos, mensaje) => {
    const result = await createCase({
      ...base,
      gastosMensuales: { conceptos },
    } as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain(mensaje);
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });
});

describe('updateCase', () => {
  const payload = {
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

  it('recalcula y escribe detalle y total', async () => {
    await updateCase({
      ...payload,
      gastosMensuales: GASTOS,
      totalGastosMensuales: 5,
    } as never);
    const data = datosDe(mockPrisma.case.update);
    expect(data.totalGastosMensuales).toBe(TOTAL);
    expect((data.gastosMensualesDetalle as { total: number }).total).toBe(
      TOTAL,
    );
  });

  it('una edición que no trae el bloque no toca las columnas de gastos', async () => {
    await updateCase(payload as never);
    const data = datosDe(mockPrisma.case.update);
    expect(data).not.toHaveProperty('gastosMensualesDetalle');
    expect(data).not.toHaveProperty('totalGastosMensuales');
  });

  it('vaciar el bloque deja el detalle en NULL (vuelve a la cadena legada)', async () => {
    await updateCase({
      ...payload,
      gastosMensuales: { conceptos: {}, otros: [] },
    } as never);
    const data = datosDe(mockPrisma.case.update);
    expect(data.gastosMensualesDetalle).toBe(Prisma.DbNull);
    expect(data.totalGastosMensuales).toBeNull();
  });

  it('el diff de auditoría lee las columnas de gastos que escribe', async () => {
    await updateCase({ ...payload, gastosMensuales: GASTOS } as never);
    const select = (
      (mockPrisma.case.findUnique as jest.Mock).mock.calls.at(-1)?.[0] as {
        select: Record<string, unknown>;
      }
    ).select;
    expect(select).toMatchObject({
      gastosMensualesDetalle: true,
      totalGastosMensuales: true,
    });
  });
});
