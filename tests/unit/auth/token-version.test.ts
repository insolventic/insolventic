/**
 * Unit Tests: revocación de sesiones vía `User.tokenVersion` (A-6).
 *
 * Hoy un cambio o reseteo de contraseña no invalida los JWT ya emitidos:
 * siguen siendo válidos hasta que expiran por su cuenta (hasta 24h el access
 * token, hasta 7 días el refresh token). `tokenVersion` cierra esa puerta:
 * se incrementa en esos eventos, el JWT lleva la versión vigente al
 * emitirse, y `authenticateUser`/`refreshAccessToken`/`validateSession` —los
 * tres puntos que ya leen la fila del usuario en cada llamada— rechazan un
 * token cuya versión no coincide con la de la base.
 *
 * Límite arquitectónico, no cubierto acá: el middleware corre en el runtime
 * Edge (jwtVerify puro, sin Prisma) y no puede comparar contra la base en
 * cada request sin agregar infraestructura nueva (no hay Redis/KV en este
 * proyecto). La enforcement real queda en authenticateUser/refreshAccessToken/
 * validateSession, que es donde vive cada mutación y cada refresco de
 * sesión — ver docs/IMPLEMENTACION_SEMANA_7.md §riesgos.
 */

import bcrypt from 'bcrypt';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { mockCookies } from '../../__mocks__/next-headers';
import { TENANT, ADMIN_USER, ADMIN_ROLE } from '../../helpers/fixtures';
import {
  authenticateUser,
  refreshAccessToken,
  validateSession,
  changePassword,
} from '@/features/auth/actions';
import { createAccessToken, createRefreshToken } from '@/lib/auth';
import { _resetRateLimitStore } from '@/lib/rate-limit';

const USER_WITH_ROLE = { ...ADMIN_USER, role: ADMIN_ROLE, tenant: TENANT };

beforeEach(() => {
  resetAllMocks();
  mockCookies.clear();
  _resetRateLimitStore();
  jest.clearAllMocks();
  mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
});

describe('token sin versión: se trata como versión 0', () => {
  it('authenticateUser acepta un token sin tokenVersion cuando el usuario está en 0 (compatibilidad con JWT emitidos antes de A-6)', async () => {
    // Token firmado SIN tokenVersion en el payload — simula un JWT emitido
    // antes de este cambio.
    const oldToken = await createAccessToken({
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleId: ADMIN_USER.roleId,
      roleName: ADMIN_ROLE.name,
      permissions: [],
      tenantId: TENANT.slug,
      tenantName: TENANT.name,
      lastLogin: new Date(),
    } as never);
    mockCookies.setToken('access-token', oldToken);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 0,
    });

    const result = await authenticateUser();

    expect(result.user.id).toBe(ADMIN_USER.id);
  });

  it('authenticateUser rechaza ese mismo token sin versión si el usuario YA no está en 0 (p.ej. cambió su contraseña)', async () => {
    const oldToken = await createAccessToken({
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleId: ADMIN_USER.roleId,
      roleName: ADMIN_ROLE.name,
      permissions: [],
      tenantId: TENANT.slug,
      tenantName: TENANT.name,
      lastLogin: new Date(),
    } as never);
    mockCookies.setToken('access-token', oldToken);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 1,
    });

    await expect(authenticateUser()).rejects.toThrow(/Sesión inválida/);
  });
});

describe('authenticateUser rechaza un token viejo tras un cambio de versión', () => {
  it('un access token emitido con tokenVersion=0 deja de servir cuando la base pasa a 1', async () => {
    const token = await createAccessToken({
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleId: ADMIN_USER.roleId,
      roleName: ADMIN_ROLE.name,
      permissions: [],
      tenantId: TENANT.slug,
      tenantName: TENANT.name,
      lastLogin: new Date(),
      tokenVersion: 0,
    });
    mockCookies.setToken('access-token', token);

    // Antes del cambio: sirve.
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 0,
    });
    await expect(authenticateUser()).resolves.toMatchObject({
      user: { id: ADMIN_USER.id },
    });

    // Después del cambio (p.ej. changePassword incrementó tokenVersion):
    // el MISMO token, sin volver a emitirse, ya no sirve.
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 1,
    });
    await expect(authenticateUser()).rejects.toThrow(/Sesión inválida/);
  });

  it('validateSession reporta inválida la misma sesión revocada, en vez de confirmarla', async () => {
    const token = await createAccessToken({
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleId: ADMIN_USER.roleId,
      roleName: ADMIN_ROLE.name,
      permissions: [],
      tenantId: TENANT.slug,
      tenantName: TENANT.name,
      lastLogin: new Date(),
      tokenVersion: 0,
    });
    mockCookies.setToken('access-token', token);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 1, // revocada después de emitir el token
    });

    const result = await validateSession();

    expect(result.valid).toBe(false);
  });

  it('refreshAccessToken rechaza un refresh token con versión vieja — cierra la puerta de un refresh token robado', async () => {
    const refreshToken = await createRefreshToken({
      userId: ADMIN_USER.id,
      tenantId: TENANT.slug,
      tokenVersion: 0,
    });
    mockCookies.setToken('refresh-token', refreshToken);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 1, // la cuenta ya revocó esta versión
    });

    const result = await refreshAccessToken();

    expect(result.success).toBe(false);
    // No emite tokens nuevos sobre una versión revocada.
    expect(mockCookies.set).not.toHaveBeenCalledWith(
      'access-token',
      expect.anything(),
      expect.anything(),
    );
  });

  it('refreshAccessToken SÍ renueva cuando la versión coincide (camino feliz, no roto por A-6)', async () => {
    const refreshToken = await createRefreshToken({
      userId: ADMIN_USER.id,
      tenantId: TENANT.slug,
      tokenVersion: 0,
    });
    mockCookies.setToken('refresh-token', refreshToken);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 0,
    });

    const result = await refreshAccessToken();

    expect(result.success).toBe(true);
    expect(mockCookies.set).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      expect.anything(),
    );
  });
});

describe('changePassword incrementa tokenVersion sin desloguear la sesión que lo pidió', () => {
  it('revoca cualquier OTRO token con la versión anterior, pero reemite cookies frescas para esta sesión', async () => {
    const currentToken = await createAccessToken({
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleId: ADMIN_USER.roleId,
      roleName: ADMIN_ROLE.name,
      permissions: [],
      tenantId: TENANT.slug,
      tenantName: TENANT.name,
      lastLogin: new Date(),
      tokenVersion: 0,
    });
    mockCookies.setToken('access-token', currentToken);

    const currentPasswordHash = await bcrypt.hash('password123', 12);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: ADMIN_USER.id,
      email: ADMIN_USER.email,
      name: ADMIN_USER.name,
      password: currentPasswordHash,
    });
    mockPrisma.user.update.mockResolvedValue({
      ...USER_WITH_ROLE,
      tokenVersion: 1,
      lastLogin: new Date(),
    });

    const result = await changePassword({
      currentPassword: 'password123',
      newPassword: 'NuevaClaveSegura123!',
      confirmPassword: 'NuevaClaveSegura123!',
    });

    expect(result.success).toBe(true);
    // tokenVersion se incrementó en la misma escritura que la contraseña.
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    // Y la sesión actual se reemitió — no quedó con el token viejo (que ya
    // no serviría contra la versión nueva).
    expect(mockCookies.set).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      expect.anything(),
    );
  });
});
