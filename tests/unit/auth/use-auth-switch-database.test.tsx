/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: useAuth.switchDatabase — redirección esperada vs fallo real
 * (misma clase de bug que el issue #9, del lado cliente).
 *
 * Cuando una server action llama `redirect()`, Next 15 RECHAZA la promesa que
 * recibe el cliente con un error de redirección (server-action-reducer.js).
 * `switchDatabaseHandler` lo atrapaba con un `catch` genérico y lo registraba
 * como ERROR ("Switch database error"): un falso positivo en cada cambio de
 * centro que además no se distingue de un fallo real de la action.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
// El error de redirección se fabrica con la implementación REAL de Next (no a
// mano): si una actualización cambia el formato del `digest`, este test avisa.
import { getRedirectError } from 'next/dist/client/components/redirect';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockValidateSession = jest.fn();
const mockSwitchDatabase = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
  logoutUser: jest.fn(),
  switchDatabase: (...args: unknown[]) => mockSwitchDatabase(...args),
  switchTenant: jest.fn(),
}));

import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/use-auth';

describe('useAuth.switchDatabase — NEXT_REDIRECT no es un error', () => {
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateSession.mockResolvedValue({ valid: false });
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  /** Monta el hook y espera a que termine la carga inicial de sesión. */
  const mountAuth = async () => {
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return hook;
  };

  it('redirección esperada: NO se registra como error y se navega a "/"', async () => {
    mockSwitchDatabase.mockRejectedValueOnce(
      getRedirectError('/', 'push', 307),
    );
    const { result } = await mountAuth();

    await act(async () => {
      await result.current.switchDatabase();
    });

    // El bug: este rechazo esperado se registraba como "Switch database error".
    expect(errorSpy).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('fallo real de la action: se registra como error (con su causa) y se navega igual', async () => {
    const failure = new Error('fallo de red al cambiar de centro');
    mockSwitchDatabase.mockRejectedValueOnce(failure);
    const { result } = await mountAuth();

    await act(async () => {
      await result.current.switchDatabase();
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Switch database error', failure, {
      action: 'switchDatabase',
    });
    // Fallback existente: el usuario nunca se queda en una página autenticada.
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('otro error interno de Next (notFound) NO se confunde con una redirección', async () => {
    const notFound = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    mockSwitchDatabase.mockRejectedValueOnce(notFound);
    const { result } = await mountAuth();

    await act(async () => {
      await result.current.switchDatabase();
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Switch database error',
      notFound,
      expect.objectContaining({ action: 'switchDatabase' }),
    );
  });

  it('un rechazo sin digest ni objeto (p. ej. un string) tampoco es una redirección', async () => {
    mockSwitchDatabase.mockRejectedValueOnce('boom');
    const { result } = await mountAuth();

    await act(async () => {
      await result.current.switchDatabase();
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
