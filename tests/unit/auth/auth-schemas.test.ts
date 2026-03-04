/**
 * Unit Tests: Auth Validation Schemas (src/features/auth/schemas.ts)
 * Tests Zod schemas for login, register, password reset, etc.
 */

import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sessionSchema,
} from '@/features/auth/schemas';

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

  describe('registerSchema', () => {
    const validInput = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      phone: '3001234567',
      address: 'Calle 123',
      professionalCard: 'TP-001',
      tenantId: 'test-tenant',
    };

    it('should validate correct registration input', () => {
      const result = registerSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        confirmPassword: 'different-password',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 6 characters', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        password: '12345',
        confirmPassword: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty phone', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        phone: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const result = registerSchema.safeParse({
        ...validInput,
        email: 'invalid',
      });
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
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token-uuid',
        password: 'newpassword123',
        confirmPassword: 'different',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token-uuid',
        password: '12345',
        confirmPassword: '12345',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct input', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched new passwords', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'mismatch',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty current password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: '',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      });
      expect(result.success).toBe(false);
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
