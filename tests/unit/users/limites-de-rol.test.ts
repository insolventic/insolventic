/**
 * Editar usuarios o roles no sirve para subirse de rol ni para dejar al centro
 * sin quien lo administre (`src/features/role/limites-de-permisos.ts`).
 *
 * El cliente de Prisma está mockeado sobre un centro en memoria: roles con sus
 * permisos y cuentas con su rol. La versión contra Postgres real, que además
 * comprueba que la sesión no ganó permisos, está en
 * `tests/db/update-user-escalada-rol.db.test.ts`.
 */

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
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/email', () => ({
  emailService: {
    sendUserCreatedEmail: jest.fn().mockResolvedValue(true),
    sendEmailChangedNotice: jest.fn().mockResolvedValue(true),
  },
}));
const mockWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: (...a: unknown[]) => mockWarn(...a),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { P } from '@/lib/permissions';
import { createUser, deleteUser, updateUser } from '@/features/user/actions';
import { createRole, updateRole } from '@/features/role/actions';
import {
  PERMISOS_DE_ADMINISTRACION,
  PROPIO_ROL,
  ULTIMA_ADMINISTRACION,
} from '@/features/role/limites-de-permisos';

const TENANT = 'tenant-armonia';

const ADMIN = [...PERMISOS_DE_ADMINISTRACION, P.VER_CASOS];
const COORDINACION = [P.VER_USUARIOS, P.EDITAR_USUARIOS, P.VER_CASOS];

interface Rol {
  id: string;
  name: string;
  permisos: string[];
}
interface Cuenta {
  id: string;
  name: string;
  roleId: string;
}

let roles: Rol[];
let cuentas: Cuenta[];

const rol = (id: string) => roles.find((r) => r.id === id);
const conPermisos = (r: Rol) => ({
  id: r.id,
  name: r.name,
  description: '',
  color: 'bg-gray-100 text-gray-800',
  users: [],
  permissions: r.permisos.map((name) => ({ permission: { name } })),
});

function fila(c: Cuenta) {
  return {
    ...c,
    email: `${c.id}@centroejemplo.test`,
    phone: '3152240078',
    address: 'Avenida 19 # 104-37',
    professionalCard: '204417',
    lastLogin: null,
    createdDate: new Date('2026-11-01'),
    role: conPermisos(rol(c.roleId)!),
  };
}

