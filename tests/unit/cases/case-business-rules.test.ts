/**
 * Unit Tests: reglas de negocio del trámite aplicadas en backend (C-2).
 *
 * Antes de C-2 `validation-rules.ts` solo lo importaban los componentes del
 * formulario de creación, así que un POST directo a la server action saltaba
 * todas las reglas. Estos tests cubren la función pura y su aplicación real
 * en `createCase`.
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
  SMMLV_BY_YEAR,
  LATEST_SMMLV_YEAR,
  getSmmlv,
  isSmmlvYearConfirmed,
  validateCaseBusinessRules,
  formatValidationErrors,
  validateMinimaCuantia,
  validateDebtLimits,
} from '@/features/case/validation-rules';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { createCase } from '@/features/case/actions';

const aDebt = (capital: string) => ({
  creditor: 'Banco Test',
  type: 'TARJETA_CREDITO',
  interestRate: '2.5',
  capitalAmount: capital,
  interestAmount: '0',
});

const validInsolvency = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: '1',
  operatorId: ADMIN_USER.id,
  causes: ['SOBREENDEUDAMIENTO'],
  debts: [aDebt('50000000')],
};

describe('SMMLV por año (C-2) — PENDIENTE DE VALIDACIÓN JURÍDICA', () => {
  it('resuelve el valor propio de cada año cargado', () => {
    expect(getSmmlv(2024)).toBe(1_300_000);
    expect(getSmmlv(2025)).toBe(1_423_500);
    // Decreto 0159 de 2026 (norma operativa tras la suspensión del 1469/2025).
    expect(getSmmlv(2026)).toBe(1_750_905);
  });

  it('2026 ya NO degrada al valor de 2025', () => {
    // Regresión: mientras el decreto no estaba cargado, la mínima cuantía de
    // 2026 se calculaba sobre la base de 2025.
    expect(isSmmlvYearConfirmed(2026)).toBe(true);
    expect(getSmmlv(2026)).not.toBe(getSmmlv(2025));
    expect(LATEST_SMMLV_YEAR).toBe(2026);
  });

  it('el incremento 2025→2026 es el 23% que declara el decreto', () => {
    // Cross-check aritmético contra la fuente: valida ambos valores a la vez.
    expect(Math.round(getSmmlv(2025) * 1.23)).toBe(getSmmlv(2026));
  });

  it('marca como no confirmado un año sin decreto cargado', () => {
    expect(isSmmlvYearConfirmed(2024)).toBe(true);
    expect(isSmmlvYearConfirmed(2026)).toBe(true);
    // 2027 aún no tiene decreto: no se inventa la base de un umbral legal.
    expect(isSmmlvYearConfirmed(2027)).toBe(false);
  });

  it('degrada al último año conocido en vez de lanzar', () => {
    expect(getSmmlv(2030)).toBe(SMMLV_BY_YEAR[LATEST_SMMLV_YEAR]);
  });

  it('la mínima cuantía se calcula sobre el SMMLV del año pedido', () => {
    // 40 SMMLV 2025 = 56.940.000 → una deuda de 55M no exige apoderado en 2025
    // pero sí en 2024 (40 × 1.300.000 = 52.000.000).
    expect(validateMinimaCuantia(55_000_000, false, 2025)).toHaveLength(0);
    expect(validateMinimaCuantia(55_000_000, false, 2024)).toHaveLength(1);
    // 40 SMMLV 2026 = 70.036.200: el umbral sube otra vez.
    expect(validateMinimaCuantia(65_000_000, false, 2026)).toHaveLength(0);
    expect(validateMinimaCuantia(71_000_000, false, 2026)).toHaveLength(1);
  });

  it('el tope de 150 SMMLV también sigue el año', () => {
    const debt2025 = 150 * 1_423_500 + 1;
    expect(validateDebtLimits(debt2025, 3, 2025)).toHaveLength(1);
    expect(validateDebtLimits(debt2025 - 2, 3, 2025)).toHaveLength(0);
  });
});

describe('validateCaseBusinessRules — guard puro (C-2)', () => {
  describe('camino feliz', () => {
    it('acepta un expediente de insolvencia completo', () => {
      const result = validateCaseBusinessRules(validInsolvency, {
        mode: 'create',
        year: 2025,
      });
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('no exige acreedores ni causas a conciliación', () => {
      const result = validateCaseBusinessRules(
        { debtorId: DEBTOR.id, type: 'CONCILIATION' },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(true);
    });

    it('no exige acreedores ni causas a acuerdos de apoyo', () => {
      const result = validateCaseBusinessRules(
        { debtorId: DEBTOR.id, type: 'SUPPORT_AGREEMENT' },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(true);
    });

    it('en modo update no exige campos que el payload no toca', () => {
      const result = validateCaseBusinessRules(
        { type: 'INSOLVENCY', attorney: 'Nuevo apoderado' },
        { mode: 'update', year: 2025 },
      );
      expect(result.isValid).toBe(true);
    });

    it('devuelve advertencias sin invalidar (gastos > ingresos)', () => {
      const result = validateCaseBusinessRules(
        {
          ...validInsolvency,
          monthlyIncome: 1_000_000,
          monthlyExpenses: 3_000_000,
        },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('bypass intentado — debe fallar', () => {
    it('rechaza insolvencia sin acreedores', () => {
      const result = validateCaseBusinessRules(
        { ...validInsolvency, debts: [] },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field === 'debts')).toBe(true);
    });

    it('rechaza insolvencia sin causa declarada', () => {
      const result = validateCaseBusinessRules(
        { ...validInsolvency, causes: [] },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field === 'causes')).toBe(true);
    });

    it('rechaza superar el límite de 150 acreedores', () => {
      const result = validateCaseBusinessRules(
        {
          ...validInsolvency,
          debts: Array.from({ length: 151 }, () => aDebt('100000')),
        },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((i) => i.message.includes('150 acreedores')),
      ).toBe(true);
    });

    it('rechaza superar la mínima cuantía sin apoderado (40 SMMLV)', () => {
      const overMinimaCuantia = String(40 * 1_423_500 + 1_000_000);
      const result = validateCaseBusinessRules(
        {
          ...validInsolvency,
          attorney: undefined,
          debts: [aDebt(overMinimaCuantia)],
        },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
      expect(
        result.issues.some((i) => i.message.includes('apoderado judicial')),
      ).toBe(true);
    });

    it('acepta la misma deuda si SÍ hay apoderado', () => {
      const overMinimaCuantia = String(40 * 1_423_500 + 1_000_000);
      const result = validateCaseBusinessRules(
        {
          ...validInsolvency,
          attorney: 'Dra. Pérez',
          debts: [aDebt(overMinimaCuantia)],
        },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(true);
    });

    it('rechaza período de gracia mayor a 24 meses', () => {
      const result = validateCaseBusinessRules(
        {
          ...validInsolvency,
          gracePeriodRequested: true,
          gracePeriodMonths: 36,
        },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
    });

    it('rechaza declarar procesos judiciales sin adjuntar ninguno', () => {
      const result = validateCaseBusinessRules(
        { ...validInsolvency, hasLegalProcesses: true, legalProcesses: [] },
        { mode: 'create', year: 2025 },
      );
      expect(result.isValid).toBe(false);
    });

    it('formatValidationErrors aplana los errores en un solo mensaje', () => {
      const result = validateCaseBusinessRules(
        { ...validInsolvency, debts: [], causes: [] },
        { mode: 'create', year: 2025 },
      );
      const msg = formatValidationErrors(result);
      expect(msg).toContain('acreedor');
      expect(msg).toContain('causa');
      expect(msg.split(' | ').length).toBeGreaterThan(1);
    });
  });
});

describe('createCase — las reglas se aplican en la server action (C-2)', () => {
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

  it('crea el expediente cuando el payload cumple las reglas', async () => {
    const result = await createCase(validInsolvency);

    expect(result.success).toBe(true);
    expect(mockPrisma.case.create).toHaveBeenCalled();
  });

  it('BYPASS: rechaza un POST directo sin acreedores, sin escribir en BD', async () => {
    const result = await createCase({ ...validInsolvency, debts: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('reglas del trámite');
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza un POST directo sin causa declarada', async () => {
    const result = await createCase({ ...validInsolvency, causes: [] });

    expect(result.success).toBe(false);
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('BYPASS: rechaza superar la mínima cuantía sin apoderado', async () => {
    // Derivado del año en curso, no clavado a un SMMLV concreto: `createCase`
    // resuelve el umbral con `new Date().getFullYear()`.
    const overMinimaCuantia = String(
      40 * getSmmlv(new Date().getFullYear()) + 5_000_000,
    );
    const result = await createCase({
      ...validInsolvency,
      debts: [aDebt(overMinimaCuantia)],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('apoderado judicial');
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('no bloquea un caso de conciliación por reglas de insolvencia', async () => {
    const result = await createCase({
      debtorId: DEBTOR.id,
      type: 'CONCILIATION',
      totalDebt: '0',
      creditors: '0',
      operatorId: ADMIN_USER.id,
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.create).toHaveBeenCalled();
  });
});
