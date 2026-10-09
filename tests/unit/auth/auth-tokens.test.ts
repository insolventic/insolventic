/**
 * Unit Tests: JWT Token Management (src/lib/auth.ts)
 * Tests token creation, verification, expiration, and session management.
 */

import { SignJWT } from 'jose';

// Set env before imports
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  verifyRefreshToken,
  isTokenExpired,
} from '@/lib/auth';
import {
  buildSessionPayload,
  ADMIN_USER,
  TENANT,
} from '../../helpers/fixtures';

// Mock next/headers — these functions use cookies() internally
jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    }),
  ),
}));

describe('Auth Tokens — src/lib/auth.ts', () => {
  describe('createAccessToken', () => {
    it('should create a valid JWT access token', async () => {
      const payload = buildSessionPayload(ADMIN_USER);
      const token = await createAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should embed correct user data in the token', async () => {
      const payload = buildSessionPayload(ADMIN_USER);
      const token = await createAccessToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe(ADMIN_USER.id);
      expect(decoded!.email).toBe(ADMIN_USER.email);
      expect(decoded!.roleName).toBe('Administrador');
      expect(decoded!.tenantId).toBe(TENANT.slug);
    });

    it('should include permissions array in the token', async () => {
      const payload = buildSessionPayload(ADMIN_USER);
      const token = await createAccessToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded!.permissions).toBeInstanceOf(Array);
      expect(decoded!.permissions).toContain('Ver casos');
      expect(decoded!.permissions).toContain('Ver todos los casos');
      expect(decoded!.permissions).toContain('Crear casos');
    });

    it('should set expiration to 24 hours', async () => {
      const payload = buildSessionPayload(ADMIN_USER);
      const token = await createAccessToken(payload);
      const decoded = await verifyToken(token);

      const expectedExpiry = decoded!.iat! + 24 * 60 * 60;
      expect(decoded!.exp).toBe(expectedExpiry);
    });
  });

  describe('createRefreshToken', () => {
    it('should create a valid refresh token', async () => {
      const token = await createRefreshToken({
        userId: ADMIN_USER.id,
        tenantId: TENANT.slug,
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should set expiration to 7 days (security hardening)', async () => {
      const token = await createRefreshToken({
        userId: ADMIN_USER.id,
        tenantId: TENANT.slug,
      });

      const decoded = await verifyRefreshToken(token);
      expect(decoded).not.toBeNull();

      const expectedExpiry = decoded!.iat! + 7 * 24 * 60 * 60;
      expect(decoded!.exp).toBe(expectedExpiry);
    });

    it('should embed userId and tenantId', async () => {
      const token = await createRefreshToken({
        userId: ADMIN_USER.id,
        tenantId: TENANT.slug,
      });

      const decoded = await verifyRefreshToken(token);
      expect(decoded!.userId).toBe(ADMIN_USER.id);
      expect(decoded!.tenantId).toBe(TENANT.slug);
    });
  });

  describe('verifyToken', () => {
    it('should return null for invalid token', async () => {
      const result = await verifyToken('invalid.token.string');
      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      const result = await verifyToken('');
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create a token that's already expired
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const expiredToken = await new SignJWT({
        id: 'test',
        name: 'Test',
        email: 'test@test.com',
        roleId: 'role-id',
        roleName: 'Admin',
        permissions: [],
        tenantId: 'tenant',
        tenantName: 'Tenant',
        lastLogin: new Date().toISOString(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 200000)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 100000)
        .sign(secret);

      const result = await verifyToken(expiredToken);
      expect(result).toBeNull();
    });

    it('should return null for token signed with wrong secret', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret');
      const badToken = await new SignJWT({ id: 'test' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(wrongSecret);

      const result = await verifyToken(badToken);
      expect(result).toBeNull();
    });

    it('should correctly parse lastLogin as Date', async () => {
      const payload = buildSessionPayload(ADMIN_USER);
      const token = await createAccessToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded!.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should return null for invalid refresh token', async () => {
      const result = await verifyRefreshToken('garbage-token');
      expect(result).toBeNull();
    });

    it('should verify a valid refresh token', async () => {
      const token = await createRefreshToken({
        userId: 'user-1',
        tenantId: 'tenant-1',
      });

      const decoded = await verifyRefreshToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe('user-1');
      expect(decoded!.tenantId).toBe('tenant-1');
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token data', () => {
      const expiredData = {
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        userId: 'test',
        tenantId: 'test',
      };

      expect(isTokenExpired(expiredData)).toBe(true);
    });

    it('should return false for valid token data', () => {
      const validData = {
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
        userId: 'test',
        tenantId: 'test',
      };

      expect(isTokenExpired(validData)).toBe(false);
    });
  });
});
