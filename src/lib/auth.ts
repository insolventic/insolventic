import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';

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
      // A-6: tokens emitidos antes de este campo no lo traen — se tratan
      // como versión 0, la misma que trae todo usuario existente por el
      // DEFAULT de la migración, para no cerrarle la sesión a nadie de
      // golpe el día del deploy.
      tokenVersion:
        typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    // Evento esperado (tokens expirados en cada sesión vencida): nivel info
    // para no inundar Sentry; visible en dev o con LOG_LEVEL=info.
    logger.info('Token verification failed', {
      action: 'verifyToken',
      reason: error instanceof Error ? error.message : 'unknown',
    });
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
      // A-6: mismo default que en verifyToken — ver esa nota.
      tokenVersion:
        typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    logger.info('Refresh token verification failed', {
      action: 'verifyRefreshToken',
      reason: error instanceof Error ? error.message : 'unknown',
    });
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
    logger.error('Get current user failed', error, {
      action: 'getCurrentUser',
    });
    return null;
  }
}

/**
 * Guard server-side para páginas protegidas (M-9, auditoría 2026-08-25).
 * Mismo patrón inline usado en /dashboard, /cases, /debtors, /creditors y
 * /users, factorizado: sin cookie o con token inválido redirige a /login
 * preservando la ruta de retorno. Defensa en profundidad respecto del
 * middleware (C-1).
 */
export async function requirePageAuth(
  redirectPath: string,
): Promise<SessionData> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect(`/login?redirect=${redirectPath}`);
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect(`/login?redirect=${redirectPath}`);
  }

  return payload;
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
    logger.error('Permission check failed', error, {
      action: 'checkPermission',
    });
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
