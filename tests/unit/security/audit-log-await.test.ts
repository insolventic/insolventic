/**
 * GC-M4 — las dos mitades del hallazgo:
 *
 *  (a) `createAuditLog` se ESPERA de verdad. La función hacía
 *      `void prisma.auditLog.create(...)`, así que un `await` en el call-site
 *      no esperaba nada: en Vercel serverless el proceso puede terminar al
 *      devolver la respuesta y matar el insert en vuelo. Este test afirma que
 *      ahora la promesa que devuelve depende del insert, que es lo único que
 *      hace que el `await` de las 16 llamadas signifique algo.
 *
 *  (b) El registro de `updateCase` dice QUÉ cambió. Antes era solo
 *      "Se ha actualizado el caso X".
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

import { TENANT, PERMISSIONS, ADMIN_USER, CASE_DATA } from '../../helpers/fixtures';

describe('createAuditLog — espera el insert (GC-M4, parte a)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  it('la promesa NO se resuelve antes de que el insert termine', async () => {
    const { createAuditLog } = await import('@/features/audit-log/actions');

    let resolverInsert: (v: unknown) => void = () => {};
    mockPrisma.auditLog.create.mockImplementation(
      () => new Promise((res) => (resolverInsert = res)),
    );

    let resuelta = false;
    const promesa = createAuditLog({
      action: 'updated',
      entityType: 'case',
      entityId: 'case-1',
      entityName: 'INSOL-1',
      actor: { userId: 'u', userName: 'U', userCedula: 'TP' },
      tenantId: TENANT.id,
    }).then((r) => {
      resuelta = true;
      return r;
    });

    // Un tick: con el `void` de antes, acá ya estaría resuelta.
    await Promise.resolve();
    expect(resuelta).toBe(false);

    resolverInsert({ id: 'audit-1' });
    await expect(promesa).resolves.toEqual({ ok: true });
  });

  it('un fallo del insert devuelve ok:false y NO lanza', async () => {
    const { createAuditLog } = await import('@/features/audit-log/actions');

    mockPrisma.auditLog.create.mockRejectedValue(new Error('BD caída'));

    // No lanza: hay 8 módulos que la llaman con `void` y un reject los
    // convertiría en unhandled rejections.
    await expect(
      createAuditLog({
        action: 'deleted',
        entityType: 'case',
        entityId: 'case-1',
        entityName: 'INSOL-1',
        actor: { userId: 'u', userName: 'U', userCedula: 'TP' },
        tenantId: TENANT.id,
      }),
    ).resolves.toEqual({ ok: false });
  });
});

describe('updateCase — el registro dice qué cambió (GC-M4, parte b)', () => {
  const CASE_ID = 'case-1';

  /** Lo que la base tiene antes de la edición. */
  const ANTES = {
    version: 3,
    phase: 'Inicial',
    tramite: 'Negociación de deudas',
    convened: 'Ana',
    hearingDate: new Date('2026-03-15T12:00:00.000Z'),
  };

  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();

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
          PERMISSIONS.EDIT_CASES,
        ],
      },
      tenantId: TENANT.id,
    });

    // 1ª lectura: el guard de acceso. 2ª: el "antes" del diff, dentro de la tx.
    mockPrisma.case.findUnique
      .mockResolvedValueOnce({
        id: CASE_ID,
        operatorId: ADMIN_USER.id,
        debtorId: 'debtor-1',
      })
      .mockResolvedValueOnce(ANTES);

    mockPrisma.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function'
        ? (fn as (tx: unknown) => unknown)(mockPrisma)
        : undefined,
    );
    mockPrisma.case.update.mockResolvedValue({
      ...CASE_DATA,
      id: CASE_ID,
      caseNumber: 'INSOL-000001',
      debtorName: 'Ana Torres',
    });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  async function editar(payload: Record<string, unknown>) {
    const { updateCase } = await import('@/features/case/actions');
    return updateCase({ id: CASE_ID, ...payload } as never);
  }

  function metadataDelRegistro() {
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    return mockPrisma.auditLog.create.mock.calls[0][0].data.metadata;
  }

  it('nombra el campo que cambió y no los que no', async () => {
    await editar({ tramite: 'Otro trámite', convened: 'Ana' });

    const metadata = metadataDelRegistro();
    expect(metadata.changedFields).toBe('tramite');
    expect(metadata.changedFieldCount).toBe(1);
    expect(metadata.submittedFieldCount).toBeGreaterThanOrEqual(2);
  });

  it('registra el valor de un campo del trámite', async () => {
    await editar({ tramite: 'Otro trámite' });

    const metadata = metadataDelRegistro();
    expect(metadata.tramite_antes).toBe('Negociación de deudas');
    expect(metadata.tramite_despues).toBe('Otro trámite');
  });

  it('de un campo PERSONAL registra que cambió, pero no el valor', async () => {
    await editar({ convened: 'Ana María Torres' });

    const metadata = metadataDelRegistro();
    expect(metadata.changedFields).toBe('convened');
    // El nombre del convocado no entra al audit log.
    expect(metadata.convened_antes).toBeUndefined();
    expect(metadata.convened_despues).toBeUndefined();
  });

  it('una fecha reenviada sin cambios NO figura como cambiada', async () => {
    // El formulario de edición reenvía todo; esto es lo que antes habría
    // hecho que el registro listara las 13 fechas en cada edición.
    await editar({ hearingDate: '2026-03-15' });

    const metadata = metadataDelRegistro();
    expect(metadata.changedFields).toBe('');
    expect(metadata.changedFieldCount).toBe(0);
  });

  it('una fecha que SÍ cambió figura, con el antes y el después', async () => {
    await editar({ hearingDate: '2026-04-20' });

    const metadata = metadataDelRegistro();
    expect(metadata.changedFields).toBe('hearingDate');
    expect(metadata.hearingDate_antes).toBe('2026-03-15');
    expect(metadata.hearingDate_despues).toBe('2026-04-20');
  });

  it('el "antes" se lee con un select acotado, no la fila de 265 columnas', async () => {
    await editar({ tramite: 'Otro' });

    // 2ª llamada = el "antes" del diff.
    const select = mockPrisma.case.findUnique.mock.calls[1][0].select;
    expect(select.version).toBe(true);
    expect(select.phase).toBe(true);
    expect(select.tramite).toBe(true);
    // No se pide nada que el payload no traiga.
    expect(select.debtorIdNumber).toBeUndefined();
    expect(Object.keys(select).length).toBeLessThan(20);
  });
});
