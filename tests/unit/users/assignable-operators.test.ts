/**
 * `getAssignableOperators` — la lista que alimenta el selector de operador.
 *
 * Existe aparte de `getAllUsers` por los permisos, y eso es justamente lo que
 * estos tests fijan. `getAllUsers` exige `Ver usuarios`, que solo tiene el
 * Administrador; los dos roles que crean y editan casos —`Operadora de
 * Insolvencia` y `Abogado`— no lo tienen. Si el selector se alimentara de
 * `getAllUsers`, quedaría vacío justo para quienes lo necesitan (issue #83).
 *
 * El otro invariante que fijan: la acción devuelve lo MÍNIMO. Los roles que la
 * llaman no tienen `Ver usuarios`, así que devolverles el usuario completo
 * —correo, teléfono, cédula profesional, permisos del rol— sería entregarles
 * por la puerta de atrás lo que ese permiso les niega.
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

import { P } from '@/lib/permissions';
import { getAssignableOperators } from '@/features/user/actions';

const TENANT_ID = 'tenant-armonia';

/** Los permisos reales de cada rol, copiados de `src/prisma/seed.ts`. */
const PERMISOS_POR_ROL = {
  administrador: [P.VER_USUARIOS, P.VER_CASOS, P.CREAR_CASOS, P.EDITAR_CASOS],
  operadora: [P.VER_CASOS, P.CREAR_CASOS, P.EDITAR_CASOS],
  abogado: [P.VER_CASOS, P.CREAR_CASOS, P.EDITAR_CASOS],
  asistente: [P.VER_CASOS, P.VER_CASOS_PROPIOS, P.VER_DOCUMENTOS],
  secretaria: [P.VER_DOCUMENTOS, P.VER_CASOS],
} as const;

function comoUsuario(permissions: readonly string[]) {
  mockAuthenticateUser.mockResolvedValue({
    user: { id: 'u1', name: 'Quien sea', permissions: [...permissions] },
    tenantId: TENANT_ID,
  });
}

const FILAS = [
  {
    id: 'u-ana',
    name: 'Ana Operadora',
    role: { name: 'Operadora de Insolvencia' },
  },
  { id: 'u-ben', name: 'Ben Abogado', role: { name: 'Abogado' } },
  { id: 'u-cam', name: 'Cam Asistente', role: { name: 'Asistente Legal' } },
];

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  mockPrisma.user.findMany.mockResolvedValue(FILAS);
});

describe('permisos: se guarda por el trabajo, no por administrar usuarios', () => {
  it('la Operadora de Insolvencia puede obtener la lista aunque NO tenga "Ver usuarios"', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);

    const r = await getAssignableOperators();

    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(3);
  });

  it('el Abogado también, por la misma razón', async () => {
    comoUsuario(PERMISOS_POR_ROL.abogado);

    expect((await getAssignableOperators()).success).toBe(true);
  });

  it('el Administrador también (tiene los permisos de caso además de Ver usuarios)', async () => {
    comoUsuario(PERMISOS_POR_ROL.administrador);

    expect((await getAssignableOperators()).success).toBe(true);
  });

  it('alcanza con poder EDITAR casos, aunque no se puedan crear', async () => {
    comoUsuario([P.EDITAR_CASOS]);

    expect((await getAssignableOperators()).success).toBe(true);
  });

  it('quien no crea ni edita casos no obtiene la lista: la Asistente Legal', async () => {
    comoUsuario(PERMISOS_POR_ROL.asistente);

    const r = await getAssignableOperators();

    expect(r.success).toBe(false);
    expect(r.data).toBeUndefined();
    expect(r.error).toMatch(/permisos/i);
  });

  it('tampoco la Secretaria', async () => {
    comoUsuario(PERMISOS_POR_ROL.secretaria);

    expect((await getAssignableOperators()).success).toBe(false);
  });

  it('sin permisos no se consulta la base siquiera', async () => {
    comoUsuario([]);

    await getAssignableOperators();

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('aislamiento por centro', () => {
  it('consulta solo los usuarios del tenant del que llama', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);

    await getAssignableOperators();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
  });
});

describe('devuelve lo mínimo', () => {
  it('cada operador trae id, nombre y rol, y nada más', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);

    const r = await getAssignableOperators();

    expect(r.data?.[0]).toEqual({
      id: 'u-ana',
      name: 'Ana Operadora',
      roleName: 'Operadora de Insolvencia',
    });
    expect(Object.keys(r.data![0]).sort()).toEqual(['id', 'name', 'roleName']);
  });

  it('el select de Prisma no pide correo, teléfono, cédula ni permisos', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);

    await getAssignableOperators();

    const [args] = mockPrisma.user.findMany.mock.calls[0];
    expect(args.select).toEqual({
      id: true,
      name: true,
      role: { select: { name: true } },
    });
    expect(args.include).toBeUndefined();
  });

  it('vienen ordenados por nombre, para que el selector sea predecible', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);

    await getAssignableOperators();

    const [args] = mockPrisma.user.findMany.mock.calls[0];
    expect(args.orderBy).toEqual({ name: 'asc' });
  });

  it('un centro sin usuarios devuelve lista vacía, no error', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const r = await getAssignableOperators();

    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });
});

describe('fallos', () => {
  it('un error de base no se propaga como excepción', async () => {
    comoUsuario(PERMISOS_POR_ROL.operadora);
    mockPrisma.user.findMany.mockRejectedValue(new Error('conexión caída'));

    const r = await getAssignableOperators();

    expect(r.success).toBe(false);
    expect(r.error).toBe('conexión caída');
  });
});
