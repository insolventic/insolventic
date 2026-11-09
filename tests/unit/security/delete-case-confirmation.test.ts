/**
 * GC-M6: `deleteCase` manda el caso a la papelera (soft-delete, 2026-11-08) y
 * conserva las salvaguardas de la mitigación interina: confirmación escrita y
 * audit log ANTES de marcar la fila. El borrado físico es `purgeCase`
 * (`tests/unit/cases/papelera-actions.test.ts`).
 *
 * Los modos de falla que esto atrapa:
 *
 *  1. Invocar la action sin pasar por el diálogo. Si la confirmación viviera
 *     solo en el componente, bastaría llamar `deleteCase({ id })`.
 *  2. Confirmar con un número cualquiera. La comparación tiene que ser contra
 *     el valor de la BASE, no contra otro campo del mismo payload.
 *  3. Perder el registro: un expediente que desaparece de la vista del centro
 *     sin rastro de quién lo hizo.
 *  4. Volver a borrar de verdad: `deleteCase` ya no abre transacción ni llama
 *     a ningún `delete`.
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

// GC-M4: `createAuditLog` ya no es fire-and-forget — espera el insert y
// devuelve `{ ok }` en vez de lanzar (hay 8 modulos que la invocan con `void`
// y un reject las convertiria en unhandled rejections).
const mockCreateAuditLog = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
  generateDocumentsForAdmission: jest.fn().mockResolvedValue([]),
  generateDocumentsForAgreement: jest.fn().mockResolvedValue([]),
  generateDocumentsForFailure: jest.fn().mockResolvedValue([]),
}));

import {
  TENANT,
  PERMISSIONS,
  ADMIN_USER,
  CASE_DATA,
} from '../../helpers/fixtures';
import { deleteCase } from '@/features/case/actions';

const CASE_NUMBER = 'INSOL-000042';
const CASE_ID = 'case-a-borrar';

/** La fila mínima del guard de acceso. */
const ACCESS_ROW = {
  id: CASE_ID,
  operatorId: ADMIN_USER.id,
  debtorId: 'debtor-1',
};

/** El snapshot que la action lee antes de borrar. */
const SNAPSHOT = {
  caseNumber: CASE_NUMBER,
  debtorName: 'Pepita Pérez',
  type: 'INSOLVENCY',
  phase: 'En negociación',
  driveFolderId: 'drive-folder-abc',
  _count: { documents: 7, debts: 3, assets: 2, dependents: 1 },
};

function signInAdmin() {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleName: 'Administrador',
      professionalCard: 'TP-001',
      permissions: [
        PERMISSIONS.VIEW_CASES,
        PERMISSIONS.VIEW_ALL_CASES,
        PERMISSIONS.DELETE_CASES,
      ],
    },
    tenantId: TENANT.id,
  });
}

/** `assertCaseAccess` consulta primero; el snapshot después. */
function mockLookups() {
  mockPrisma.case.findUnique
    .mockResolvedValueOnce(ACCESS_ROW)
    .mockResolvedValueOnce(SNAPSHOT);
}

/** El `update` que manda el caso a la papelera. */
function mockMarcado() {
  mockPrisma.case.update.mockResolvedValue({
    ...CASE_DATA,
    id: CASE_ID,
    caseNumber: CASE_NUMBER,
    debtorName: SNAPSHOT.debtorName,
  });
}

