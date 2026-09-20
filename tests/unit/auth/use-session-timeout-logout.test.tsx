/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: useSessionTimeout — auto-logout por inactividad.
 *
 * `handleLogout` se dispara desde un setTimeout, sin `await` ni `catch` del
 * llamador: su propio `try/catch` es el único manejo de errores. Ese `catch`
 * absorbía todo y solo dejaba un `console.log('✅ … Logout completed, server
 * redirecting')`, así que una excepción inesperada del logout se presentaba
 * como éxito y no llegaba a Sentry. Además el disparo del auto-logout se
 * registraba con `console.log` en vez de `logger` (convención del proyecto).
 */

import { renderHook, act } from '@testing-library/react';

const mockLogout = jest.fn();
const mockAuth = {
  logout: (...args: unknown[]) => mockLogout(...args),
  isAuthenticated: true,
  user: { name: 'Ana Torres' },
};
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuth,
}));

const mockToast = { error: jest.fn(), warning: jest.fn(), success: jest.fn() };
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToast.error(...args),
    warning: (...args: unknown[]) => mockToast.warning(...args),
    success: (...args: unknown[]) => mockToast.success(...args),
  },
}));

import { logger } from '@/lib/logger';
import { useSessionTimeout } from '@/hooks/use-session-timeout';

const TIMEOUT_MS = 1000;

describe('useSessionTimeout — auto-logout', () => {
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockLogout.mockResolvedValue(undefined);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    // El hook tiene decenas de console.log de depuración ajenos a este bloque.
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  /** Monta el hook y deja correr el reloj hasta que vence el timeout. */
  const expireSession = async () => {
    const hook = renderHook(() =>
      useSessionTimeout({ timeoutDuration: TIMEOUT_MS, warningDuration: 500 }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS);
    });
    return hook;
  };

  const consoleLogged = (fragment: string) =>
    consoleLogSpy.mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes(fragment),
    );

  it('camino normal: avisa al usuario, llama a logout una vez y no registra error', async () => {
    await expireSession();

    expect(mockToast.error).toHaveBeenCalledWith(
      'Su sesión ha expirado por inactividad',
      expect.objectContaining({ duration: 5000 }),
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('el disparo del auto-logout se registra con logger, no con console.log', async () => {
    await expireSession();

    expect(infoSpy).toHaveBeenCalledWith(
      'Auto-logout triggered due to inactivity',
      { action: 'sessionTimeout' },
    );
    expect(consoleLogged('Auto-logout triggered')).toBe(false);
  });

  it('excepción inesperada del logout: se registra como error y NO como "Logout completed"', async () => {
    const failure = new Error('logout rechazó de forma inesperada');
    mockLogout.mockRejectedValueOnce(failure);

    await expireSession();

    // El bug: esto se absorbía con un console.log "Logout completed".
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Auto-logout failed', failure, {
      action: 'sessionTimeout',
    });
    expect(consoleLogged('Logout completed')).toBe(false);
  });
});