function montarCentro() {
  roles = [
    { id: 'rol-admin', name: 'Administrador', permisos: [...ADMIN] },
    { id: 'rol-coord', name: 'Coordinación', permisos: [...COORDINACION] },
    { id: 'rol-consulta', name: 'Consulta', permisos: [P.VER_CASOS] },
    {
      id: 'rol-consulta-usuarios',
      name: 'Consulta de usuarios',
      permisos: [P.VER_USUARIOS, P.VER_CASOS],
    },
  ];
  cuentas = [
    { id: 'admin', name: 'Admin Uno', roleId: 'rol-admin' },
    { id: 'coord', name: 'Coordinadora', roleId: 'rol-coord' },
    { id: 'colega', name: 'Colega', roleId: 'rol-consulta' },
  ];

  mockPrisma.role.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; tenantId: string } }) => {
      const r = where.tenantId === TENANT ? rol(where.id) : undefined;
      return r ? conPermisos(r) : null;
    },
  );
  mockPrisma.role.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => {
      const r = rol(where.id);
      return r ? conPermisos(r) : null;
    },
  );
  mockPrisma.role.findMany.mockImplementation(async () =>
    roles.map((r) => ({
      ...conPermisos(r),
      users: cuentas
        .filter((c) => c.roleId === r.id)
        .map((c) => ({ id: c.id })),
    })),
  );
  mockPrisma.role.create.mockImplementation(
    async ({ data }: { data: { name: string } }) => {
      const nuevo = { id: 'rol-nuevo', name: data.name, permisos: [] };
      roles.push(nuevo);
      return conPermisos(nuevo);
    },
  );
  mockPrisma.rolePermission.createMany.mockImplementation(
    async ({ data }: { data: { roleId: string; permissionId: string }[] }) => {
      for (const { roleId, permissionId } of data) {
        rol(roleId)!.permisos.push(permissionId.replace(/^p-/, ''));
      }
      return { count: data.length };
    },
  );
  mockPrisma.permission.findMany.mockImplementation(
    async ({ where }: { where: { name: { in: string[] } } }) =>
      where.name.in.map((name) => ({ id: `p-${name}`, name })),
  );
  mockPrisma.user.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; tenantId: string } }) => {
      const c = cuentas.find((u) => u.id === where.id);
      return c && where.tenantId === TENANT ? fila(c) : null;
    },
  );
  mockPrisma.user.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { role?: { connect: { id: string } } };
    }) => {
      const c = cuentas.find((u) => u.id === where.id)!;
      if (data.role) c.roleId = data.role.connect.id;
      return fila(c);
    },
  );
  mockPrisma.user.delete.mockImplementation(
    async ({ where }: { where: { id: string } }) => {
      const c = cuentas.find((u) => u.id === where.id)!;
      return fila(c);
    },
  );
  mockPrisma.user.create.mockImplementation(
    async ({ data }: { data: { name: string; email: string } }) => ({
      id: 'nueva',
      name: data.name,
      email: data.email,
      phone: '3152240078',
      address: 'Avenida 19 # 104-37',
      professionalCard: '204417',
      roleId: 'rol-consulta',
      lastLogin: null,
      createdDate: new Date(),
      role: { name: 'Consulta' },
    }),
  );
}

/** La sesión es la de `cuentaId`, con los permisos que su rol tiene ahora. */
function sesion(cuentaId: string) {
  const c = cuentas.find((u) => u.id === cuentaId)!;
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: c.id,
      name: c.name,
      email: `${c.id}@centroejemplo.test`,
      roleName: rol(c.roleId)!.name,
      professionalCard: '204417',
      permissions: [...rol(c.roleId)!.permisos],
    },
    tenantId: TENANT,
  });
}

const rolDe = (id: string) => cuentas.find((c) => c.id === id)!.roleId;

function rechazoRegistrado(motivo: string) {
  expect(mockWarn).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ motivo }),
  );
}

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  montarCentro();
});

