/**
 * Acciones de la papelera (`actions-papelera.ts`) y el bloqueo de
 * `deleteDebtor`, con Prisma mockeado. Fija lo que la base real no muestra
 * con facilidad: el orden auditoría → borrado, que una auditoría fallida
 * aborte, y que cada acción pida la papelera de forma explícita.
 *
 * El ciclo contra Postgres real: `tests/db/papelera-casos.db.test.ts`.
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
const mockCreateAuditLog = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));

import { P } from '@/lib/permissions';
import {
  getDeletedCases,
  purgeCase,
  restoreCase,
} from '@/features/case/actions-papelera';
import { deleteDebtor } from '@/features/debtor/actions';

const TENANT = 'tenant-1';
const CASE_ID = 'caso-en-papelera';
const CASE_NUMBER = 'INSOL-000007';

const FILA_PAPELERA = {
  id: CASE_ID,
  caseNumber: CASE_NUMBER,
  debtorName: 'Pepita Pérez',
  type: 'INSOLVENCY',
  phase: 'Inicial',
  operatorId: 'user-1',
  debtorId: 'debtor-1',
  driveFolderId: 'drive-abc',
  deletedAt: new Date('2026-11-08T20:00:00Z'),
  deletedByName: 'Beatriz',
  _count: { documents: 2, debts: 1, assets: 0, dependents: 0, payments: 3 },
};

function sesion(permissions: string[], id = 'user-1') {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id,
      name: 'Usuaria',
      email: 'usuaria@test.local',
      roleName: 'Administrador',
      professionalCard: 'TP-1',
      permissions,
    },
    tenantId: TENANT,
  });
}

function txMock(orden: string[]) {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const caseDelete = jest.fn().mockImplementation(async () => {
    orden.push('delete');
    return FILA_PAPELERA;
  });
  mockPrisma.$transaction.mockImplementation(async (fn: unknown) =>
    (fn as (tx: unknown) => unknown)({
      document: { deleteMany },
      debt: { deleteMany },
      asset: { deleteMany },
      legalProcess: { deleteMany },
      libranza: { deleteMany },
      suspendedService: { deleteMany },
      dependent: { deleteMany },
      case: { delete: caseDelete },
    }),
  );
  return caseDelete;
}

beforeEach(() => {
  resetAllMocks();
  mockAuthenticateUser.mockReset();
  mockCreateAuditLog.mockReset();
  mockCreateAuditLog.mockResolvedValue({ ok: true });
  jest.clearAllMocks();
});

describe('purgeCase — eliminación definitiva', () => {
  const ADMIN = [
    P.VER_TODOS_CASOS,
    P.ELIMINAR_CASOS,
    P.ELIMINAR_CASOS_DEFINITIVAMENTE,
  ];

  it('sin el permiso propio no consulta ni borra', async () => {
    sesion([P.VER_TODOS_CASOS, P.ELIMINAR_CASOS]);
    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });
    expect(result.success).toBe(false);
    expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('busca SOLO en la papelera: un caso activo no se destruye de un paso', async () => {
    sesion(ADMIN);
    mockPrisma.case.findFirst.mockResolvedValue(null);

    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('papelera');
    expect(mockPrisma.case.findFirst.mock.calls[0][0].where).toEqual({
      id: CASE_ID,
      tenantId: TENANT,
      deletedAt: { not: null },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('con el número equivocado no borra', async () => {
    sesion(ADMIN);
    mockPrisma.case.findFirst.mockResolvedValue(FILA_PAPELERA);
    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: 'INSOL-000008',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain(CASE_NUMBER);
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('audita ANTES de borrar, y el delete exige la papelera', async () => {
    sesion(ADMIN);
    mockPrisma.case.findFirst.mockResolvedValue(FILA_PAPELERA);
    const orden: string[] = [];
    mockCreateAuditLog.mockImplementation(async () => {
      orden.push('audit');
      return { ok: true };
    });
    const caseDelete = txMock(orden);

    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });

    expect(result.success).toBe(true);
    expect(orden).toEqual(['audit', 'delete']);
    expect(caseDelete.mock.calls[0][0].where).toEqual({
      id: CASE_ID,
      tenantId: TENANT,
      deletedAt: { not: null },
    });
    const registro = mockCreateAuditLog.mock.calls[0][0];
    expect(registro.action).toBe('purged');
    expect(registro.metadata).toMatchObject({
      caseNumber: CASE_NUMBER,
      paymentCount: 3,
      driveFolderId: 'drive-abc',
      confirmedByTypingCaseNumber: true,
    });
  });

  it('si la auditoría no queda escrita, no borra', async () => {
    sesion(ADMIN);
    mockPrisma.case.findFirst.mockResolvedValue(FILA_PAPELERA);
    mockCreateAuditLog.mockResolvedValue({ ok: false });

    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('un rol acotado no purga un caso que no es suyo', async () => {
    sesion(
      [P.VER_CASOS_PROPIOS, P.ELIMINAR_CASOS_DEFINITIVAMENTE],
      'otro-usuario',
    );
    mockPrisma.case.findFirst.mockResolvedValue(FILA_PAPELERA);

    const result = await purgeCase({
      id: CASE_ID,
      confirmCaseNumber: CASE_NUMBER,
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('restoreCase', () => {
  it('sin Eliminar casos no restaura', async () => {
    sesion([P.VER_TODOS_CASOS]);
    const result = await restoreCase({ id: CASE_ID });
    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });

  it('quita la marca solo si sigue en la papelera, y lo audita', async () => {
    sesion([P.VER_TODOS_CASOS, P.ELIMINAR_CASOS]);
    mockPrisma.case.findFirst.mockResolvedValue(FILA_PAPELERA);
    mockPrisma.case.update.mockResolvedValue({});

    const result = await restoreCase({ id: CASE_ID });

    expect(result.success).toBe(true);
    expect(mockPrisma.case.update).toHaveBeenCalledWith({
      where: { id: CASE_ID, tenantId: TENANT, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });
    expect(mockCreateAuditLog.mock.calls[0][0].action).toBe('restored');
  });

  it('un caso que no está en la papelera responde error', async () => {
    sesion([P.VER_TODOS_CASOS, P.ELIMINAR_CASOS]);
    mockPrisma.case.findFirst.mockResolvedValue(null);
    const result = await restoreCase({ id: CASE_ID });
    expect(result.success).toBe(false);
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
  });
});

describe('getDeletedCases', () => {
  it('pide solo la papelera y acota por la visibilidad del rol', async () => {
    sesion([P.VER_CASOS_PROPIOS, P.ELIMINAR_CASOS], 'abogada-1');
    mockPrisma.case.findMany.mockResolvedValue([]);

    await getDeletedCases();

    expect(mockPrisma.case.findMany.mock.calls[0][0].where).toEqual({
      tenantId: TENANT,
      operatorId: 'abogada-1',
      deletedAt: { not: null },
    });
  });

  it('sin permiso de alcance no consulta', async () => {
    sesion([P.ELIMINAR_CASOS]);
    const result = await getDeletedCases();
    expect(result).toEqual({ success: true, data: [] });
    expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
  });
});

describe('deleteDebtor — no se lleva expedientes', () => {
  it('con casos (incluidos los de la papelera) se niega y no abre transacción', async () => {
    sesion([P.ELIMINAR_DEUDORES]);
    mockPrisma.case.count.mockResolvedValue(2);

    const result = await deleteDebtor('debtor-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('2 expedientes');
    const where = mockPrisma.case.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ debtorId: 'debtor-1', tenantId: TENANT });
    // La clave presente (y undefined) es la que hace contar también la
    // papelera: sin ella la extensión agregaría `deletedAt: null`.
    expect(Object.prototype.hasOwnProperty.call(where, 'deletedAt')).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
