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
 *
 * H-4: el resto del hook eran otros 29 `console.log` sin guarda de entorno,
 * que llegaban al bundle de producción — uno imprimía el nombre del usuario.
 * Ahora van por `logger.debug`, que en producción no emite. El último bloque
 * de este archivo exige que el hook no escriba nada por `console`.
 */

import { render, renderHook, act } from '@testing-library/react';

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
import { SessionTimeoutProvider } from '@/components/auth/session-timeout-provider';

const TIMEOUT_MS = 1000;

describe('useSessionTimeout — auto-logout', () => {
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockLogout.mockResolvedValue(undefined);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    // El hook traza su ciclo de vida por debug; aquí solo estorba.
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
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
  /**
   * H-4 — Ningún `console.*` en el hook.
   *
   * Los 29 `console.log` que quedaban no tenían guarda de entorno: viajaban al
   * bundle de producción y escribían en la consola del navegador del operador
   * (uno de ellos, su nombre). `logger.debug` no emite con el nivel por
   * defecto de producción, así que el arreglo es moverlos todos ahí; este
   * test es lo que impide que vuelva a entrar uno.
   */
  it('no escribe nada por console: las trazas van por logger.debug', async () => {
    await expireSession();

    expect(consoleLogSpy).not.toHaveBeenCalled();
    // Y las trazas siguen existiendo: el arreglo no fue borrarlas.
    expect(debugSpy).toHaveBeenCalled();
  });

  it('no registra el nombre del usuario en ninguna traza', async () => {
    await expireSession();

    // `mockAuth.user.name` es 'Ana Torres'. Antes salía en el log de estado
    // de autenticación; para depurar basta con `hasUser`.
    const serializado = JSON.stringify(debugSpy.mock.calls);
    expect(serializado).not.toContain('Ana Torres');
  });
});
/**
 * H-4 — El provider tenía el mismo defecto que el hook.
 *
 * `SessionTimeoutProvider` envuelve el layout principal, así que su
 * `console.log` corría en cada render — y aparecía incluso en la salida del
 * `next build`, con la configuración del timeout. Va por `logger.debug` por
 * el mismo motivo que el hook.
 */
describe('SessionTimeoutProvider', () => {
  let debugSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('no escribe nada por console al montarse', () => {
    render(
      <SessionTimeoutProvider>
        <span>contenido</span>
      </SessionTimeoutProvider>,
    );

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'Session timeout: provider inicializado',
      expect.objectContaining({ action: 'sessionTimeout' }),
    );
  });

  it('renderiza a sus hijos tal cual', () => {
    const { getByText } = render(
      <SessionTimeoutProvider>
        <span>contenido</span>
      </SessionTimeoutProvider>,
    );

    expect(getByText('contenido')).toBeTruthy();
  });
});
