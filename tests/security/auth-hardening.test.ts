/**
 * Security Tests: Auth Hardening
 * Validates JWT token integrity, signature verification, and expiration handling.
 */

import { SignJWT } from 'jose';
import {
  createAccessToken,
  verifyToken,
  createRefreshToken,
  verifyRefreshToken,
  isTokenExpired,
} from '@/lib/auth';

const TEST_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret');
const WRONG_SECRET = new TextEncoder().encode('wrong-secret-key-for-testing');

const VALID_PAYLOAD = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'OPERATOR',
  permissions: ['Ver dashboard', 'Ver casos'],
  tenantId: 'tenant-1',
  tenantName: 'Test Tenant',
  lastLogin: new Date('2025-01-01T12:00:00Z'),
};

describe('Auth Hardening — JWT Security', () => {
  describe('Token creation and verification', () => {
    it('should create and verify a valid access token', async () => {
      const token = await createAccessToken(VALID_PAYLOAD);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      const user = await verifyToken(token);
      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-1');
      expect(user!.email).toBe('test@example.com');
      expect(user!.tenantId).toBe('tenant-1');
    });

    it('should create and verify a valid refresh token', async () => {
      const token = await createRefreshToken({
        userId: 'user-1',
        tenantId: 'tenant-1',
      });
      expect(token).toBeTruthy();

      const data = await verifyRefreshToken(token);
      expect(data).not.toBeNull();
      expect(data!.userId).toBe('user-1');
      expect(data!.tenantId).toBe('tenant-1');
    });
  });

  describe('Token tampering rejection', () => {
    it('should reject a token with tampered payload', async () => {
      const token = await createAccessToken(VALID_PAYLOAD);
      const parts = token.split('.');

      // Tamper with the payload (middle part)
      const decodedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString(),
      );
      decodedPayload.roleName = 'SUPER_ADMIN';
      decodedPayload.permissions = ['*'];
      const tamperedPayload = Buffer.from(
        JSON.stringify(decodedPayload),
      ).toString('base64url');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const user = await verifyToken(tamperedToken);
      expect(user).toBeNull();
    });

    it('should reject a token with tampered signature', async () => {
      const token = await createAccessToken(VALID_PAYLOAD);
      const parts = token.split('.');

      // Replace signature with garbage
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidSignature123`;
      const user = await verifyToken(tamperedToken);
      expect(user).toBeNull();
    });

    it('should reject a completely fabricated token', async () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJmYWtlIjp0cnVlfQ.invalidsig';
      const user = await verifyToken(fakeToken);
      expect(user).toBeNull();
    });

    it('should reject a non-JWT string', async () => {
      const user = await verifyToken('not-a-jwt-at-all');
      expect(user).toBeNull();
    });

    it('should reject an empty string token', async () => {
      const user = await verifyToken('');
      expect(user).toBeNull();
    });
  });

  describe('Token signed with wrong secret', () => {
    it('should reject access token signed with different secret', async () => {
      const wrongToken = await new SignJWT({
        ...VALID_PAYLOAD,
        lastLogin: VALID_PAYLOAD.lastLogin.toISOString(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(WRONG_SECRET);

      const user = await verifyToken(wrongToken);
      expect(user).toBeNull();
    });

    it('should reject refresh token signed with different secret', async () => {
      const wrongToken = await new SignJWT({
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(WRONG_SECRET);

      const data = await verifyRefreshToken(wrongToken);
      expect(data).toBeNull();
    });
  });

  describe('Token expiration', () => {
    it('should reject an expired token', async () => {
      const expiredToken = await new SignJWT({
        ...VALID_PAYLOAD,
        lastLogin: VALID_PAYLOAD.lastLogin.toISOString(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 2) // 2 days ago
        .setExpirationTime(Math.floor(Date.now() / 1000) - 86400) // expired 1 day ago
        .sign(TEST_SECRET);

      const user = await verifyToken(expiredToken);
      expect(user).toBeNull();
    });

    it('should detect expired token via isTokenExpired utility', () => {
      const expiredData = {
        id: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        roleId: 'role-1',
        roleName: 'OPERATOR',
        permissions: [],
        tenantId: 'tenant-1',
        tenantName: 'Test',
        lastLogin: new Date(),
        iat: Math.floor(Date.now() / 1000) - 86400 * 2,
        exp: Math.floor(Date.now() / 1000) - 86400, // expired
      };
      expect(isTokenExpired(expiredData)).toBe(true);

      const validData = {
        ...expiredData,
        exp: Math.floor(Date.now() / 1000) + 86400, // valid for 1 more day
      };
      expect(isTokenExpired(validData)).toBe(false);
    });
  });

  describe('JWT secret enforcement', () => {
    it('should have JWT_SECRET defined in test environment', () => {
      expect(process.env.JWT_SECRET).toBeTruthy();
    });

    it('should use HS256 algorithm (not none)', async () => {
      const token = await createAccessToken(VALID_PAYLOAD);
      const parts = token.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      expect(header.alg).toBe('HS256');
      expect(header.alg).not.toBe('none');
    });
  });
});
