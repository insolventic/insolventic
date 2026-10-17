/**
 * `revokeUserSessions` (A-6) — un administrador fuerza el cierre de todas
 * las sesiones vigentes de un usuario, incrementando `User.tokenVersion`.
 *
 * `authenticateUser`/`refreshAccessToken` (ver tests/unit/auth/token-version.test.ts)
 * son quienes de verdad rechazan el token viejo la próxima vez que se use o
 * se refresque; este test cubre la otra mitad: que la acción exige permiso,
 * no se puede ejecutar contra otro tenant, e incrementa la columna correcta
 * con un audit log.
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

const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

import { P } from '@/lib/permissions';
import { revokeUserSessions } from '@/features/user/actions';

const TENANT_ID = 'tenant-armonia';
const ADMIN = { id: 'admin-1', name: 'Admin', professionalCard: 'TP-1' };

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
});

describe('revokeUserSessions — A-6', () => {
  it('con permiso: incrementa tokenVersion scopeado al tenant del admin', async () => {
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN, permissions: [P.EDITAR_USUARIOS] },
      tenantId: TENANT_ID,
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-objetivo',
      name: 'Usuario Objetivo',
      tokenVersion: 2,
    });

    const result = await revokeUserSessions('user-objetivo');

    expect(result.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-objetivo', tenantId: TENANT_ID },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('deja audit log de la revocación', async () => {
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN, permissions: [P.EDITAR_USUARIOS] },
      tenantId: TENANT_ID,
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-objetivo',
      name: 'Usuario Objetivo',
      tokenVersion: 2,
    });

    await revokeUserSessions('user-objetivo');

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updated',
        entityType: 'user',
        entityId: 'user-objetivo',
        tenantId: TENANT_ID,
        actor: expect.objectContaining({ userId: ADMIN.id }),
      }),
    );
  });

  it('sin permiso: no toca la base', async () => {
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN, permissions: [P.VER_USUARIOS] },
      tenantId: TENANT_ID,
    });

    const result = await revokeUserSessions('user-objetivo');

    expect(result.success).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('usuario de otro tenant: el where compuesto no matchea, Prisma no encuentra la fila', async () => {
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN, permissions: [P.EDITAR_USUARIOS] },
      tenantId: TENANT_ID,
    });
    mockPrisma.user.update.mockRejectedValue(
      new Error('Record to update not found.'),
    );

    const result = await revokeUserSessions('user-de-otro-tenant');

    expect(result.success).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-de-otro-tenant', tenantId: TENANT_ID },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
