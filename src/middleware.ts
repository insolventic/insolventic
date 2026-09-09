import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { getRoutePermissions } from '@/lib/permissions';

// Validado en el primer uso, no en el import — mismo patrón que auth.ts y
// email.ts: en entornos de build (CI con `vercel pull`) JWT_SECRET no existe.
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

// Public routes that don't require authentication.
// '/register' NO es pública: el registro autoservicio está cerrado (C-2) —
// los usuarios los crea un administrador del centro.
const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/reset-password'];

/**
 * Exact match or sub-path match (`route + '/'`). A naive `startsWith(route)`
 * with `'/'` in the list treats EVERY path as public and turns the auth gate
 * into dead code (hallazgo C-1 de la auditoría 2026-08-25).
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}

/**
 * Validates that a redirect path is a safe, relative internal path.
 * Prevents open redirect attacks.
 */
export function isValidRedirectPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  if (path.includes('\\')) return false;
  return /^\/[\w\-./]*(\?[\w\-=&%.]*)?$/.test(path);
}

async function verifyToken(token: string) {
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
      lastLogin: new Date(payload.lastLogin as string),
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Correlación de logs: un id por request, reenviado a las server actions
  // vía header (el edge runtime no comparte AsyncLocalStorage con Node).
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID();

  const accessToken = request.cookies.get('access-token')?.value;

  if (isPublicRoute(pathname)) {
    if (accessToken) {
      const user = await verifyToken(accessToken);
      if (
        user?.permissions?.length &&
        (pathname === '/' || pathname === '/login')
      ) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    const publicHeaders = new Headers(request.headers);
    publicHeaders.set('x-request-id', requestId);
    const publicResponse = NextResponse.next({
      request: { headers: publicHeaders },
    });
    publicResponse.headers.set('x-request-id', requestId);
    return publicResponse;
  }

  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    if (isValidRedirectPath(pathname)) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const user = await verifyToken(accessToken);

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    if (isValidRedirectPath(pathname)) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (!user.permissions || user.permissions.length === 0) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'no-permissions');
    return NextResponse.redirect(loginUrl);
  }

  // Route-level permission checks — derived from centralized MODULES config
  const routePermissions = getRoutePermissions();

  for (const [route, permission] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route) && !user.permissions.includes(permission)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Solo se propaga x-request-id: los headers x-user-* no tenían ningún
  // consumidor en el repo (grep exhaustivo, auditoría C-1) y duplicaban PII.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};
