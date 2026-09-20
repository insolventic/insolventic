/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: useAuth.logout — redirección esperada vs fallo real.
 *
 * `logoutUser` termina siempre en `redirect('/')`; en el cliente Next rechaza la
 * promesa de la action con un error de redirección. El `catch` del hook lo
 * absorbía TODO como `debug`, así que un fallo real (red caída, 5xx, server
 * action inexistente tras un deploy) quedaba oculto. Además `setUser(null)`
 * corre antes de la llamada, de modo que la UI aparentaba una sesión cerrada
 * que en realidad seguía viva en el servidor.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
// El error de redirección se fabrica con la implementación REAL de Next (no a
// mano): si una actualización cambia el formato del `digest`, este test avisa.
import { getRedirectError } from 'next/dist/client/components/redirect';

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockValidateSession = jest.fn();
const mockLogoutUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
  logoutUser: (...args: unknown[]) => mockLogoutUser(...args),
  switchDatabase: jest.fn(),
  switchTenant: jest.fn(),
}));

import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/use-auth';

const SESSION_USER = {
  id: 'user-1',
  name: 'Ana Torres',
  email: 'ana@example.com',
  roleId: 'role-1',
  roleName: 'Administrador',
  permissions: ['Ver casos'],
  tenantId: 'armonia',
  tenantName: 'Armonía',
  lastLogin: new Date('2026-01-01'),
};

describe('useAuth.logout — redirección esperada vs fallo real', () => {
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Sesión válida al montar; los tests pueden cambiar la segunda respuesta.
    mockValidateSession.mockResolvedValue({ valid: true, user: SESSION_USER });
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  /** Monta el hook y espera a que la sesión inicial esté cargada. */
  const mountLoggedIn = async () => {
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.user).not.toBeNull());
    expect(mockValidateSession).toHaveBeenCalledTimes(1);
    return hook;
  };

  const doLogout = async (result: { current: ReturnType<typeof useAuth> }) => {
    await act(async () => {
      await result.current.logout();
    });
  };

  describe('redirección esperada (sin cambios)', () => {
    it('limpia la sesión, no registra error y no consulta al servidor de nuevo', async () => {
      mockLogoutUser.mockRejectedValueOnce(getRedirectError('/', 'push', 307));
      const { result } = await mountLoggedIn();

      await doLogout(result);

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(errorSpy).not.toHaveBeenCalled();
      // Éxito: no hay nada que reconciliar (Next navega solo).
      expect(mockValidateSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('fallo real de logoutUser', () => {
    const failures: Array<[string, () => unknown]> = [
      ['error de red / 5xx', () => new Error('Failed to fetch')],
      ['rechazo que no es objeto (string)', () => 'boom'],
      [
        'otro error interno de Next (notFound), no una redirección',
        () =>
          Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), {
            digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
          }),
      ],
    ];

    it.each(failures)(
      '%s: se registra como error con su causa',
      async (_label, makeFailure) => {
        const failure = makeFailure();
        mockLogoutUser.mockRejectedValueOnce(failure);
        const { result } = await mountLoggedIn();

        await doLogout(result);

        // El bug: esto se absorbía como "Logout redirect triggered" en debug.
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('Logout error', failure, {
          action: 'logout',
        });
      },
    );

    it('la sesión sigue viva en el servidor: la UI NO aparenta estar cerrada', async () => {
      mockLogoutUser.mockRejectedValueOnce(new Error('Failed to fetch'));
      const { result } = await mountLoggedIn();
      // validateSession sigue devolviendo la sesión válida (el logout no llegó).

      await doLogout(result);

      // El bug: setUser(null) se quedaba y la UI mostraba "sesión cerrada".
      expect(mockValidateSession).toHaveBeenCalledTimes(2); // inicial + reconciliar
      expect(result.current.user).toEqual(SESSION_USER);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('la sesión ya no existe en el servidor: la UI queda cerrada', async () => {
      mockLogoutUser.mockRejectedValueOnce(new Error('respuesta perdida'));
      const { result } = await mountLoggedIn();
      // El logout sí se ejecutó en el servidor pero la respuesta no llegó.
      mockValidateSession.mockResolvedValueOnce({ valid: false });

      await doLogout(result);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
