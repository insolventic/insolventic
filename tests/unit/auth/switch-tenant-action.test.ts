/**
 * Unit Tests: switchTenant (server action) — src/features/auth/actions.ts.
 *
 * Hasta ahora la action no tenía ningún test. Cubre el flujo normal de cambio
 * de centro, sus rechazos de negocio y, sobre todo, cómo distingue el error de
 * `redirect()` (que DEBE propagarse) de un fallo real (que debe volver como
 * `{ success: false }` y quedar registrado).
 *
 * El éxito de la action nunca "retorna": termina en `redirect('/dashboard')`,
 * que en Next se implementa lanzando un error con `digest` NEXT_REDIRECT.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/lib/email', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  },
}));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
// El error de redirección se fabrica con la implementación REAL de Next (no a
// mano): si una actualización cambia el formato del `digest`, este test avisa.
import { getRedirectError } from 'next/dist/client/components/redirect';

import { mockCookies } from '../../__mocks__/next-headers';
import { ADMIN_USER } from '../../helpers/fixtures';
import { createAccessToken, verifyToken } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { switchTenant } from '@/features/auth/actions';

const mockRedirect = redirect as unknown as jest.Mock;

const CURRENT_SLUG = 'armonia';
const TARGET_TENANT = {
  id: 'tenant-b-id',
  slug: 'constructores-paz',
  name: 'Constructores de Paz',
};
const USER_IN_TARGET = {
  ...ADMIN_USER,
  id: 'user-admin-b-id',
  tenantId: TARGET_TENANT.id,
  mustChangePassword: false,
};

/** Deja una sesión válida del usuario en el centro actual. */
const loginInCurrentTenant = async () => {
  const token = await createAccessToken({
    id: ADMIN_USER.id,
    name: ADMIN_USER.name,
    email: ADMIN_USER.email,
    roleId: ADMIN_USER.roleId,
    roleName: 'Administrador',
    permissions: ['Ver casos'],
    tenantId: CURRENT_SLUG,
    tenantName: 'Armonía',
    lastLogin: new Date(),
  });
  mockCookies.setToken('access-token', token);
};

/** El error que la action deja propagar, para inspeccionar su destino. */
const captureRejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as { digest?: string; message?: string };
  }
  throw new Error('La action debía rechazar (redirect) y resolvió');
};

