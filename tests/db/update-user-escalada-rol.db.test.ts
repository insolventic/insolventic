/**
 * `Editar usuarios` o `Editar roles` no pueden servir para subirse de rol.
 *
 * `updateUser` solo comprobaba que el rol fuera del centro. Como
 * `authenticateUser` lee los permisos de la base en cada request, cambiar el
 * `roleId` daba el rol nuevo de inmediato, sin volver a iniciar sesión. Quien
 * tenía un rol hecho a medida con `Editar usuarios` se ponía en Administrador,
 * o se lo ponía a otra cuenta; con `Editar roles`, se agregaba a su propio rol
 * los permisos que quisiera.
 *
 * En el seed solo el Administrador tiene esos permisos; el hueco se abre con
 * los roles a medida, que `Crear roles` y `Editar roles` permiten hacer. Las
 * reglas viven en `src/features/role/limites-de-permisos.ts`; la cobertura
 * caso por caso, con Prisma mockeado, en `tests/unit/users/limites-de-rol.test.ts`.
 *
 * Necesita Prisma REAL: los permisos efectivos salen de las filas de
 * `RolePermission`, y eso con el cliente mockeado no se ve.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAccessToken } from '@/lib/auth';
import { authenticateUser } from '@/features/auth/actions';
import { updateUser } from '@/features/user/actions';
import { updateRole } from '@/features/role/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `escalada-rol-${Date.now().toString(36)}`;

const PERMISOS_ADMIN = [
  P.VER_USUARIOS,
  P.CREAR_USUARIOS,
  P.EDITAR_USUARIOS,
  P.ELIMINAR_USUARIOS,
  P.VER_ROLES,
  P.CREAR_ROLES,
  P.EDITAR_ROLES,
  P.ELIMINAR_ROLES,
  P.VER_CASOS,
];

let centro: TenantDePrueba;
let rolCoordinacion: string;
let rolConsulta: string;
let coordinadora: { id: string; token: string };
let colega: string;

async function crearRol(nombre: string, permisos: string[]) {
  const rol = await prisma.role.create({
    data: { name: nombre, description: TAG, tenantId: centro.tenantId },
  });
  const filas = await prisma.permission.findMany({
    where: { tenantId: centro.tenantId, name: { in: permisos } },
  });
  await prisma.rolePermission.createMany({
    data: filas.map((p) => ({
      roleId: rol.id,
      permissionId: p.id,
      tenantId: centro.tenantId,
    })),
  });
  return rol.id;
}

async function crearUsuario(sufijo: string, roleId: string) {
  const usuario = await prisma.user.create({
    data: {
      name: `Usuario ${sufijo}`,
      email: `${sufijo}-${TAG}@centroejemplo.test`,
      professionalCard: '204417',
      phone: '3152240078',
      address: 'Avenida 19 # 104-37, Bogotá D.C.',
      roleId,
      tenantId: centro.tenantId,
    },
  });
  return usuario.id;
}

async function rolDe(userId: string) {
  const { roleId } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { roleId: true },
  });
  return roleId;
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, PERMISOS_ADMIN);
  rolCoordinacion = await crearRol('Coordinación', [
    P.VER_USUARIOS,
    P.EDITAR_USUARIOS,
    P.VER_CASOS,
  ]);
  rolConsulta = await crearRol('Consulta', [P.VER_CASOS]);

  const idCoordinadora = await crearUsuario('coordinadora', rolCoordinacion);
  coordinadora = {
    id: idCoordinadora,
    token: await createAccessToken({
      id: idCoordinadora,
      name: 'Usuario coordinadora',
      email: `coordinadora-${TAG}@centroejemplo.test`,
      roleId: rolCoordinacion,
      roleName: 'Coordinación',
      permissions: [P.VER_USUARIOS, P.EDITAR_USUARIOS, P.VER_CASOS],
      tenantId: centro.tenantSlug,
      tenantName: `Prueba ${TAG}`,
      lastLogin: new Date(),
    }),
  };
  colega = await crearUsuario('colega', rolConsulta);
});

beforeEach(async () => {
  mockCookies.setToken('access-token', coordinadora.token);
  await prisma.user.update({
    where: { id: coordinadora.id },
    data: { roleId: rolCoordinacion },
  });
  await prisma.user.update({
    where: { id: colega },
    data: { roleId: rolConsulta },
  });
});

afterAll(async () => {
  await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

describe('updateUser y el rol, editando alguien sin ser Administrador', () => {
  it('no deja ponerse a sí mismo el rol Administrador', async () => {
    const result = await updateUser({
      id: coordinadora.id,
      roleId: centro.roleId,
    });

    expect(result.success).toBe(false);
    expect(await rolDe(coordinadora.id)).toBe(rolCoordinacion);

    // Lo que importa de verdad: la misma sesión no ganó permisos.
    const { user } = await authenticateUser();
    expect(user.permissions).not.toContain(P.EDITAR_ROLES);
    expect(user.permissions).not.toContain(P.ELIMINAR_USUARIOS);
  });

  it('no deja ponerle a otra cuenta un rol con permisos que no tiene', async () => {
    const result = await updateUser({ id: colega, roleId: centro.roleId });

    expect(result.success).toBe(false);
    expect(await rolDe(colega)).toBe(rolConsulta);
  });

  it('no deja cambiarse a sí mismo el rol, tampoco hacia abajo', async () => {
    const result = await updateUser({
      id: coordinadora.id,
      roleId: rolConsulta,
    });

    expect(result.success).toBe(false);
    expect(await rolDe(coordinadora.id)).toBe(rolCoordinacion);
  });

  // Controles: el diálogo de edición manda siempre `roleId`, también cuando no
  // se tocó. Sin estos, los rechazos de arriba pasarían igual si la regla
  // tumbara cualquier edición.
  it('sigue dejando editar sus datos reenviando el mismo rol', async () => {
    const result = await updateUser({
      id: coordinadora.id,
      roleId: rolCoordinacion,
      phone: '3001112233',
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(await rolDe(coordinadora.id)).toBe(rolCoordinacion);
  });

  it('sigue dejando asignar a otro un rol cuyos permisos sí tiene', async () => {
    const hacia = await crearRol('Consulta de usuarios', [
      P.VER_USUARIOS,
      P.VER_CASOS,
    ]);

    const result = await updateUser({ id: colega, roleId: hacia });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(await rolDe(colega)).toBe(hacia);
  });
});

describe('updateRole y los permisos de administración', () => {
  async function permisosDelRol(roleId: string) {
    const filas = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { name: true } } },
    });
    return filas.map((f) => f.permission.name).sort();
  }

  it('no deja agregarse a su propio rol permisos que no tiene', async () => {
    const rolGestion = await crearRol('Gestión de roles', [
      P.VER_ROLES,
      P.EDITAR_ROLES,
      P.VER_CASOS,
    ]);
    const id = await crearUsuario('gestora', rolGestion);
    mockCookies.setToken(
      'access-token',
      await createAccessToken({
        id,
        name: 'Usuario gestora',
        email: `gestora-${TAG}@centroejemplo.test`,
        roleId: rolGestion,
        roleName: 'Gestión de roles',
        permissions: [P.VER_ROLES, P.EDITAR_ROLES, P.VER_CASOS],
        tenantId: centro.tenantSlug,
        tenantName: `Prueba ${TAG}`,
        lastLogin: new Date(),
      }),
    );

    const result = await updateRole({
      id: rolGestion,
      permissions: [
        P.VER_ROLES,
        P.EDITAR_ROLES,
        P.VER_CASOS,
        P.EDITAR_USUARIOS,
      ],
    });

    expect(result.success).toBe(false);
    expect(await permisosDelRol(rolGestion)).toEqual(
      [P.VER_ROLES, P.EDITAR_ROLES, P.VER_CASOS].sort(),
    );
    const { user } = await authenticateUser();
    expect(user.permissions).not.toContain(P.EDITAR_USUARIOS);
  });

  it('no deja al único administrador quitarle a su rol lo que lo hace administrar', async () => {
    mockCookies.setToken('access-token', centro.token);

    const result = await updateRole({
      id: centro.roleId,
      permissions: PERMISOS_ADMIN.filter((p) => p !== P.EDITAR_ROLES),
    });

    expect(result.success).toBe(false);
    expect(await permisosDelRol(centro.roleId)).toEqual(
      [...PERMISOS_ADMIN].sort(),
    );
  });

  it('sí le deja quitar a su rol un permiso que no es de administración', async () => {
    mockCookies.setToken('access-token', centro.token);

    const result = await updateRole({
      id: centro.roleId,
      permissions: PERMISOS_ADMIN.filter((p) => p !== P.VER_CASOS),
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(await permisosDelRol(centro.roleId)).not.toContain(P.VER_CASOS);
  });
});
