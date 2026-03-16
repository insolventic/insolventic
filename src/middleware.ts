import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Application cannot start without it.',
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

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
    const { payload } = await jwtVerify(token, JWT_SECRET);
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

  const accessToken = request.cookies.get('access-token')?.value;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ];

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    if (accessToken) {
      const user = await verifyToken(accessToken);
      if (
        user?.permissions?.length &&
        (pathname === '/' || pathname === '/login')
      ) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return NextResponse.next();
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

  // Route-level permission checks
  const routePermissions: Record<string, string> = {
    '/cases': 'Ver casos',
    '/users': 'Ver usuarios',
    '/creditors': 'Ver acreedores',
    '/debtors': 'Ver deudores',
    '/documents': 'Ver documentos',
    '/notifications': 'Ver notificaciones',
  };

  for (const [route, permission] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route) && !user.permissions.includes(permission)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-email', user.email);
  requestHeaders.set('x-user-role', user.roleName);
  requestHeaders.set('x-user-permissions', JSON.stringify(user.permissions));
  requestHeaders.set('x-user-tenant', user.tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};
