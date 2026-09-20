/**
 * Unit Tests: switchDatabase — cambio de centro (issue #9).
 *
 * `redirect()` de next/navigation señala la redirección LANZANDO NEXT_REDIRECT.
 * `switchDatabase` lo llamaba dentro del `try`, así que su propio `catch`
 * lo atrapaba y lo registraba como ERROR ("Tenant switch error") en cada
 * cambio de centro: ruido en Sentry y, peor, un fallo real de
 * `clearAuthCookies()` quedaba indistinguible de ese falso positivo.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));
jest.mock('@/lib/email', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  },
}));

import { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import * as authLib from '@/lib/auth';
import { logger } from '@/lib/logger';
import { switchDatabase } from '@/features/auth/actions';

describe('switchDatabase — NEXT_REDIRECT no es un error (issue #9)', () => {
  let errorSpy: jest.SpyInstance;
  let clearCookiesSpy: jest.SpyInstance;

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    clearCookiesSpy = jest
      .spyOn(authLib, 'clearAuthCookies')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    clearCookiesSpy.mockRestore();
  });

  it('camino feliz: limpia cookies, redirige a "/" y NO registra ningún error', async () => {
    await expect(switchDatabase()).rejects.toThrow('NEXT_REDIRECT');

    // El bug: el redirect lanzado dentro del try se registraba aquí.
    expect(errorSpy).not.toHaveBeenCalled();

    expect(clearCookiesSpy).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith('auth');
    // Una sola redirección: ya no hay un segundo redirect() dentro del catch.
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('si clearAuthCookies falla de verdad: registra ESE error y redirige igual', async () => {
    const failure = new Error('no se pudieron limpiar las cookies');
    clearCookiesSpy.mockRejectedValueOnce(failure);

    await expect(switchDatabase()).rejects.toThrow('NEXT_REDIRECT');

    // Un único error registrado, y es el real (no el NEXT_REDIRECT).
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Tenant switch error', failure);
    // El usuario nunca se queda en una página autenticada.
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/');
  });
});
