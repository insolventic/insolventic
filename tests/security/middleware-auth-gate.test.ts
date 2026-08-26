/**
 * Security Tests: Middleware Auth Gate (hallazgo C-1, auditoría 2026-08-25)
 *
 * El bug original: `publicRoutes` incluía '/' y se comparaba con
 * `startsWith`, por lo que TODA ruta era tratada como pública y el gate de
 * autenticación/permisos del middleware era código muerto. Estos tests
 * fallan con ese matching y pasan con el matching exacto/por sub-path.
 */

import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';

import { middleware, isPublicRoute } from '@/middleware';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function makeToken(permissions: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 'role-1',
    roleName: 'Operador',
    permissions,
    tenantId: 'armonia',
    lastLogin: new Date().toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(JWT_SECRET);
}

function makeRequest(pathname: string, accessToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.cookie = `access-token=${accessToken}`;
  }
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

function redirectLocation(response: Response): URL | null {
  const location = response.headers.get('location');
  return location ? new URL(location) : null;
}

describe('isPublicRoute — route matching', () => {
  it.each(['/', '/login', '/register', '/forgot-password', '/reset-password'])(
    'treats %s as public',
    (path) => {
      expect(isPublicRoute(path)).toBe(true);
    },
  );

  // Regresión C-1: con `startsWith('/')` TODO era público.
  it.each([
    '/dashboard',
    '/cases',
    '/cases/abc123',
    '/documents',
    '/reports',
    '/audit-log',
    '/calendar',
    '/notifications',
    '/profile',
    '/users',
  ])('treats %s as protected', (path) => {
    expect(isPublicRoute(path)).toBe(false);
  });

  it('allows sub-paths of public routes', () => {
    expect(isPublicRoute('/reset-password/confirm')).toBe(true);
  });

  it('does not treat prefix-similar routes as public', () => {
    expect(isPublicRoute('/loginx')).toBe(false);
    expect(isPublicRoute('/register-admin')).toBe(false);
  });
});

describe('middleware — auth gate', () => {
  it('redirects a protected route to /login when there is no cookie', async () => {
    const response = await middleware(makeRequest('/cases'));

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/login');
    expect(location!.searchParams.get('redirect')).toBe('/cases');
  });

  it('redirects a protected route to /login when the token is invalid', async () => {
    const response = await middleware(
      makeRequest('/dashboard', 'not-a-valid-jwt'),
    );

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/login');
  });

  it('does NOT redirect a public route without cookie', async () => {
    const response = await middleware(makeRequest('/login'));

    expect(response.headers.get('location')).toBeNull();
    // Toda respuesta del middleware propaga el requestId de correlación.
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('redirects to /login with error when the user has no permissions', async () => {
    const token = await makeToken([]);
    const response = await middleware(makeRequest('/cases', token));

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/login');
    expect(location!.searchParams.get('error')).toBe('no-permissions');
  });

  it('blocks a route whose gate permission the user lacks (route-level RBAC)', async () => {
    // '/audit-log' requiere 'Ver auditoría'; el usuario solo tiene 'Ver casos'.
    const token = await makeToken(['Ver casos']);
    const response = await middleware(makeRequest('/audit-log', token));

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/dashboard');
  });

  it('lets an authenticated user with the gate permission through', async () => {
    const token = await makeToken(['Ver casos']);
    const response = await middleware(makeRequest('/cases', token));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('no longer forwards x-user-* headers (PII, sin consumidores)', async () => {
    const token = await makeToken(['Ver casos']);
    const response = await middleware(makeRequest('/cases', token));

    // Los headers reenviados al request viven en x-middleware-request-*.
    const forwarded = [...response.headers.keys()].filter((h) =>
      h.includes('x-user-'),
    );
    expect(forwarded).toHaveLength(0);
  });

  it('redirects an authenticated user away from /login to /dashboard', async () => {
    const token = await makeToken(['Ver casos']);
    const response = await middleware(makeRequest('/login', token));

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/dashboard');
  });
});