describe('switchTenant — server action', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    resetAllMocks();
    mockCookies.clear();
    jest.clearAllMocks();
    // redirect() de Next: señala la redirección lanzando el error real.
    mockRedirect.mockImplementation((url: string) => {
      throw getRedirectError(url, 'push', 307);
    });
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    mockPrisma.tenant.findUnique.mockResolvedValue(TARGET_TENANT);
    mockPrisma.user.findUnique.mockResolvedValue(USER_IN_TARGET);
    mockPrisma.user.update.mockResolvedValue(USER_IN_TARGET);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('camino feliz', () => {
    it('emite tokens del centro destino, actualiza lastLogin y redirige a /dashboard', async () => {
      await loginInCurrentTenant();

      const rejection = await captureRejection(
        switchTenant(TARGET_TENANT.slug),
      );

      // El éxito llega como error de redirección hacia /dashboard, propagado.
      expect(rejection.digest).toMatch(/^NEXT_REDIRECT;push;\/dashboard;/);
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
      expect(errorSpy).not.toHaveBeenCalled();

      // Las cookies nuevas pertenecen al centro destino.
      const newAccess = mockCookies.get('access-token')?.value as string;
      expect(newAccess).toBeDefined();
      expect((await verifyToken(newAccess))?.tenantId).toBe(TARGET_TENANT.slug);
      expect(mockCookies.get('refresh-token')).toBeDefined();

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_IN_TARGET.id },
        data: { lastLogin: expect.any(Date) },
      });
      expect(revalidateTag).toHaveBeenCalledWith('auth');
    });
  });

  describe('sesión ausente o inválida: la redirección a /login se propaga', () => {
    it('sin cookie de acceso', async () => {
      const rejection = await captureRejection(
        switchTenant(TARGET_TENANT.slug),
      );

      expect(rejection.digest).toMatch(/^NEXT_REDIRECT;push;\/login;/);
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('con un token inválido', async () => {
      mockCookies.setToken('access-token', 'token.invalido.firmado-mal');

      const rejection = await captureRejection(
        switchTenant(TARGET_TENANT.slug),
      );

      expect(rejection.digest).toMatch(/^NEXT_REDIRECT;push;\/login;/);
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('rechazos de negocio: vuelven como { success: false } sin lanzar', () => {
    it('centro destino inexistente', async () => {
      await loginInCurrentTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(switchTenant('no-existe')).resolves.toEqual({
        success: false,
        error: 'Organización no encontrada',
      });
    });

    it('ya está en ese centro', async () => {
      await loginInCurrentTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...TARGET_TENANT,
        slug: CURRENT_SLUG,
      });

      await expect(switchTenant(CURRENT_SLUG)).resolves.toEqual({
        success: false,
        error: 'Ya estás en esta organización',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('el usuario no tiene cuenta en el centro destino', async () => {
      await loginInCurrentTenant();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(switchTenant(TARGET_TENANT.slug)).resolves.toEqual({
        success: false,
        error: 'No tienes cuenta en esta organización',
      });
    });

    it('debe cambiar la contraseña antes: no emite cookies ni redirige', async () => {
      await loginInCurrentTenant();
      const cookiesBefore = mockCookies.get('access-token')?.value;
      mockPrisma.user.findUnique.mockResolvedValue({
        ...USER_IN_TARGET,
        mustChangePassword: true,
      });

      await expect(switchTenant(TARGET_TENANT.slug)).resolves.toEqual({
        success: false,
        error: 'Debe establecer una nueva contraseña antes de continuar.',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockCookies.get('access-token')?.value).toBe(cookiesBefore);
    });
  });

  describe('fallo real inesperado', () => {
    it('devuelve { success: false } con el mensaje genérico y lo registra como error', async () => {
      await loginInCurrentTenant();
      const failure = new Error('la base de datos no responde');
      mockPrisma.tenant.findUnique.mockRejectedValue(failure);

      await expect(switchTenant(TARGET_TENANT.slug)).resolves.toEqual({
        success: false,
        error: 'Error al cambiar de organización',
      });
      expect(errorSpy).toHaveBeenCalledWith('Error switching tenant', failure);
    });
  });

  describe('cómo se reconoce el error de redirect()', () => {
    it('una redirección cuyo message NO es exactamente "NEXT_REDIRECT" igual se propaga', async () => {
      // Es la forma que lanza el mock compartido del repo
      // (tests/__mocks__/next-navigation.ts): message con la URL. Reconocer la
      // redirección por su `message` dependía de un detalle de implementación;
      // el contrato de Next es el `digest`.
      await loginInCurrentTenant();
      mockRedirect.mockImplementation((url: string) => {
        throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
          digest: `NEXT_REDIRECT;push;${url};307;`,
        });
      });

      const rejection = await captureRejection(
        switchTenant(TARGET_TENANT.slug),
      );

      // El bug: se trataba como fallo real y resolvía success:false.
      expect(rejection.digest).toMatch(/^NEXT_REDIRECT;push;\/dashboard;/);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('un error común con message "NEXT_REDIRECT" pero sin digest NO es una redirección', async () => {
      await loginInCurrentTenant();
      const impostor = new Error('NEXT_REDIRECT');
      mockPrisma.user.update.mockRejectedValue(impostor);

      // El bug: se relanzaba como si fuera una redirección y el fallo real
      // (aquí, no poder actualizar lastLogin) se perdía sin registrarse.
      await expect(switchTenant(TARGET_TENANT.slug)).resolves.toEqual({
        success: false,
        error: 'Error al cambiar de organización',
      });
      expect(errorSpy).toHaveBeenCalledWith('Error switching tenant', impostor);
    });
  });
});
