/**
 * Lo que `/users` entrega a sus componentes cliente no lleva la contraseña.
 *
 * Una prop de un componente cliente viaja serializada al navegador, así que
 * acá se mira eso: las props de `UsersContent`, tal como las arma la página. La
 * consulta está mockeada y devuelve la fila completa a propósito: el esquema de
 * salida tiene que aguantar aunque un `include` traiga la contraseña. Que la
 * consulta real no la pida lo fija `tests/db/usuarios-sin-password.db.test.ts`.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import React from 'react';

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  verifyToken: jest.fn().mockResolvedValue({ id: 'admin-1' }),
}));

import { P } from '@/lib/permissions';
import UsersPage from '@/app/users/page';
import { UsersContent } from '@/app/users/components/users-content';
import {
  createUserSchema,
  updateUserSchema,
  userSummarySchema,
} from '@/features/user/schemas';
import { mockCookies } from '../../__mocks__/next-headers';

const HASH = '$2b$10$hashQueNoDebeLlegarAlNavegador';
const ROL = {
  id: 'rol-1',
  name: 'Administrador',
  description: 'Administra',
  color: 'bg-gray-100',
  tenantId: 'tenant-1',
};
const FILA_USUARIO = {
  id: 'usuario-1',
  name: 'Natalia Ospina Restrepo',
  email: 'natalia@centroejemplo.test',
  lastLogin: null,
  professionalCard: '204417',
  phone: '3152240078',
  address: 'Avenida 19 # 104-37',
  createdDate: new Date('2026-01-15T12:00:00Z'),
  roleId: ROL.id,
  password: HASH,
  mustChangePassword: false,
  tokenVersion: 0,
  tenantId: ROL.tenantId,
};
const PERMISOS = [{ permission: { name: P.VER_USUARIOS } }];

/** Busca en el árbol que devuelve la página, sin renderizar componentes cliente. */
function buscarElemento(
  nodo: React.ReactNode,
  tipo: React.ElementType,
): React.ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarElemento(hijo, tipo);
      if (encontrado) return encontrado;
    }
    return undefined;
  }
  if (!React.isValidElement<Record<string, unknown>>(nodo)) return undefined;
  if (nodo.type === tipo) return nodo;
  return buscarElemento(nodo.props.children as React.ReactNode, tipo);
}

beforeEach(() => {
  resetAllMocks();
  mockCookies.setToken('access-token', 'token-de-prueba');
  mockAuthenticateUser.mockResolvedValue({
    user: { id: 'admin-1', permissions: [P.VER_USUARIOS, P.VER_ROLES] },
    tenantId: ROL.tenantId,
  });
  mockPrisma.user.findMany.mockResolvedValue([
    {
      ...FILA_USUARIO,
      role: { ...ROL, permissions: PERMISOS },
      assignedCases: [{ id: 'caso-1' }],
    },
  ]);
  mockPrisma.role.findMany.mockResolvedValue([
    { ...ROL, users: [FILA_USUARIO], permissions: PERMISOS },
  ]);
});

describe('/users — props de los componentes cliente', () => {
  it('ni los usuarios ni los usuarios de cada rol llevan la contraseña', async () => {
    const pagina = await UsersPage({ searchParams: Promise.resolve({}) });

    const contenido = buscarElemento(pagina, UsersContent);
    expect(contenido).toBeDefined();

    const { initialUsers, roles } = contenido!.props as {
      initialUsers: Array<{ id: string; assignedCases: unknown[] }>;
      roles: Array<{ users: Array<{ id: string }> }>;
    };
    // Sin esto, una lista vacía pasaría las comprobaciones de abajo.
    expect(initialUsers.map((u) => u.id)).toEqual(['usuario-1']);
    expect(initialUsers[0].assignedCases).toEqual([{ id: 'caso-1' }]);
    expect(roles[0].users.map((u) => u.id)).toEqual(['usuario-1']);

    const serializado = JSON.stringify(contenido!.props);
    expect(serializado).not.toContain(HASH);
    expect(serializado).not.toContain('"password"');
  });
});

describe('esquemas de usuario', () => {
  it('la salida es una lista cerrada: un campo nuevo no sale sin agregarlo aquí', () => {
    expect(Object.keys(userSummarySchema.shape).sort()).toEqual([
      'address',
      'createdDate',
      'email',
      'id',
      'lastLogin',
      'name',
      'phone',
      'professionalCard',
      'roleId',
    ]);
  });

  it('la entrada tampoco la lleva: ni editar ni crear aceptan contraseña', () => {
    expect(updateUserSchema.shape).not.toHaveProperty('password');
    expect(createUserSchema.shape).not.toHaveProperty('password');
  });
});
