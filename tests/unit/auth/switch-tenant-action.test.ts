/**
 * `switchTenant` se eliminó: daba entrada a la cuenta de otro centro con solo
 * coincidir el correo del token, sin pedir su clave, y ninguna pantalla la
 * llamaba. Una server action exportada es invocable aunque nadie la use, así que
 * este test impide que vuelva sin que alguien lo decida.
 *
 * Cambiar de centro es `switchDatabase` + `loginUser`. El ataque y ese control
 * están contra Postgres real en tests/db/switch-tenant-correo-ajeno.db.test.ts.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));
jest.mock('@/lib/email', () => ({ emailService: {} }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import * as authActions from '@/features/auth/actions';

describe('cambio de centro', () => {
  it('no existe una action que cambie de centro sin pasar por el login', () => {
    expect(authActions).not.toHaveProperty('switchTenant');
    expect(authActions).toHaveProperty('switchDatabase');
    expect(authActions).toHaveProperty('loginUser');
  });
});
