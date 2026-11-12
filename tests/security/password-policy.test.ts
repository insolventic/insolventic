/**
 * Security Tests: Password Policy
 * Validates that password complexity requirements are enforced across all schemas.
 */

import {
  passwordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '@/features/auth/schemas';

describe('Password Policy — Security Enforcement', () => {
  describe('passwordSchema — core policy', () => {
    const weakPasswords = [
      { input: 'short1!', reason: 'shorter than 8 characters' },
      { input: 'alllowercase1!', reason: 'no uppercase letter' },
      { input: 'ALLUPPERCASE1!', reason: 'no lowercase letter' },
      { input: 'NoNumbers!!', reason: 'no digit' },
      { input: 'NoSpecial123', reason: 'no special character' },
      { input: '', reason: 'empty string' },
      { input: '12345678', reason: 'only digits' },
      { input: 'abcdefgh', reason: 'only lowercase' },
    ];

    weakPasswords.forEach(({ input, reason }) => {
      it(`should reject password: ${reason}`, () => {
        const result = passwordSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    const strongPasswords = [
      'SecurePass123!',
      'MyP@ssw0rd',
      'C0mpl3x!ty',
      'Test#1234',
      'Abcdef1!',
    ];

    strongPasswords.forEach((pw) => {
      it(`should accept strong password: ${pw}`, () => {
        const result = passwordSchema.safeParse(pw);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('resetPasswordSchema — password policy integration', () => {
    it('should reject weak password in reset', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'simple',
        confirmPassword: 'simple',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should accept strong password in reset', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'valid-token',
        password: 'NewSecure1!',
        confirmPassword: 'NewSecure1!',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('changePasswordSchema — password policy integration', () => {
    it('should reject weak new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'anything',
        newPassword: '123456',
        confirmPassword: '123456',
      });
      expect(result.success).toBe(false);
    });

    it('should accept strong new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'anything',
        newPassword: 'NewSecure1!',
        confirmPassword: 'NewSecure1!',
      });
      expect(result.success).toBe(true);
    });
  });
});