describe('updateUser — escalada de rol', () => {
  it('no deja ponerse a sí mismo el rol Administrador', async () => {
    sesion('coord');

    const result = await updateUser({ id: 'coord', roleId: 'rol-admin' });

    expect(result).toEqual({ success: false, error: PROPIO_ROL });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(rolDe('coord')).toBe('rol-coord');
    rechazoRegistrado('propio-rol');
  });

  it('no deja cambiarse a sí mismo el rol, tampoco hacia abajo', async () => {
    sesion('coord');

    const result = await updateUser({ id: 'coord', roleId: 'rol-consulta' });

    expect(result).toEqual({ success: false, error: PROPIO_ROL });
    expect(rolDe('coord')).toBe('rol-coord');
  });

  it('no deja ponerle a otra cuenta un rol con permisos que no tiene', async () => {
    sesion('coord');

    const result = await updateUser({ id: 'colega', roleId: 'rol-admin' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No puede asignar el rol «Administrador»/);
    expect(result.error).toContain(P.EDITAR_ROLES);
    expect(result.error).not.toContain(P.EDITAR_USUARIOS);
    expect(rolDe('colega')).toBe('rol-consulta');
    rechazoRegistrado('asigna-permisos-que-no-tiene');
  });

  it('no deja modificar una cuenta con más permisos, ni siquiera el correo', async () => {
    sesion('coord');

    const result = await updateUser({
      id: 'admin',
      email: 'coord-personal@centroejemplo.test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'No puede modificar la cuenta de Admin Uno: su rol tiene permisos que el suyo no tiene.',
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    rechazoRegistrado('cuenta-con-mas-permisos');
  });

  // Hoy lo impiden también las otras reglas: el último administrador no se
  // cambia el rol a sí mismo, y nadie sin sus permisos toca su cuenta. Para ver
  // la regla sola, la sesión tiene los permisos de administración pero su
  // cuenta no está entre las del centro (como si la regla de «más permisos» se
  // relajara algún día).
  it('no deja quitarle el rol al último administrador', async () => {
    cuentas.push({ id: 'fuera', name: 'Fuera', roleId: 'rol-admin' });
    sesion('fuera');
    cuentas = cuentas.filter((c) => c.id !== 'fuera');

    const result = await updateUser({ id: 'admin', roleId: 'rol-consulta' });

    expect(result).toEqual({ success: false, error: ULTIMA_ADMINISTRACION });
    expect(rolDe('admin')).toBe('rol-admin');
    rechazoRegistrado('ultima-administracion');
  });

  it('deja quitarle el rol a un administrador si queda otro', async () => {
    cuentas.push({ id: 'admin-2', name: 'Admin Dos', roleId: 'rol-admin' });
    sesion('admin-2');

    const result = await updateUser({ id: 'admin', roleId: 'rol-consulta' });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(rolDe('admin')).toBe('rol-consulta');
  });

  it('el rol de otro centro sigue siendo «Rol no encontrado»', async () => {
    sesion('admin');

    const result = await updateUser({ id: 'colega', roleId: 'rol-de-otro' });

    expect(result).toEqual({ success: false, error: 'Rol no encontrado' });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  // Controles: el diálogo de edición manda siempre `roleId`, también cuando no
  // se tocó. Sin estos, los rechazos de arriba pasarían igual si la regla
  // tumbara cualquier edición.
  it('deja editar los datos propios reenviando el mismo rol', async () => {
    sesion('coord');

    const result = await updateUser({
      id: 'coord',
      roleId: 'rol-coord',
      phone: '3001112233',
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(rolDe('coord')).toBe('rol-coord');
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('deja asignar a otro un rol cuyos permisos sí tiene', async () => {
    sesion('coord');

    const result = await updateUser({
      id: 'colega',
      roleId: 'rol-consulta-usuarios',
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(rolDe('colega')).toBe('rol-consulta-usuarios');
  });

  it('el administrador sigue pudiendo asignar el rol Administrador', async () => {
    sesion('admin');

    const result = await updateUser({ id: 'colega', roleId: 'rol-admin' });

    expect(result.success).toBe(true);
    expect(rolDe('colega')).toBe('rol-admin');
  });
});

describe('createUser — escalada de rol', () => {
  const alta = (roleId: string) => ({
    name: 'Cuenta Nueva',
    email: 'nueva@centroejemplo.test',
    phone: '3152240078',
    address: 'Avenida 19 # 104-37',
    professionalCard: '204417',
    roleId,
  });

  beforeEach(() => {
    roles.find((r) => r.id === 'rol-coord')!.permisos.push(P.CREAR_USUARIOS);
  });

  it('no deja crear una cuenta con un rol con permisos que no tiene', async () => {
    sesion('coord');

    const result = await createUser(alta('rol-admin'));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No puede asignar el rol «Administrador»/);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    rechazoRegistrado('asigna-permisos-que-no-tiene');
  });

  it('deja crear una cuenta con un rol cuyos permisos sí tiene', async () => {
    sesion('coord');

    const result = await createUser(alta('rol-consulta'));

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  });
});

describe('deleteUser — último administrador y cuentas con más permisos', () => {
  beforeEach(() => {
    roles.find((r) => r.id === 'rol-coord')!.permisos.push(P.ELIMINAR_USUARIOS);
  });

  it('no deja eliminar una cuenta con más permisos que los propios', async () => {
    sesion('coord');

    const result = await deleteUser('admin');

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'No puede eliminar la cuenta de Admin Uno: su rol tiene permisos que el suyo no tiene.',
    );
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    rechazoRegistrado('cuenta-con-mas-permisos');
  });

  // Igual que en `updateUser`: la sesión administra pero su cuenta no está
  // entre las del centro, para ver la regla de la última administración sola.
  it('no deja eliminar al último administrador', async () => {
    cuentas.push({ id: 'fuera', name: 'Fuera', roleId: 'rol-admin' });
    sesion('fuera');
    cuentas = cuentas.filter((c) => c.id !== 'fuera');

    const result = await deleteUser('admin');

    expect(result).toEqual({ success: false, error: ULTIMA_ADMINISTRACION });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    rechazoRegistrado('ultima-administracion');
  });

  it('el último administrador no se puede eliminar a sí mismo', async () => {
    sesion('admin');

    const result = await deleteUser('admin');

    expect(result.success).toBe(false);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('deja eliminar una cuenta con menos permisos', async () => {
    sesion('coord');

    const result = await deleteUser('colega');

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(mockPrisma.user.delete).toHaveBeenCalledTimes(1);
  });
});

describe('updateRole y createRole — escalada por el rol', () => {
  beforeEach(() => {
    roles
      .find((r) => r.id === 'rol-coord')!
      .permisos.push(P.CREAR_ROLES, P.EDITAR_ROLES);
  });

  it('no deja agregarse a su propio rol permisos que no tiene', async () => {
    sesion('coord');

    const result = await updateRole({
      id: 'rol-coord',
      permissions: [...rol('rol-coord')!.permisos, P.ELIMINAR_USUARIOS],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      `No puede dar a un rol permisos que su rol no tiene (${P.ELIMINAR_USUARIOS}).`,
    );
    expect(mockPrisma.role.update).not.toHaveBeenCalled();
    expect(mockPrisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    rechazoRegistrado('asigna-permisos-que-no-tiene');
  });

  it('no deja modificar un rol con permisos que no tiene', async () => {
    sesion('coord');

    const result = await updateRole({
      id: 'rol-admin',
      permissions: [P.VER_CASOS],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'No puede modificar el rol «Administrador»: tiene permisos que su rol no tiene.',
    );
    expect(mockPrisma.role.update).not.toHaveBeenCalled();
    rechazoRegistrado('rol-con-mas-permisos');
  });

  it('no deja quitarle al rol Administrador lo que lo hace administrar, si es el único', async () => {
    sesion('admin');

    const result = await updateRole({
      id: 'rol-admin',
      permissions: ADMIN.filter((p) => p !== P.EDITAR_ROLES),
    });

    expect(result).toEqual({ success: false, error: ULTIMA_ADMINISTRACION });
    expect(mockPrisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    rechazoRegistrado('ultima-administracion');
  });

  it('deja al administrador quitarle permisos de casos a su rol', async () => {
    sesion('admin');

    const result = await updateRole({
      id: 'rol-admin',
      permissions: [...PERMISOS_DE_ADMINISTRACION],
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('deja editar un rol con permisos que sí tiene', async () => {
    sesion('coord');

    const result = await updateRole({
      id: 'rol-consulta',
      permissions: [P.VER_CASOS, P.VER_USUARIOS],
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('no deja crear un rol con permisos que no tiene', async () => {
    sesion('coord');

    const result = await createRole({
      name: 'Atajo',
      description: 'Rol para subirse',
      color: '#336699',
      permissions: [P.VER_CASOS, P.EDITAR_ROLES, P.ELIMINAR_ROLES],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      `No puede dar a un rol permisos que su rol no tiene (${P.ELIMINAR_ROLES}).`,
    );
    expect(mockPrisma.role.create).not.toHaveBeenCalled();
  });

  it('deja crear un rol con permisos que sí tiene', async () => {
    sesion('coord');

    const result = await createRole({
      name: 'Lectura',
      description: 'Solo consulta',
      color: '#336699',
      permissions: [P.VER_CASOS],
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(mockPrisma.role.create).toHaveBeenCalledTimes(1);
  });
});
