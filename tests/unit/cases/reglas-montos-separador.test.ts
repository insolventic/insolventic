/**
 * Unit Tests: las reglas del trámite leen los montos con separador (N-A1-01).
 *
 * `validateCaseBusinessRules` sumaba las acreencias con `parseFloat`, y
 * `parseFloat("80.000.000")` es `80`. Con montos escritos como los produce
 * `MoneyInput` (punto de miles, coma decimal) la deuda total quedaba en unos
 * cientos de pesos y ni la mínima cuantía (40 SMMLV) ni el tope de 150 SMMLV
 * se disparaban en el servidor. La persistencia ya leía con `parsearMonto`:
 * regla y BD veían números distintos para el mismo expediente.
 *
 * Los bordes se fijan con el SMMLV del año pedido (no se toca la tabla):
 *   2026 → 40 × 1.750.905 = 70.036.200 · 150 × 1.750.905 = 262.635.750
 *   2025 → 40 × 1.423.500 = 56.940.000 · 150 × 1.423.500 = 213.525.000
 * Las dos reglas son estrictas (`>`): el valor exacto del umbral no las dispara.
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

import {
  getSmmlv,
  validateCaseBusinessRules,
  validateCaseComplete,
} from '@/features/case/validation-rules';
import { formatearMonto } from '@/features/case/monto';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { createCase } from '@/features/case/actions';

const aDebt = (capital: string, interest = '0') => ({
  creditor: 'Banco Test',
  type: 'TARJETA_CREDITO',
  interestRate: '2,5',
  capitalAmount: capital,
  interestAmount: interest,
});

const base = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '0',
  creditors: '1',
  operatorId: ADMIN_USER.id,
  causes: ['SOBREENDEUDAMIENTO'],
};

const exigeApoderado = (
  debts: ReturnType<typeof aDebt>[],
  year: number,
): boolean =>
  validateCaseBusinessRules(
    { ...base, attorney: undefined, debts },
    { mode: 'create', year },
  ).issues.some((i) => i.message.includes('apoderado judicial'));

const supera150 = (debts: ReturnType<typeof aDebt>[], year: number): boolean =>
  validateCaseBusinessRules(
    { ...base, attorney: 'Apoderado Test', debts },
    { mode: 'create', year },
  ).warnings.some((w) => w.message.includes('150 SMMLV'));

describe('mínima cuantía (40 SMMLV) con montos con separador — N-A1-01', () => {
  it('2026: el valor exacto del umbral no exige apoderado', () => {
    expect(exigeApoderado([aDebt('70.036.200')], 2026)).toBe(false);
  });

  it('2026: un peso por encima del umbral exige apoderado', () => {
    // Antes: parseFloat("70.036.201") = 70.036 → la regla no se disparaba.
    expect(exigeApoderado([aDebt('70.036.201')], 2026)).toBe(true);
  });

  it('2026: un centavo por encima, con coma decimal, exige apoderado', () => {
    expect(exigeApoderado([aDebt('70.036.200,01')], 2026)).toBe(true);
    expect(exigeApoderado([aDebt('70.036.200,00')], 2026)).toBe(false);
  });

  it('suma capital e intereses, los dos con separador', () => {
    expect(exigeApoderado([aDebt('70.000.000', '36.200')], 2026)).toBe(false);
    expect(exigeApoderado([aDebt('70.000.000', '36.201')], 2026)).toBe(true);
  });

  it('suma varias acreencias con separador', () => {
    const debts = [aDebt('35.018.100'), aDebt('35.018.100,50')];
    expect(exigeApoderado(debts, 2026)).toBe(true);
  });

  it('sigue leyendo la forma vieja con punto decimal y los números', () => {
    expect(exigeApoderado([aDebt('70036200.5')], 2026)).toBe(true);
    expect(exigeApoderado([aDebt('70036200')], 2026)).toBe(false);
    expect(
      validateCaseBusinessRules(
        {
          ...base,
          attorney: undefined,
          debts: [
            { ...aDebt('0'), capitalAmount: 70_036_201 as unknown as string },
          ],
        },
        { mode: 'create', year: 2026 },
      ).isValid,
    ).toBe(false);
  });

  it('el umbral sigue el SMMLV del año de radicación', () => {
    // 60M con separador: por debajo del umbral de 2026, por encima del de 2025.
    expect(exigeApoderado([aDebt('60.000.000')], 2026)).toBe(false);
    expect(exigeApoderado([aDebt('60.000.000')], 2025)).toBe(true);
    expect(exigeApoderado([aDebt('56.940.000')], 2025)).toBe(false);
    expect(exigeApoderado([aDebt('56.940.000,01')], 2025)).toBe(true);
  });

  it('un monto que no es monto no se cuenta (no rompe la suma)', () => {
    expect(exigeApoderado([aDebt('abc'), aDebt('70.036.200')], 2026)).toBe(
      false,
    );
  });
});

describe('tope de 150 SMMLV con montos con separador — N-A1-01', () => {
  it('2026: el valor exacto no advierte; un peso más, sí', () => {
    expect(supera150([aDebt('262.635.750')], 2026)).toBe(false);
    expect(supera150([aDebt('262.635.751')], 2026)).toBe(true);
    expect(supera150([aDebt('262.635.750,01')], 2026)).toBe(true);
  });

  it('2025: mismo borde con su propio SMMLV', () => {
    expect(supera150([aDebt('213.525.000')], 2025)).toBe(false);
    expect(supera150([aDebt('213.525.000,01')], 2025)).toBe(true);
  });
});

describe('validateCaseComplete lee los montos igual — N-A1-01', () => {
  // `validateCaseComplete` (la del formulario) evalúa el tope de 150 SMMLV,
  // no la mínima cuantía; se fija que la suma también lee el separador.
  it('la deuda total con separador dispara el tope de 150 SMMLV', () => {
    const advierte = (monto: string) =>
      validateCaseComplete(
        { ...base, debts: [aDebt(monto)] },
        [],
        2026,
      ).warnings.some((w) => w.message.includes('150 SMMLV'));
    expect(advierte('262.635.750')).toBe(false);
    expect(advierte('262.635.751')).toBe(true);
  });
});

describe('createCase rechaza en el servidor la deuda con separador — N-A1-01', () => {
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

  it('sin apoderado y sobre 40 SMMLV, con el formato de MoneyInput, no escribe', async () => {
    // Año en curso: sin fecha de radicación, `createCase` resuelve el SMMLV
    // con la fecha de creación, que es hoy.
    const monto = formatearMonto(40 * getSmmlv(new Date().getFullYear()) + 1);
    expect(monto).toContain('.');

    const result = await createCase({ ...base, debts: [aDebt(monto)] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('apoderado judicial');
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('en el umbral exacto con separador, crea el expediente', async () => {
    const monto = formatearMonto(40 * getSmmlv(new Date().getFullYear()));

    const result = await createCase({ ...base, debts: [aDebt(monto)] });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.create).toHaveBeenCalled();
  });
});
