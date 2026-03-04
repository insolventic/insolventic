/**
 * Security Tests: Input Validation
 * Tests that Zod schemas reject SQL injection, XSS, oversized inputs, and malformed data.
 */

import { loginSchema, registerSchema } from '@/features/auth/schemas';
import { uploadCaseDocumentsInputSchema } from '@/features/document/schemas';

describe('Input Validation — Security', () => {
  describe('SQL Injection payloads', () => {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --",
      "1; DELETE FROM cases WHERE 1=1",
    ];

    sqlPayloads.forEach((payload) => {
      it(`loginSchema should accept SQL payload as string (Prisma ORM prevents injection): "${payload.substring(0, 30)}..."`, () => {
        // SQL injection is mitigated at the ORM level (Prisma parameterized queries)
        // Zod validates type/format but does not need to block SQL strings
        // The point is: these strings pass Zod but are harmless because Prisma
        // uses parameterized queries, never string interpolation
        const result = loginSchema.safeParse({
          email: 'valid@email.com',
          password: payload,
          tenantId: 'test-tenant',
        });
        // Password accepts any non-empty string for login
        expect(result.success).toBe(true);
      });
    });

    it('should reject SQL payload in email field (invalid email format)', () => {
      const result = loginSchema.safeParse({
        email: "' OR '1'='1",
        password: 'password',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('XSS payloads', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '"><img src=x onerror=alert(1)>',
      "javascript:alert('XSS')",
      '<svg onload=alert(1)>',
      '{{constructor.constructor("return this")()}}',
    ];

    xssPayloads.forEach((payload) => {
      it(`should reject XSS payload in email field: "${payload.substring(0, 30)}..."`, () => {
        const result = loginSchema.safeParse({
          email: payload,
          password: 'password',
          tenantId: 'test-tenant',
        });
        expect(result.success).toBe(false); // Invalid email format
      });
    });
  });

  describe('Oversized inputs', () => {
    it('should reject extremely long email (DoS prevention)', () => {
      const longEmail = 'a'.repeat(10000) + '@test.com';
      const result = loginSchema.safeParse({
        email: longEmail,
        password: 'password',
        tenantId: 'test-tenant',
      });
      // Zod email validation should reject this
      expect(result.success).toBe(false);
    });

    it('should reject file upload exceeding 10MB base64 limit', () => {
      const oversizedBase64 = 'A'.repeat(14_000_000); // ~14MB > 13.7MB limit

      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-123',
        personName: 'Test User',
        documents: [
          {
            docName: 'test.pdf',
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            dataBase64: oversizedBase64,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should accept file upload within 10MB limit', () => {
      const validBase64 = 'A'.repeat(1000); // Small file

      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-123',
        personName: 'Test User',
        documents: [
          {
            docName: 'test.pdf',
            fileName: 'test.pdf',
            mimeType: 'application/pdf',
            dataBase64: validBase64,
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Malformed JSON / Invalid types', () => {
    it('should reject number where string is expected', () => {
      const result = loginSchema.safeParse({
        email: 12345,
        password: 'password',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject null values for required fields', () => {
      const result = loginSchema.safeParse({
        email: null,
        password: null,
        tenantId: null,
      });
      expect(result.success).toBe(false);
    });

    it('should reject array where string is expected', () => {
      const result = loginSchema.safeParse({
        email: ['user@test.com'],
        password: 'password',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject object where string is expected', () => {
      const result = loginSchema.safeParse({
        email: { email: 'user@test.com' },
        password: 'password',
        tenantId: 'test-tenant',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty documents array in upload', () => {
      const result = uploadCaseDocumentsInputSchema.safeParse({
        caseId: 'case-123',
        personName: 'Test',
        documents: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Registration field injection', () => {
    it('should not allow prototype pollution via extra fields', () => {
      const result = registerSchema.safeParse({
        name: 'Test',
        email: 'test@test.com',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
        phone: '3001234567',
        address: 'Test',
        professionalCard: 'TP-001',
        tenantId: 'test-tenant',
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
      });
      // Extra fields should be stripped by Zod
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data).not.toHaveProperty('__proto__.isAdmin');
        expect(data).not.toHaveProperty('isAdmin');
      }
    });
  });
});