describe('deleteCase — confirmación escrita y auditoría previa (GC-M6)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    mockCreateAuditLog.mockReset();
    mockCreateAuditLog.mockResolvedValue({ ok: true });
    jest.clearAllMocks();
    signInAdmin();
  });

  describe('la confirmación se exige en el SERVIDOR', () => {
    it('sin confirmCaseNumber, el schema rechaza y no se borra nada', async () => {
      mockLookups();

      // Así se invocaba antes, y así invocaría quien saltara el diálogo.
      const result = await deleteCase({ id: CASE_ID } as never);

      expect(result.success).toBe(false);
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });

    it('con el número EQUIVOCADO, rechaza y nombra el correcto', async () => {
      mockLookups();

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: 'INSOL-000041',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain(CASE_NUMBER);
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });

    it('con una cadena vacía, el schema la rechaza antes de consultar', async () => {
      mockLookups();

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: '   ',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('se compara contra el número de la BASE, no contra el payload', async () => {
      // El cliente manda un número que coincide consigo mismo pero NO con el
      // del expediente. Si la comparación fuera cliente-contra-cliente,
      // pasaría.
      mockLookups();

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: 'CUALQUIER-COSA',
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('con el número CORRECTO, lo manda a la papelera', async () => {
      mockLookups();
      mockMarcado();

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: CASE_NUMBER,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalled();
    });

    it('acepta el número con espacios alrededor (se recorta)', async () => {
      mockLookups();
      mockMarcado();

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: `  ${CASE_NUMBER}  `,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('el audit log va ANTES del borrado y se espera', () => {
    it('se escribe con await antes de marcar la fila', async () => {
      mockLookups();
      const orden: string[] = [];
      mockCreateAuditLog.mockImplementation(async () => {
        orden.push('audit');
        return { ok: true };
      });
      mockPrisma.case.update.mockImplementation(async () => {
        orden.push('papelera');
        return {
          ...CASE_DATA,
          id: CASE_ID,
          caseNumber: CASE_NUMBER,
        };
      });

      await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

      // Este es el assert que importa: el orden.
      expect(orden).toEqual(['audit', 'papelera']);
    });

    it('si el audit log NO queda escrito, NO se manda a la papelera', async () => {
      mockLookups();
      mockMarcado();
      mockCreateAuditLog.mockResolvedValue({ ok: false });

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: CASE_NUMBER,
      });

      expect(result.success).toBe(false);
      // Un expediente no desaparece de la vista del centro sin registro.
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('si el audit log LANZA, tampoco se manda a la papelera', async () => {
      mockLookups();
      mockMarcado();
      mockCreateAuditLog.mockRejectedValue(new Error('auditoria caida'));

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: CASE_NUMBER,
      });

      expect(result.success).toBe(false);
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });

    it('el snapshot lleva número, tipo, fase y conteos de lo que se pierde', async () => {
      mockLookups();
      mockMarcado();

      await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

      const metadata = mockCreateAuditLog.mock.calls[0][0].metadata;
      expect(metadata).toMatchObject({
        caseNumber: CASE_NUMBER,
        type: 'INSOLVENCY',
        phase: 'En negociación',
        documentCount: 7,
        debtCount: 3,
        assetCount: 2,
        dependentCount: 1,
        confirmedByTypingCaseNumber: true,
      });
    });

    it('el snapshot NO lleva datos personales del deudor', async () => {
      mockLookups();
      mockMarcado();

      await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

      const metadata = mockCreateAuditLog.mock.calls[0][0].metadata;
      const claves = Object.keys(metadata).join(' ').toLowerCase();
      // Bajo la Ley 1581, el audit log no es el lugar para conservar los datos
      // personales del expediente que se está borrando.
      for (const prohibida of [
        'cedula',
        'idnumber',
        'email',
        'correo',
        'telefono',
        'phone',
        'ingreso',
        'income',
        'direccion',
        'address',
      ]) {
        expect(claves).not.toContain(prohibida);
      }
    });

    it('registra que la carpeta de Drive NO se borró (el pendiente de GC-M6)', async () => {
      mockLookups();
      mockMarcado();

      await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

      const metadata = mockCreateAuditLog.mock.calls[0][0].metadata;
      expect(metadata.driveFolderId).toBe('drive-folder-abc');
      expect(metadata.driveFolderDeleted).toBe(false);
    });

    it('no se escribe un SEGUNDO audit log después del borrado', async () => {
      mockLookups();
      mockMarcado();

      await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('los guards anteriores siguen en pie', () => {
    it('sin ELIMINAR_CASOS no se llega ni a leer el caso', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-abogado',
          name: 'Abogado',
          email: 'a@test.com',
          professionalCard: 'TP-2',
          permissions: [PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_OWN_CASES],
        },
        tenantId: TENANT.id,
      });

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: CASE_NUMBER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('permisos');
      expect(mockPrisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('la confirmación correcta NO salta la visibilidad por fila', async () => {
      mockAuthenticateUser.mockResolvedValue({
        user: {
          id: 'user-abogado-ajeno',
          name: 'Abogado Ajeno',
          email: 'ajeno@test.com',
          professionalCard: 'TP-3',
          permissions: [
            PERMISSIONS.VIEW_CASES,
            PERMISSIONS.VIEW_OWN_CASES,
            PERMISSIONS.DELETE_CASES,
          ],
        },
        tenantId: TENANT.id,
      });
      // El expediente es de otro operador.
      mockPrisma.case.findUnique.mockResolvedValue({
        ...ACCESS_ROW,
        operatorId: 'otro-operador',
      });

      const result = await deleteCase({
        id: CASE_ID,
        confirmCaseNumber: CASE_NUMBER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(
        /No tienes permisos para acceder a este caso/,
      );
      expect(mockPrisma.case.update).not.toHaveBeenCalled();
    });
  });
});

describe('deleteCase — papelera, no borrado físico', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    mockCreateAuditLog.mockReset();
    mockCreateAuditLog.mockResolvedValue({ ok: true });
    jest.clearAllMocks();
    signInAdmin();
  });

  it('marca deletedAt y quién lo eliminó, sin transacción ni delete', async () => {
    mockLookups();
    mockMarcado();

    const result = await deleteCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.case.delete).not.toHaveBeenCalled();
    expect(mockPrisma.case.deleteMany).not.toHaveBeenCalled();

    const args = mockPrisma.case.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: CASE_ID, tenantId: TENANT.id });
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(args.data.deletedById).toBe(ADMIN_USER.id);
    expect(args.data.deletedByName).toBe(ADMIN_USER.name);
  });

  it('el registro de auditoría dice que fue a la papelera', async () => {
    mockLookups();
    mockMarcado();

    await deleteCase({ id: CASE_ID, confirmCaseNumber: CASE_NUMBER });

    const registro = mockCreateAuditLog.mock.calls[0][0];
    expect(registro.action).toBe('deleted');
    expect(registro.metadata.papelera).toBe(true);
  });
});
