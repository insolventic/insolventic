/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests: useAuth.switchTenant — fallo real vs redirección de éxito.
 *
 * La server action `switchTenant` devuelve `{ success: false, error }` en todo
 * fallo de negocio y, cuando el cambio sale bien, termina en
 * `redirect('/dashboard')`: en el cliente el ÉXITO llega como un rechazo con
 * error de redirección. El `catch` del hook asumía que eso era lo único que
 * podía lanzarse y devolvía `{ success: true }` para CUALQUIER excepción: una
 * red caída, un 5xx o un "Failed to find Server Action" tras un deploy se
 * reportaban como cambio de centro exitoso.
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
const mockSwitchTenant = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
  logoutUser: jest.fn(),
  switchDatabase: jest.fn(),
  switchTenant: (...args: unknown[]) => mockSwitchTenant(...args),
}));

import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/use-auth';

const TARGET = 'constructores-paz';

describe('useAuth.switchTenant — fallo real vs redirección esperada', () => {
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

  const callSwitchTenant = async (result: {
    current: ReturnType<typeof useAuth>;
  }) => {
    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.switchTenant(TARGET);
    });
    return outcome!;
  };

  describe('fallos reales: NO son éxito', () => {
    it('error de red/5xx al invocar la action: success false, mensaje y error registrado', async () => {
      const failure = new Error('Failed to fetch');
      mockSwitchTenant.mockRejectedValueOnce(failure);
      const { result } = await mountAuth();

      const outcome = await callSwitchTenant(result);

      // El bug: esto devolvía { success: true }.
      expect(outcome.success).toBe(false);
      expect(outcome.error).toBe('Error al cambiar de organización');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Switch tenant error',
        failure,
        expect.objectContaining({ action: 'switchTenant' }),
      );
    });

    it('un rechazo que no es objeto (p. ej. un string) tampoco es éxito', async () => {
      mockSwitchTenant.mockRejectedValueOnce('boom');
      const { result } = await mountAuth();

      const outcome = await callSwitchTenant(result);

      expect(outcome.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('otro error interno de Next (notFound) NO se confunde con una redirección', async () => {
      const notFound = Object.assign(
        new Error('NEXT_HTTP_ERROR_FALLBACK;404'),
        { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' },
      );
      mockSwitchTenant.mockRejectedValueOnce(notFound);
      const { result } = await mountAuth();

      const outcome = await callSwitchTenant(result);

      expect(outcome.success).toBe(false);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('camino feliz y casos esperados (sin cambios)', () => {
    it.each(['/dashboard', '/login'])(
      'redirección a %s: se trata como antes (success true, sin error registrado)',
      async (destination) => {
        // Éxito real: la action termina en redirect('/dashboard'). A /login
        // redirige cuando la sesión ya no es válida. En ambos, Next navega.
        mockSwitchTenant.mockRejectedValueOnce(
          getRedirectError(destination, 'push', 307),
        );
        const { result } = await mountAuth();

        const outcome = await callSwitchTenant(result);

        expect(outcome).toEqual({ success: true });
        expect(errorSpy).not.toHaveBeenCalled();
      },
    );

    it('fallo de negocio devuelto por la action: se propaga tal cual y no refresca la sesión', async () => {
      mockSwitchTenant.mockResolvedValueOnce({
        success: false,
        error: 'No tienes cuenta en esta organización',
      });
      const { result } = await mountAuth();
      expect(mockValidateSession).toHaveBeenCalledTimes(1); // carga inicial

      const outcome = await callSwitchTenant(result);

      expect(outcome).toEqual({
        success: false,
        error: 'No tienes cuenta en esta organización',
      });
      expect(errorSpy).not.toHaveBeenCalled();
      expect(mockValidateSession).toHaveBeenCalledTimes(1);
    });

    it('si la action resuelve success true (sin redirect): refresca la sesión y lo devuelve', async () => {
      mockSwitchTenant.mockResolvedValueOnce({ success: true });
      const { result } = await mountAuth();

      const outcome = await callSwitchTenant(result);

      expect(outcome).toEqual({ success: true });
      expect(mockValidateSession).toHaveBeenCalledTimes(2); // inicial + refresh
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
