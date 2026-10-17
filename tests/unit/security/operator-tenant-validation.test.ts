/**
 * GC-M2: `operatorId` llegaba del cliente validado solo como `z.string()` y se
 * escribía con `operator: { connect: { id: operatorId } }`.
 *
 * El `connect` de Prisma solo exige que el id EXISTA — no que pertenezca al
 * tenant. Así que bastaba mandar el id de un usuario del otro centro para
 * dejarle un expediente asignado. El deudor sí se validaba contra
 * `{ id, tenantId }`; el operador se quedó sin su mitad.
 *
 * El `<select>` del formulario ofrece solo los operadores del centro
 * (`getAssignableOperators`), así que esto no es alcanzable desde la UI: es
 * alcanzable invocando la server action, que es un endpoint.
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
  createAuditLog: jest.fn().mockResolvedValue({ ok: true }),
}));

import { TENANT, PERMISSIONS, ADMIN_USER, CASE_DATA } from '../../helpers/fixtures';
import { assertOperatorInTenant } from '@/features/case/case-access';
import { createCase, updateCase } from '@/features/case/actions';

const CASE_ID = 'case-1';
const OPERADOR_AJENO = 'user-del-otro-centro';
const NO_PERTENECE = /no pertenece a este centro/i;

function signIn() {
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
        PERMISSIONS.CREATE_CASES,
        PERMISSIONS.EDIT_CASES,
      ],
    },
    tenantId: TENANT.id,
  });
}

describe('assertOperatorInTenant (GC-M2)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  it('consulta al usuario acotado por tenantId', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

    await assertOperatorInTenant('user-1', TENANT.id);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', tenantId: TENANT.id },
      select: { id: true },
    });
  });

  it('lanza cuando el usuario no es de este tenant', async () => {
    // El `where` lleva tenantId, así que un usuario del otro centro no aparece.
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      assertOperatorInTenant(OPERADOR_AJENO, TENANT.id),
    ).rejects.toThrow(NO_PERTENECE);
  });

  it('no lanza cuando sí pertenece', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' });

    await expect(
      assertOperatorInTenant('user-1', TENANT.id),
    ).resolves.toBeUndefined();
  });
});

describe('createCase — valida el operador antes de crear', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    signIn();
  });

  const PAYLOAD_MINIMO = {
    debtorId: 'debtor-1',
    type: 'CONCILIATION' as const,
    totalDebt: '0',
    creditors: 0,
    operatorId: OPERADOR_AJENO,
    causes: [],
  };

  it('un operador de otro centro aborta la creación y no escribe nada', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await createCase(PAYLOAD_MINIMO as never);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(NO_PERTENECE);
    // Lo que importa: ni se buscó el deudor ni se abrió transacción.
    expect(mockPrisma.debtor.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('la validación va antes de la generación del número de caso', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await createCase(PAYLOAD_MINIMO as never);

    // `findFirst` de Case es la lectura del último consecutivo.
    expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
  });
});

describe('updateCase — valida el operador solo cuando viene', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    signIn();

    mockPrisma.case.findUnique
      .mockResolvedValueOnce({
        id: CASE_ID,
        operatorId: ADMIN_USER.id,
        debtorId: 'debtor-1',
      })
      .mockResolvedValueOnce({ version: 1, phase: 'Inicial' });

    mockPrisma.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function'
        ? (fn as (tx: unknown) => unknown)(mockPrisma)
        : undefined,
    );
    mockPrisma.case.update.mockResolvedValue({
      ...CASE_DATA,
      id: CASE_ID,
    });
  });

  it('un operador de otro centro aborta la edición sin abrir transacción', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await updateCase({
      id: CASE_ID,
      operatorId: OPERADOR_AJENO,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(NO_PERTENECE);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('un operador del centro deja pasar la edición', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });

    const result = await updateCase({
      id: CASE_ID,
      operatorId: 'user-del-centro',
    });

    if (!result.success) {
      expect(result.error).not.toMatch(NO_PERTENECE);
    }
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-del-centro', tenantId: TENANT.id },
      select: { id: true },
    });
  });

  it('una edición SIN operatorId no consulta usuarios (pre-generation-form)', async () => {
    // `pre-generation-form.tsx` manda {id} + los campos del paquete, sin
    // reenviar operatorId. Exigirlo rompería esa pantalla.
    const result = await updateCase({ id: CASE_ID, tramite: 'Otro' });

    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.error).not.toMatch(NO_PERTENECE);
    }
  });
});
