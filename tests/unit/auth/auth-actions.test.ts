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
import { TENANT, ADMIN_USER, LAWYER_USER, ADMIN_ROLE, USER_ROLE } from '../../helpers/fixtures';

// Import actions under test
import {
  loginUser,
  registerUser,
  validateSession,
  checkUserPermission,
  forgotPassword,
  resetPassword,
  changePassword,
} from '@/features/auth/actions';
import { createAccessToken } from '@/lib/auth';
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
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
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

  describe('registerUser', () => {
    const validRegisterInput = {
      name: 'New User',
      email: 'newuser@test.com',
      password: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
      phone: '3001234567',
      address: 'Test Address',
      professionalCard: 'TP-999',
      tenantId: 'test-tenant',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrisma.role.findFirst.mockResolvedValue(USER_ROLE);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        name: 'New User',
        email: 'newuser@test.com',
      });

      const result = await registerUser(validRegisterInput);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user!.email).toBe('newuser@test.com');
    });

    it('should reject duplicate email', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(ADMIN_USER); // User exists

      const result = await registerUser(validRegisterInput);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Ya existe un usuario');
    });

    it('should hash password with bcrypt before storing', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(USER_ROLE);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        name: 'New User',
        email: 'newuser@test.com',
      });

      await registerUser(validRegisterInput);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const storedPassword = createCall.data.password;

      // Verify password is hashed (bcrypt hashes start with $2b$)
      expect(storedPassword).toMatch(/^\$2[ab]\$/);
      // Verify it matches the original password
      const matches = await bcrypt.compare(STRONG_PASSWORD, storedPassword);
      expect(matches).toBe(true);
    });

    it('should assign default "Usuario" role', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(USER_ROLE);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        name: 'New User',
        email: 'new@test.com',
      });

      await registerUser(validRegisterInput);

      expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
        where: { name: 'Usuario', tenantId: TENANT.id },
      });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.roleId).toBe(USER_ROLE.id);
    });

    it('should fail if default role not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(TENANT);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(null); // No default role

      const result = await registerUser(validRegisterInput);

      expect(result.success).toBe(false);
      expect(result.message).toContain('rol por defecto');
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
