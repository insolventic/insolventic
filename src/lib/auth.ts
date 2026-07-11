import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

import type { SessionData, RefreshTokenData } from '@/features/auth/schemas';

// Validado en el primer uso, no en el import: `next build` recolecta page
// data importando este módulo, y en entornos de build (CI con `vercel pull`,
// que excluye las env vars sensitive) JWT_SECRET no existe. En runtime la
// primera operación de auth sigue fallando fuerte si falta.
let jwtSecretCache: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (jwtSecretCache) return jwtSecretCache;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Application cannot start without it.',
    );
  }
  jwtSecretCache = new TextEncoder().encode(secret);
  return jwtSecretCache;
}

export async function createAccessToken(
  payload: Omit<SessionData, 'iat' | 'exp'>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 24 * 60 * 60;

  return new SignJWT({
    ...payload,
    lastLogin: payload.lastLogin.toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getJwtSecret());
}

export async function createRefreshToken(
  payload: Omit<RefreshTokenData, 'iat' | 'exp'>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days (reduced from 30 for security)

  return new SignJWT({ ...payload, jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      roleId: payload.roleId as string,
      roleName: payload.roleName as string,
      permissions: payload.permissions as string[],
      tenantId: payload.tenantId as string,
      tenantName: payload.tenantName as string,
      lastLogin: new Date(payload.lastLogin as string),
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenData | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access-token')?.value;

    if (!accessToken) {
      return null;
    }

    return await verifyToken(accessToken);
  } catch (error) {
    console.error('Get current user failed:', error);
    return null;
  }
}

export async function requireAuth(): Promise<SessionData> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

export async function checkPermission(
  requiredPermission: string,
): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return false;
    }

    return user.permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

export async function requirePermission(
  requiredPermission: string,
): Promise<SessionData> {
  const user = await requireAuth();

  const hasPermission = user.permissions.includes(requiredPermission);

  if (!hasPermission) {
    throw new Error(`Permission required: ${requiredPermission}`);
  }

  return user;
}

export function isTokenExpired(token: SessionData | RefreshTokenData): boolean {
  const now = Math.floor(Date.now() / 1000);
  return token.exp < now;
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('access-token');
  cookieStore.delete('refresh-token');
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set('access-token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  cookieStore.set('refresh-token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days — matches refresh token JWT expiration
    path: '/',
  });
}
