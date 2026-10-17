/**
 * Regresión del hallazgo G-A1: `globalSearch` no tenía ningún check de
 * permisos ni visibilidad por rol.
 *
 * Qué afirma cada bloque, y por qué tiene dientes:
 *
 *  - Los tres casos NEGATIVOS (rol sin permisos, cliente, alcance vacío) son
 *    los que fallan si alguien quita los guards: se verifica que la consulta
 *    **no se emita**, no solo que el resultado venga vacío. Un `findMany` con
 *    un `where` demasiado amplio devolvería filas en producción aunque el mock
 *    devuelva `[]`, así que afirmar sobre el resultado no probaría nada.
 *  - El caso del rol `Usuario` del seed es el que motivó el hallazgo: ese rol
 *    **sí** tiene `Ver deudores` y `Ver acreedores`, así que el gate por
 *    permiso no basta y hay que comprobar el acote por fila.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

import { TENANT, PERMISSIONS } from '../../helpers/fixtures';
import { globalSearch } from '@/features/search/actions';

const P = PERMISSIONS;

/** Los permisos de los 6 roles del seed, verificados contra `src/prisma/seed.ts`. */
const ROLE_PERMISSIONS = {
  Administrador: [
    P.VIEW_CASES,
    P.VIEW_ALL_CASES,
    P.VIEW_DEBTORS,
    'Ver acreedores',
  ],
  Abogado: [P.VIEW_CASES, P.VIEW_OWN_CASES, P.VIEW_DEBTORS, 'Ver acreedores'],
  Secretaria: ['Ver documentos', P.VIEW_CASES, P.VIEW_ALL_CASES],
  Usuario: [
    P.VIEW_CASES,
    P.VIEW_AS_CLIENT,
    P.VIEW_DEBTORS,
    'Ver acreedores',
    'Ver documentos',
  ],
} as const;

function signIn(permissions: readonly string[], overrides?: { id?: string }) {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: overrides?.id ?? 'user-under-test',
      name: 'Usuario de prueba',
      email: 'prueba@test.com',
      permissions: [...permissions],
    },
    tenantId: TENANT.id,
  });
}

describe('globalSearch — control de acceso (G-A1)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
  });

  describe('gate por permiso, por categoría', () => {
    it('un rol SIN ninguno de los tres permisos no consulta nada y no ve nada', async () => {
      signIn(['Ver notificaciones']);

      const result = await globalSearch('pepito');

      expect(result).toEqual({ success: true, data: [] });
      // Lo que importa: ni una sola consulta salió.
      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.debtor.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.creditor.findMany).not.toHaveBeenCalled();
    });

    it('Secretaria (casos sí, deudores/acreedores no) solo consulta casos', async () => {
      signIn(ROLE_PERMISSIONS.Secretaria);

      await globalSearch('pepito');

      expect(mockPrisma.case.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.debtor.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.creditor.findMany).not.toHaveBeenCalled();
    });

    it('sin VER_CASOS pero con VER_DEUDORES, no consulta casos', async () => {
      signIn([P.VIEW_DEBTORS, P.VIEW_ALL_CASES]);

      await globalSearch('pepito');

      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.debtor.findMany).toHaveBeenCalledTimes(1);
    });

    it('una consulta de menos de 2 caracteres no toca la base', async () => {
      signIn(ROLE_PERMISSIONS.Administrador);

      const result = await globalSearch('a');

      expect(result).toEqual({ success: true, data: [] });
      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
      expect(mockAuthenticateUser).toHaveBeenCalled();
    });
  });

  describe('visibilidad por fila en los casos', () => {
    it('Administrador (Ver todos los casos) no lleva filtro de fila', async () => {
      signIn(ROLE_PERMISSIONS.Administrador);

      await globalSearch('pepito');

      const where = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT.id);
      expect(where.operatorId).toBeUndefined();
      expect(where.debtorId).toBeUndefined();
    });

    it('Abogado (Ver casos propios) filtra por operatorId', async () => {
      signIn(ROLE_PERMISSIONS.Abogado, { id: 'user-abogado' });

      await globalSearch('pepito');

      const where = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(where.operatorId).toBe('user-abogado');
      expect(where.tenantId).toBe(TENANT.id);
    });

    it('Usuario (cliente) filtra por su propio debtorId', async () => {
      signIn(ROLE_PERMISSIONS.Usuario);
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-del-cliente' });

      await globalSearch('pepito');

      const where = mockPrisma.case.findMany.mock.calls[0][0].where;
      expect(where.debtorId).toBe('debtor-del-cliente');
      expect(where.operatorId).toBeUndefined();
    });
  });

  describe('el rol cliente no puede enumerar deudores ni acreedores ajenos', () => {
    it('acota los deudores a su propia ficha, pese a tener VER_DEUDORES', async () => {
      signIn(ROLE_PERMISSIONS.Usuario);
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-del-cliente' });

      await globalSearch('pepito');

      const where = mockPrisma.debtor.findMany.mock.calls[0][0].where;
      // Sin este `id`, la consulta devuelve a TODOS los deudores del centro:
      // es exactamente el hallazgo G-A1.
      expect(where.id).toBe('debtor-del-cliente');
      expect(where.tenantId).toBe(TENANT.id);
    });

    it('acota los acreedores a los de sus propios expedientes', async () => {
      signIn(ROLE_PERMISSIONS.Usuario);
      mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-del-cliente' });

      await globalSearch('banco');

      const where = mockPrisma.creditor.findMany.mock.calls[0][0].where;
      expect(where.debts).toEqual({
        some: { tenantId: TENANT.id, case: { debtorId: 'debtor-del-cliente' } },
      });
    });

    it('un cliente SIN ficha de deudor no consulta nada en ninguna categoría', async () => {
      signIn(ROLE_PERMISSIONS.Usuario);
      // No existe `Debtor` con el correo de la sesión.
      mockPrisma.debtor.findFirst.mockResolvedValue(null);

      const result = await globalSearch('pepito');

      expect(result).toEqual({ success: true, data: [] });
      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.debtor.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.creditor.findMany).not.toHaveBeenCalled();
    });

    it('con VER_CASOS pero sin permiso de alcance, no consulta nada', async () => {
      // Un rol mal configurado: puede "ver casos" pero no se le dijo cuáles.
      signIn([P.VIEW_CASES, P.VIEW_DEBTORS, 'Ver acreedores']);

      const result = await globalSearch('pepito');

      expect(result).toEqual({ success: true, data: [] });
      expect(mockPrisma.case.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.debtor.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.creditor.findMany).not.toHaveBeenCalled();
    });
  });

  describe('aislamiento multi-tenant (no se pierde al añadir el scoping)', () => {
    it('las tres consultas siguen acotadas por tenantId', async () => {
      signIn(ROLE_PERMISSIONS.Administrador);

      await globalSearch('pepito');

      expect(mockPrisma.case.findMany.mock.calls[0][0].where.tenantId).toBe(
        TENANT.id,
      );
      expect(mockPrisma.debtor.findMany.mock.calls[0][0].where.tenantId).toBe(
        TENANT.id,
      );
      expect(mockPrisma.creditor.findMany.mock.calls[0][0].where.tenantId).toBe(
        TENANT.id,
      );
    });
  });
});
