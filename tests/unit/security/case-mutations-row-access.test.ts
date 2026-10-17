/**
 * El guard de GC-A1, cableado en las server actions reales.
 *
 * `case-access-guard.test.ts` prueba el helper en aislamiento; esto prueba que
 * las actions lo **llamen**. Es la mitad que importa: el hallazgo no era que la
 * regla estuviera mal escrita, sino que las mutaciones no la invocaban.
 *
 * Cada caso negativo afirma dos cosas, no una:
 *   1. la action responde `success: false`, y
 *   2. **no se escribió nada** (`update`/`delete`/`create` sin llamadas).
 * Lo segundo es lo que tiene dientes: un guard puesto después de la escritura
 * devolvería el error igual y habría mutado la base.
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

import { TENANT, PERMISSIONS } from '../../helpers/fixtures';
import {
  updateCase,
  deleteCase,
  updateCasePhase,
  removeDebtFromCase,
  removeAssetFromCase,
  addDependentToCase,
} from '@/features/case/actions';

const P = PERMISSIONS;

/** El expediente está asignado a OTRO abogado. */
const CASE_AJENO = {
  id: 'case-ajeno',
  operatorId: 'user-otro-abogado',
  debtorId: 'debtor-ajeno',
  phase: 'Inicial',
  caseNumber: 'INSOL-000007',
  debtorName: 'Pepita Pérez',
  version: 1,
};

/** Abogado con EDITAR_CASOS y ELIMINAR_CASOS, pero solo sobre los suyos. */
function signInAbogadoAjeno() {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'user-abogado-ajeno',
      name: 'Abogado Ajeno',
      email: 'ajeno@test.com',
      professionalCard: 'TP-999',
      roleName: 'Abogado',
      permissions: [
        P.VIEW_CASES,
        P.VIEW_OWN_CASES,
        P.EDIT_CASES,
        P.DELETE_CASES,
      ],
    },
    tenantId: TENANT.id,
  });
}

function noSeEscribioNada() {
  expect(mockPrisma.case.update).not.toHaveBeenCalled();
  expect(mockPrisma.case.delete).not.toHaveBeenCalled();
  expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  expect(mockPrisma.asset.delete).not.toHaveBeenCalled();
  expect(mockPrisma.dependent.create).not.toHaveBeenCalled();
}

const SIN_PERMISOS = /No tienes permisos para acceder a este caso/;

describe('mutaciones de expediente — visibilidad por fila (GC-A1)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    signInAbogadoAjeno();
  });

  it('updateCase rechaza un expediente ajeno y no abre transacción', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    const result = await updateCase({ id: CASE_AJENO.id, totalDebt: '999' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    // El guard va ANTES de la transacción: ni se abre.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    noSeEscribioNada();
  });

  it('deleteCase rechaza un expediente ajeno y no borra nada', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    // GC-M6: `confirmCaseNumber` ahora es obligatorio. Se manda CORRECTO a
    // propósito, para que lo que falle sea el control de acceso y no el
    // schema: si no, este test dejaría de probar GC-A1.
    const result = await deleteCase({
      id: CASE_AJENO.id,
      confirmCaseNumber: CASE_AJENO.caseNumber,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    noSeEscribioNada();
  });

  it('updateCasePhase rechaza un expediente ajeno', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    const result = await updateCasePhase({
      caseId: CASE_AJENO.id,
      newPhase: 'Admisión',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    noSeEscribioNada();
  });

  it('removeDebtFromCase sube al expediente padre y lo rechaza', async () => {
    mockPrisma.debt.findUnique.mockResolvedValue({ caseId: CASE_AJENO.id });
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    const result = await removeDebtFromCase({ debtId: 'debt-de-otro' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  });

  it('removeAssetFromCase sube al expediente padre y lo rechaza', async () => {
    mockPrisma.asset.findUnique.mockResolvedValue({ caseId: CASE_AJENO.id });
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    const result = await removeAssetFromCase({ assetId: 'asset-de-otro' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    expect(mockPrisma.asset.delete).not.toHaveBeenCalled();
  });

  it('addDependentToCase rechaza un expediente ajeno', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);

    const result = await addDependentToCase({
      caseId: CASE_AJENO.id,
      name: 'Hijo',
      age: '10',
      relationship: 'Hijo',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(SIN_PERMISOS);
    expect(mockPrisma.dependent.create).not.toHaveBeenCalled();
  });

  it('una sub-entidad inexistente da su propio mensaje, no "Caso no encontrado"', async () => {
    mockPrisma.debt.findUnique.mockResolvedValue(null);

    const result = await removeDebtFromCase({ debtId: 'no-existe' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Deuda no encontrada');
    expect(mockPrisma.debt.delete).not.toHaveBeenCalled();
  });

  describe('el camino feliz sigue abierto (el guard no bloquea de más)', () => {
    beforeEach(() => {
      // Mismo abogado, pero ahora el expediente SÍ es suyo.
      mockPrisma.case.findUnique.mockResolvedValue({
        ...CASE_AJENO,
        operatorId: 'user-abogado-ajeno',
      });
    });

    it('addDependentToCase acepta un expediente propio', async () => {
      mockPrisma.dependent.create.mockResolvedValue({
        id: 'dep-1',
        name: 'Hijo',
        age: 10,
        relationship: 'Hijo',
        caseId: CASE_AJENO.id,
        tenantId: TENANT.id,
      });

      const result = await addDependentToCase({
        caseId: CASE_AJENO.id,
        name: 'Hijo',
        age: '10',
        relationship: 'Hijo',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.dependent.create).toHaveBeenCalled();
    });

    it('removeDebtFromCase acepta una deuda de un expediente propio', async () => {
      mockPrisma.debt.findUnique.mockResolvedValue({ caseId: CASE_AJENO.id });
      mockPrisma.debt.delete.mockResolvedValue({
        id: 'debt-1',
        creditor: { name: 'Banco' },
        creditorId: 'cred-1',
        amount: 1000,
        type: 'FINANCIAL',
        interestRate: 1,
      });

      const result = await removeDebtFromCase({ debtId: 'debt-1' });

      // Lo que este test afirma es que el guard NO bloquea: el borrado se
      // emite. La forma de la respuesta la cubre `debtResponseSchema` y sus
      // propios tests; acá la fila mockeada es parcial a propósito.
      expect(mockPrisma.debt.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'debt-1', tenantId: TENANT.id },
        }),
      );
      if (!result.success) {
        expect(result.error).not.toMatch(SIN_PERMISOS);
      }
    });
  });

  describe('quien ve todos los casos no se ve afectado', () => {
    it('updateCasePhase de un Administrador pasa el guard', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-admin',
          name: 'Admin',
          email: 'admin@test.com',
          professionalCard: 'TP-001',
          roleName: 'Administrador',
          permissions: [P.VIEW_CASES, P.VIEW_ALL_CASES, P.EDIT_CASES],
        },
        tenantId: TENANT.id,
      });
      mockPrisma.case.findUnique.mockResolvedValue(CASE_AJENO);
      mockPrisma.case.update.mockResolvedValue({ ...CASE_AJENO });

      const result = await updateCasePhase({
        caseId: CASE_AJENO.id,
        newPhase: 'Admisión',
      });

      // Pasa el control de acceso: si falla, es por otra razón del flujo, no
      // por permisos de fila.
      if (!result.success) {
        expect(result.error).not.toMatch(SIN_PERMISOS);
      }
      expect(mockPrisma.case.update).toHaveBeenCalled();
    });
  });
});
