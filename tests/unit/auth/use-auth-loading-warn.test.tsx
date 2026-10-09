/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: el falso positivo de "useAuth loading for over 30 seconds".
 *
 * Issue de Sentry sobre `/login`, abierto hace ~4 semanas. El mensaje lo emite
 * la app misma (`logger.warn`, que va a Sentry), y era un falso positivo
 * GARANTIZADO, por dos defectos que se sumaban:
 *
 *  1. `loadingStartTimeRef` se reseteaba cuando la carga TERMINABA, así que la
 *     "duración de carga" medía el tiempo transcurrido DESDE que terminó y
 *     crecía sin límite mientras el hook siguiera montado.
 *  2. La condición de entrada de la traza era `(isLoading || !user)`: la rama
 *     `!user` la mantenía viva para cualquier visitante SIN SESIÓN.
 *
 * Resultado: todo el que pasara más de 30 segundos en `/login` disparaba la
 * advertencia, una vez cada 2 segundos, diciendo que algo llevaba 30 segundos
 * cargando cuando no había nada cargando. Y el mensaje era imposible de origen:
 * el timeout de seguridad del propio hook fuerza `isLoading = false` a los 5s.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockValidateSession = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
  logoutUser: jest.fn(),
  switchDatabase: jest.fn(),
  switchTenant: jest.fn(),
}));

import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/use-auth';

/** Los warns de "loading over 30 seconds" que llegaron al logger. */
function warnsDeCarga(spy: jest.SpyInstance): string[] {
  return spy.mock.calls
    .map((c) => String(c[0]))
    .filter((m) => m.includes('loading for over'));
}

describe('visitante sin sesión en /login', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    // Lo que devuelve validateSession para alguien que todavía no entró.
    mockValidateSession.mockResolvedValue({ valid: false, user: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('no avisa de "loading" tras un minuto en la pantalla de login', async () => {
    const { result, rerender } = renderHook(() => useAuth());

    // La carga inicial termina: sesión inválida, sin usuario.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();

    // El visitante se queda un minuto en /login (escribiendo, leyendo, o con
    // la pestaña abierta). Se fuerzan re-renders, que es lo que antes
    // disparaba la traza: vivía en el cuerpo del componente.
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      rerender();
    }

    expect(warnsDeCarga(warnSpy)).toEqual([]);
  });

  it('tampoco avisa cuando la carga termina rápido y el hook sigue montado', async () => {
    const { result, rerender } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 45 segundos montado después de que la carga terminó: el ref mal
    // reseteado hacía que esto contara como "45 segundos cargando".
    await act(async () => {
      jest.advanceTimersByTime(45_000);
    });
    rerender();

    expect(warnsDeCarga(warnSpy)).toEqual([]);
  });
});

describe('la duración que se reporta es la de la carga real', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mockValidateSession.mockResolvedValue({ valid: false, user: null });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('con la carga terminada, loadingDurationSeconds es 0 y no crece', async () => {
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    const { result, rerender } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    rerender();

    // Todas las trazas emitidas con isLoading=false reportan duración 0; antes
    // el número crecía con el tiempo montado y alimentaba la advertencia.
    const durancionesSinCarga = debugSpy.mock.calls
      .map((c) => c[1] as { isLoading?: boolean; loadingDurationSeconds?: number })
      .filter((ctx) => ctx && ctx.isLoading === false)
      .map((ctx) => ctx.loadingDurationSeconds);

    expect(durancionesSinCarga.length).toBeGreaterThan(0);
    expect(durancionesSinCarga.every((d) => d === 0)).toBe(true);
  });
});
