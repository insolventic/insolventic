/**
 * Unit Tests: Auth Server Actions (src/features/auth/actions.ts)
 * Tests login, register, password reset, permission checks.
 * Critical for security: validates RBAC enforcement.
 */

import bcrypt from 'bcrypt';

// Setup env
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

// Mock dependencies BEFORE importing actions
jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));
jest.mock('@/lib/email', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  },
}));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { mockCookies } from '../../__mocks__/next-headers';
import { TENANT, ADMIN_USER, LAWYER_USER } from '../../helpers/fixtures';

// Import actions under test
import {
  loginUser,
  refreshAccessToken,
  validateSession,
  checkUserPermission,
  forgotPassword,
  resetPassword,
  authenticateUser,
} from '@/features/auth/actions';
import { createAccessToken, createRefreshToken } from '@/lib/auth';
import { _resetRateLimitStore } from '@/lib/rate-limit';

// Strong password meeting policy requirements
const STRONG_PASSWORD = 'SecurePass123!';

describe('Auth Actions — src/features/auth/actions.ts', () => {
  beforeEach(() => {
    resetAllMocks();
    mockCookies.clear();
    _resetRateLimitStore();
    jest.clearAllMocks();
  });

  describe('loginUser', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);

      const result = await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Inicio de sesión exitoso');
      expect(result.user).toBeDefined();
      expect(result.user!.email).toBe('admin@test.com');
    });

    // A-3: los tokens viajan solo en cookies httpOnly, nunca en el body
    // (devolverlos anula el httpOnly ante cualquier XSS).
    it('should NOT return tokens in the response body (A-3)', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);

      const result = await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(true);
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      // Las cookies httpOnly sí deben setearse.
      expect(mockCookies.get('access-token')).toBeDefined();
      expect(mockCookies.get('refresh-token')).toBeDefined();
    });

    it('should fail with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });

      const result = await loginUser({
        email: 'admin@test.com',
        password: 'wrong-password',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Credenciales inválidas');
    });

    it('should fail with non-existent user', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await loginUser({
        email: 'nonexistent@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Credenciales inválidas');
    });

    it('should fail with invalid tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'non-existent-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Tenant no encontrado');
    });

    it('should fail with invalid email format', async () => {
      const result = await loginUser({
        email: 'not-an-email',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
    });

    it('should include permissions in session data', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);

      const result = await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(true);
      expect(result.user!.permissions).toContain('Ver casos');
      expect(result.user!.permissions).toContain('Ver todos los casos');
    });

    it('should set auth cookies on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);

      await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(mockCookies.set).toHaveBeenCalledWith(
        'access-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should update lastLogin timestamp', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...ADMIN_USER,
        password: hashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);

      await loginUser({
        email: 'admin@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: ADMIN_USER.id },
        data: { lastLogin: expect.any(Date) },
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should rotate cookies but NOT return tokens in the body (A-3)', async () => {
      const refreshToken = await createRefreshToken({
        userId: ADMIN_USER.id,
        tenantId: TENANT.slug,
      });
      mockCookies.setToken('refresh-token', refreshToken);

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);

      const result = await refreshAccessToken();

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      // Las cookies httpOnly sí deben rotarse.
      expect(mockCookies.get('access-token')).toBeDefined();
      expect(mockCookies.get('refresh-token')).toBeDefined();
    });
  });

  describe('validateSession', () => {
    it('should return invalid when no access token', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const result = await validateSession();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No hay token de acceso');
    });

    it('should return valid for authenticated user', async () => {
      const payload = {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        roleId: ADMIN_USER.roleId,
        roleName: 'Administrador',
        permissions: ['Ver casos', 'Ver todos los casos'],
        tenantId: TENANT.slug,
        tenantName: TENANT.name,
        lastLogin: new Date(),
      };

      const token = await createAccessToken(payload);
      mockCookies.get.mockReturnValue({ value: token });

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);

      const result = await validateSession();

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.email).toBe(ADMIN_USER.email);
    });
  });

  describe('authenticateUser — tenantId (cuid) vs tenantSlug', () => {
    /**
     * REGRESIÓN: `resolveCenterFolderName` (src/lib/centro-conciliacion.ts) y
     * los mapas por tenant de `branding-assets.ts`/`membrete-centro.ts` están
     * indexados por el SLUG (`'armonia'` | `'constructores-paz'`), no por el
     * cuid de `Tenant.id`. `authenticateUser` ya devolvía `tenantId:
     * tenant.id` (el cuid) — correcto para las queries de Prisma — pero
     * nunca expuso el slug, así que cualquier llamador que necesitara el
     * slug no tenía de dónde sacarlo sin re-consultar. Este test fija que
     * ambos valores salgan, y que sean DISTINTOS cuando el tenant tiene un
     * cuid real (TENANT.id !== TENANT.slug en el fixture, como en
     * producción).
     */
    it('expone tenantId (cuid) y tenantSlug (slug) por separado, sin que uno pise al otro', async () => {
      const payload = {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        roleId: ADMIN_USER.roleId,
        roleName: 'Administrador',
        permissions: ['Ver casos', 'Ver todos los casos'],
        tenantId: TENANT.slug,
        tenantName: TENANT.name,
        lastLogin: new Date(),
      };
      const token = await createAccessToken(payload);
      mockCookies.get.mockReturnValue({ value: token });

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);

      const result = await authenticateUser();

      expect(result.tenantId).toBe(TENANT.id);
      expect(result.tenantSlug).toBe(TENANT.slug);
      expect(result.tenantId).not.toBe(result.tenantSlug);
    });
  });

  describe('checkUserPermission — RBAC enforcement', () => {
    it('should return true when user has the required permission', async () => {
      const payload = {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        roleId: ADMIN_USER.roleId,
        roleName: 'Administrador',
        permissions: ['Ver casos', 'Crear casos', 'Eliminar casos'],
        tenantId: TENANT.slug,
        tenantName: TENANT.name,
        lastLogin: new Date(),
      };

      const token = await createAccessToken(payload);
      mockCookies.get.mockReturnValue({ value: token });

      const result = await checkUserPermission('Ver casos');

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('Ver casos');
    });

    it('should return false when user lacks the required permission', async () => {
      const payload = {
        id: LAWYER_USER.id,
        name: LAWYER_USER.name,
        email: LAWYER_USER.email,
        roleId: LAWYER_USER.roleId,
        roleName: 'Abogado',
        permissions: ['Ver casos', 'Ver casos propios'],
        tenantId: TENANT.slug,
        tenantName: TENANT.name,
        lastLogin: new Date(),
      };

      const token = await createAccessToken(payload);
      mockCookies.get.mockReturnValue({ value: token });

      const result = await checkUserPermission('Eliminar casos');

      expect(result.hasPermission).toBe(false);
      expect(result.requiredPermission).toBe('Eliminar casos');
    });

    it('should return false when no access token exists', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const result = await checkUserPermission('Ver casos');

      expect(result.hasPermission).toBe(false);
      expect(result.userPermissions).toEqual([]);
    });
  });

  describe('forgotPassword', () => {
    it('should create reset token and send email', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const result = await forgotPassword({
        email: 'admin@test.com',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'admin@test.com',
          token: expect.any(String),
          tenantId: TENANT.id,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should fail for non-existent email', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await forgotPassword({
        email: 'nonexistent@test.com',
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('no está registrado');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const validToken = {
        token: 'valid-uuid-token',
        email: 'admin@test.com',
        tenantId: TENANT.id,
        used: false,
        expiresAt: new Date(Date.now() + 1800000), // 30 min from now
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER);
      mockPrisma.user.update.mockResolvedValue(ADMIN_USER);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});

      const result = await resetPassword({
        token: 'valid-uuid-token',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { token: 'valid-uuid-token' },
        data: { used: true },
      });
    });

    it('should reject expired token', async () => {
      const expiredToken = {
        token: 'expired-token',
        email: 'admin@test.com',
        tenantId: TENANT.id,
        used: false,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(expiredToken);

      const result = await resetPassword({
        token: 'expired-token',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('expirado');
    });

    it('should reject already-used token', async () => {
      const usedToken = {
        token: 'used-token',
        email: 'admin@test.com',
        tenantId: TENANT.id,
        used: true,
        expiresAt: new Date(Date.now() + 1800000),
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(usedToken);

      const result = await resetPassword({
        token: 'used-token',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        tenantId: 'test-tenant',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('inválido');
    });
  });
});
