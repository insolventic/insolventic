/**
 * El hash de contraseña no sale del servidor.
 *
 * `userSchema` declaraba `password` y `getAllUsers` lo pasaba tal cual desde la
 * fila de Prisma, así que `/users` lo recibía en `data`. `userSummarySchema`,
 * derivado de ese esquema, lo arrastraba a `getAllRoles` y a lo que devuelven
 * `updateUser` y `updateProfile`.
 *
 * Necesita Prisma REAL: con el cliente mockeado la fila que devuelve la consulta
 * la escribe el propio test, y un `select` sin `password` no se notaría.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { getAllRoles } from '@/features/role/actions';
import {
  getAllUsers,
  updateProfile,
  updateUser,
} from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `sin-password-${Date.now().toString(36)}`;
const HASH_ADMIN =
  '$2b$10$hashDelAdministradorQueNoDebeSalirDelServidor000000000';
const HASH_OTRO =
  '$2b$10$hashDelOtroUsuarioQueNoDebeSalirDelServidor0000000000';

let centro: TenantDePrueba;
let otroUsuarioId: string;

function datosDeEdicion(id: string) {
  return {
    id,
    name: 'Natalia Ospina Restrepo',
    email: `otro-${TAG}@centroejemplo.test`,
    professionalCard: '204417',
    phone: '3152240078',
    address: 'Avenida 19 # 104-37, Bogotá D.C.',
  };
}

async function hashGuardado(id: string) {
  const fila = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { password: true },
  });
  return fila.password;
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [
    P.VER_USUARIOS,
    P.VER_ROLES,
    P.EDITAR_USUARIOS,
  ]);
  await prisma.user.update({
    where: { id: centro.userId },
    data: { password: HASH_ADMIN },
  });
  const otro = await prisma.user.create({
    data: {
      ...datosDeEdicion(''),
      id: undefined,
      password: HASH_OTRO,
      mustChangePassword: true,
      roleId: centro.roleId,
      tenantId: centro.tenantId,
    },
  });
  otroUsuarioId = otro.id;
  mockCookies.setToken('access-token', centro.token);
});

afterAll(async () => {
  await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

describe('getAllUsers', () => {
  it('no devuelve la contraseña de ningún usuario, aunque la base sí la tenga', async () => {
    await expect(hashGuardado(otroUsuarioId)).resolves.toBe(HASH_OTRO);

    const result = await getAllUsers();

    expect(result.success).toBe(true);
    expect(result.data?.map((u) => u.id).sort()).toEqual(
      [centro.userId, otroUsuarioId].sort(),
    );
    for (const usuario of result.data!) {
      expect(usuario).not.toHaveProperty('password');
    }
    const serializado = JSON.stringify(result.data);
    expect(serializado).not.toContain(HASH_ADMIN);
    expect(serializado).not.toContain(HASH_OTRO);
  });

  it('sigue devolviendo lo que usa la pantalla de usuarios', async () => {
    const result = await getAllUsers();

    const otro = result.data!.find((u) => u.id === otroUsuarioId)!;
    expect(otro).toEqual(
      expect.objectContaining({
        name: 'Natalia Ospina Restrepo',
        email: `otro-${TAG}@centroejemplo.test`,
        professionalCard: '204417',
        phone: '3152240078',
        address: 'Avenida 19 # 104-37, Bogotá D.C.',
        roleId: centro.roleId,
        lastLogin: null,
        createdDate: expect.any(Date),
        assignedCases: [],
      }),
    );
    expect(otro.role.name).toBe('Administrador');
    expect(otro.role.permissions.sort()).toEqual(
      [P.VER_USUARIOS, P.VER_ROLES, P.EDITAR_USUARIOS].sort(),
    );
  });
});

describe('lo que se deriva del resumen de usuario', () => {
  it('getAllRoles no entrega la contraseña de los usuarios de cada rol', async () => {
    const result = await getAllRoles();

    expect(result.success).toBe(true);
    const usuarios = result.data!.flatMap((rol) => rol.users);
    expect(usuarios.length).toBe(2);
    for (const usuario of usuarios) {
      expect(usuario).not.toHaveProperty('password');
    }
    expect(JSON.stringify(result.data)).not.toContain(HASH_OTRO);
  });

  it('updateProfile no la devuelve y tampoco la cambia', async () => {
    const result = await updateProfile({
      name: 'Liliana Patricia Arango Mejía',
      phone: '3178899001',
      address: 'Calle 72 # 10-34 Oficina 801, Bogotá D.C.',
      professionalCard: '155820',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('password');
    await expect(hashGuardado(centro.userId)).resolves.toBe(HASH_ADMIN);
  });
});

describe('updateUser conserva su comportamiento', () => {
  it('sin contraseña en el payload no la toca, y no la devuelve', async () => {
    const result = await updateUser(datosDeEdicion(otroUsuarioId));

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('password');
    await expect(hashGuardado(otroUsuarioId)).resolves.toBe(HASH_OTRO);
  });

  it('con contraseña en el payload la guarda hasheada, y no la devuelve', async () => {
    const result = await updateUser({
      ...datosDeEdicion(otroUsuarioId),
      password: 'clave-nueva-de-prueba',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('password');
    const guardado = await hashGuardado(otroUsuarioId);
    expect(guardado).not.toBe('clave-nueva-de-prueba');
    await expect(
      bcrypt.compare('clave-nueva-de-prueba', guardado!),
    ).resolves.toBe(true);
  });
});
