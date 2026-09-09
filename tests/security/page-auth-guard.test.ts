/**
 * Security Tests: requirePageAuth — guard server-side de páginas (M-9,
 * auditoría 2026-08-25).
 *
 * Las páginas /documents, /reports, /audit-log, /calendar, /notifications
 * y /profile no tenían guard server-side y quedaban expuestas por el bug
 * del middleware (C-1). requirePageAuth replica el patrón ya usado en
 * /dashboard, /cases, /debtors, /creditors y /users.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import { mockCookies } from '../__mocks__/next-headers';
import { requirePageAuth, createAccessToken } from '@/lib/auth';

async function makeValidToken(): Promise<string> {
  return createAccessToken({
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 'role-1',
    roleName: 'Operador',
    permissions: ['Ver casos'],
    tenantId: 'armonia',
    tenantName: 'Armonia',
    lastLogin: new Date(),
  });
}

describe('requirePageAuth — server-side page guard', () => {
  beforeEach(() => {
    mockCookies.clear();
    jest.clearAllMocks();
  });

  it('redirects to /login preserving the return path when there is no cookie', async () => {
    await expect(requirePageAuth('/reports')).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=/reports',
    );
  });

  it('redirects to /login when the token is invalid', async () => {
    mockCookies.setToken('access-token', 'not-a-valid-jwt');

    await expect(requirePageAuth('/documents')).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=/documents',
    );
  });

  it('returns the session payload when the token is valid', async () => {
    mockCookies.setToken('access-token', await makeValidToken());

    const session = await requirePageAuth('/calendar');

    expect(session.id).toBe('user-1');
    expect(session.tenantId).toBe('armonia');
    expect(session.permissions).toContain('Ver casos');
  });
});
