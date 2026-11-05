/**
 * Un rol solo se enlaza a los permisos de SU centro.
 *
 * `Permission` es por centro (`@@unique([name, tenantId])`), así que el mismo
 * nombre existe una vez por cada centro. `createRole` y `updateRole` buscaban
 * `{ name: { in: permissions } }` sin `tenantId`: el rol quedaba enlazado a la
 * fila de cada centro que tuviera ese nombre, con dos efectos que se prueban
 * aquí: el permiso sale repetido al leer el rol, y un permiso que este centro
 * no tiene en su catálogo se concede igual por la fila del otro.
 *
 * Necesita Prisma REAL: con el cliente mockeado el `findMany` devuelve lo que el
 * test le diga, y el filtro que falta nunca se ve.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createRole, updateRole } from '@/features/role/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `rol-permisos-${Date.now().toString(36)}`;

/** Los dos centros tienen estos nombres en su catálogo, cada uno en su fila. */
const CATALOGO_COMUN = [
  P.CREAR_ROLES,
  P.EDITAR_ROLES,
  P.VER_ROLES,
  P.VER_CASOS,
];
/** Este nombre solo existe en el catálogo del centro B. */
const SOLO_EN_B = P.VER_REPORTES;

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;

function datosDeRol(sufijo: string, permissions: string[]) {
  return {
    name: `Rol ${sufijo} ${TAG}`,
    description: 'Rol de la prueba de permisos por centro',
    color: '#336699',
    permissions,
  };
}

async function crearRolSinPermisos(sufijo: string) {
  return prisma.role.create({
    data: {
      name: `Rol ${sufijo} ${TAG}`,
      description: 'Rol de la prueba de permisos por centro',
      color: '#336699',
      tenantId: centroA.tenantId,
    },
  });
}

/**
 * La consulta de detección que describe el PR, acotada a los dos centros de la
 * prueba. Vive aquí para que no se pueda despegar del esquema: si `Role`,
 * `RolePermission` o `Permission` cambian, esta suite falla.
 */
async function enlacesCruzados() {
  return prisma.$queryRaw<{ roleId: string; permiso: string }[]>`
    SELECT rp."roleId" AS "roleId", p."name" AS "permiso"
    FROM "RolePermission" rp
    JOIN "Role" r ON r."id" = rp."roleId"
    JOIN "Permission" p ON p."id" = rp."permissionId"
    WHERE p."tenantId" <> r."tenantId"
      AND r."tenantId" IN (${centroA.tenantId}, ${centroB.tenantId})
  `;
}

async function centrosDeLosPermisos(roleId: string) {
  const enlaces = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { name: true, tenantId: true } } },
  });
  return enlaces.map((e) => e.permission);
}

beforeAll(async () => {
  centroA = await crearTenantDePrueba(TAG, CATALOGO_COMUN);
  centroB = await crearTenantDePrueba(`${TAG}-b`, CATALOGO_COMUN);
  await prisma.permission.create({
    data: {
      name: SOLO_EN_B,
      category: 'reportes',
      tenantId: centroB.tenantId,
    },
  });
  mockCookies.setToken('access-token', centroA.token);
});

afterAll(async () => {
  await purgeTenant(centroA.tenantId);
  await purgeTenant(centroB.tenantId);
  await prisma.$disconnect();
});

describe('createRole', () => {
  it('enlaza el rol solo a las filas de permiso de su centro', async () => {
    const result = await createRole(
      datosDeRol('alta', [P.VER_CASOS, P.VER_ROLES]),
    );

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const enlaces = await centrosDeLosPermisos(result.data!.id);
    expect(enlaces).toHaveLength(2);
    expect(enlaces.every((p) => p.tenantId === centroA.tenantId)).toBe(true);
    expect(await enlacesCruzados()).toEqual([]);
  });

  it('devuelve cada permiso una sola vez aunque otro centro tenga el mismo nombre', async () => {
    const result = await createRole(
      datosDeRol('sin-repetidos', [P.VER_CASOS, P.VER_ROLES]),
    );

    expect([...result.data!.permissions].sort()).toEqual(
      [P.VER_CASOS, P.VER_ROLES].sort(),
    );
  });

  it('no concede un permiso que solo está en el catálogo de otro centro', async () => {
    const result = await createRole(
      datosDeRol('ajeno', [P.VER_CASOS, SOLO_EN_B]),
    );

    expect(result.data!.permissions).toEqual([P.VER_CASOS]);
    expect(
      (await centrosDeLosPermisos(result.data!.id)).map((p) => p.name),
    ).toEqual([P.VER_CASOS]);
  });
});

describe('updateRole', () => {
  it('reemplaza los permisos del rol solo con filas de su centro', async () => {
    const rol = await crearRolSinPermisos('edicion');

    const result = await updateRole({
      id: rol.id,
      permissions: [P.VER_CASOS, P.VER_ROLES],
    });

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect([...result.data!.permissions].sort()).toEqual(
      [P.VER_CASOS, P.VER_ROLES].sort(),
    );

    const enlaces = await centrosDeLosPermisos(rol.id);
    expect(enlaces).toHaveLength(2);
    expect(enlaces.every((p) => p.tenantId === centroA.tenantId)).toBe(true);
    expect(await enlacesCruzados()).toEqual([]);
  });

  it('no concede un permiso que solo está en el catálogo de otro centro', async () => {
    const rol = await crearRolSinPermisos('edicion-ajeno');

    const result = await updateRole({
      id: rol.id,
      permissions: [P.VER_CASOS, SOLO_EN_B],
    });

    expect(result.data!.permissions).toEqual([P.VER_CASOS]);
    expect((await centrosDeLosPermisos(rol.id)).map((p) => p.name)).toEqual([
      P.VER_CASOS,
    ]);
  });

  // Lo que el PR promete sobre las filas que ya estén cruzadas: el arreglo no
  // las toca, pero la siguiente edición de permisos de ese rol las reemplaza.
  it('al editar los permisos de un rol ya cruzado, quita el enlace ajeno', async () => {
    const rol = await crearRolSinPermisos('ya-cruzado');
    const permisoDeB = await prisma.permission.findUniqueOrThrow({
      where: {
        name_tenantId: { name: P.VER_CASOS, tenantId: centroB.tenantId },
      },
    });
    await prisma.rolePermission.create({
      data: {
        roleId: rol.id,
        permissionId: permisoDeB.id,
        tenantId: centroA.tenantId,
      },
    });
    expect(await enlacesCruzados()).toHaveLength(1);

    const result = await updateRole({
      id: rol.id,
      permissions: [P.VER_CASOS],
    });

    expect(result.data!.permissions).toEqual([P.VER_CASOS]);
    expect(await enlacesCruzados()).toEqual([]);
  });

  // Control: el rol del otro centro no se entera de nada de lo anterior.
  it('no cambia los enlaces del rol del otro centro', async () => {
    const enlaces = await centrosDeLosPermisos(centroB.roleId);

    expect(enlaces).toHaveLength(CATALOGO_COMUN.length);
    expect(enlaces.every((p) => p.tenantId === centroB.tenantId)).toBe(true);
  });
});
