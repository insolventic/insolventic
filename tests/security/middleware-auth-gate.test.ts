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

function makeRequest(
  pathname: string,
  accessToken?: string,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const headers: Record<string, string> = { ...extraHeaders };
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
  it.each([
    '/',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/privacidad',
    '/terminos',
  ])('treats %s as public', (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  // C-2: el registro autoservicio está cerrado — /register ya no es pública.
  it('treats /register as protected (registro público cerrado)', () => {
    expect(isPublicRoute('/register')).toBe(false);
  });

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

describe('middleware — /register cerrado (C-2)', () => {
  it('redirects /register to /login when unauthenticated', async () => {
    const response = await middleware(makeRequest('/register'));

    const location = redirectLocation(response);
    expect(location).not.toBeNull();
    expect(location!.pathname).toBe('/login');
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

  // Cumplimiento (Ley 1581): estas dos páginas tienen que poder leerse sin
  // sesión — exigir login para ver la política de datos sería absurdo.
  it.each(['/privacidad', '/terminos'])(
    'does NOT redirect %s without cookie (cumplimiento, debe leerse sin sesión)',
    async (path) => {
      const response = await middleware(makeRequest(path));

      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-request-id')).toBeTruthy();
    },
  );

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

// Hallazgo de la investigación del logger (2026-09-20): el middleware reenviaba
// tal cual el x-request-id del cliente. Quien lo fijaba podía colisionar con el
// id de otro request en los logs/Sentry o meter valores arbitrarios en cada línea.
describe('x-request-id — el id lo emite siempre el servidor', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const FORWARDED = 'x-middleware-request-x-request-id';

  it.each([
    ['un valor arbitrario', 'atacante-controla-esto'],
    ['un UUID bien formado', '11111111-2222-4333-8444-555555555555'],
    ['un valor larguísimo', 'a'.repeat(5000)],
  ])(
    'ignora un x-request-id del cliente (%s) en rutas públicas',
    async (_n, spoof) => {
      const response = await middleware(
        makeRequest('/login', undefined, { 'x-request-id': spoof }),
      );

      const id = response.headers.get('x-request-id');
      expect(id).toMatch(UUID);
      expect(id).not.toBe(spoof);
      // Y lo que llega a las server actions es el id del servidor, no el del cliente.
      expect(response.headers.get(FORWARDED)).toBe(id);
    },
  );

  it('ignora un x-request-id del cliente en rutas protegidas', async () => {
    const token = await makeToken(['Ver casos']);
    const spoof = 'atacante-controla-esto';
    const response = await middleware(
      makeRequest('/cases', token, { 'x-request-id': spoof }),
    );

    const id = response.headers.get('x-request-id');
    expect(id).toMatch(UUID);
    expect(id).not.toBe(spoof);
    expect(response.headers.get(FORWARDED)).toBe(id);
  });

  it('emite un id distinto por request (el cliente no puede reutilizar uno)', async () => {
    const a = await middleware(makeRequest('/login'));
    const b = await middleware(makeRequest('/login'));

    expect(a.headers.get('x-request-id')).not.toBe(
      b.headers.get('x-request-id'),
    );
  });
});
