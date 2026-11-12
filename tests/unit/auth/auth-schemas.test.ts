/**
 * Unit Tests: Auth Validation Schemas (src/features/auth/schemas.ts)
 * Tests Zod schemas for login, register, password reset, etc.
 * Updated for strengthened password policy (min 8 chars + uppercase + lowercase + number + special)
 */

import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sessionSchema,
  passwordSchema,
} from '@/features/auth/schemas';

// Strong password that meets all policy requirements
const STRONG_PASSWORD = 'SecurePass123!';

describe('Auth Schemas — src/features/auth/schemas.ts', () => {
  describe('loginSchema', () => {
    it('should validate correct login input', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: 'password123',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: '',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing tenantId', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: 'password123',
        tenantId: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields entirely', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate correct input', () => {
      const result = forgotPasswordSchema.safeParse({
        email: 'user@test.com',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = forgotPasswordSchema.safeParse({
        email: 'invalid',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should validate correct input', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token-uuid',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token-uuid',
        password: STRONG_PASSWORD,
        confirmPassword: 'DifferentPass1!',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token-uuid',
        password: 'Ab1!',
        confirmPassword: 'Ab1!',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct input', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword123!',
        newPassword: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched new passwords', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'OldPassword123!',
        newPassword: STRONG_PASSWORD,
        confirmPassword: 'MismatchPass1!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('passwordSchema — security policy', () => {
    it('should reject password without uppercase letter', () => {
      const result = passwordSchema.safeParse('password123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      const result = passwordSchema.safeParse('PASSWORD123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = passwordSchema.safeParse('SecurePass!');
      expect(result.success).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = passwordSchema.safeParse('SecurePass123');
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('Ab1!xyz');
      expect(result.success).toBe(false);
    });

    it('should accept password meeting all criteria', () => {
      const result = passwordSchema.safeParse(STRONG_PASSWORD);
      expect(result.success).toBe(true);
    });
  });

  describe('sessionSchema', () => {
    it('should validate a correct session object', () => {
      const result = sessionSchema.safeParse({
        id: 'user-id',
        name: 'Test User',
        email: 'test@test.com',
        roleId: 'role-id',
        roleName: 'Administrador',
        permissions: ['Ver casos', 'Crear casos'],
        tenantId: 'tenant-id',
        tenantName: 'Test Tenant',
        lastLogin: new Date(),
        tokenVersion: 0,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      });
      expect(result.success).toBe(true);
    });

    it('should reject session without permissions array', () => {
      const result = sessionSchema.safeParse({
        id: 'user-id',
        name: 'Test User',
        email: 'test@test.com',
        roleId: 'role-id',
        roleName: 'Administrador',
        permissions: 'not-an-array',
        tenantId: 'tenant-id',
        tenantName: 'Test Tenant',
        lastLogin: new Date(),
        iat: 123,
        exp: 456,
      });
      expect(result.success).toBe(false);
    });
  });
});
