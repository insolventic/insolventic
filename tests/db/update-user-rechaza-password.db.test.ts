/**
 * `updateUser` no cambia contraseñas: una llamada con `password` devuelve error
 * y no toca nada.
 *
 * Era una vía de cambio de clave que la pantalla no usa (`edit-user-dialog.tsx`
 * no manda ese campo) y a la que se llegaba llamando directo a la server action
 * con `P.EDITAR_USUARIOS`: permitía fijarle la clave a otro usuario y entrar con
 * ella, sin política de contraseñas y sin cerrar las sesiones abiertas. Quedan
 * `changePassword`, que pide la clave actual, y `forgotPassword`, cuyo enlace
 * llega solo al correo del usuario.
 *
 * El error tiene que ser explícito: Zod descarta las claves que no conoce, así
 * que sin la comprobación la llamada devolvería `success` sin haber cambiado la
 * contraseña.
 *
 * Necesita Prisma REAL: lo que se afirma es lo que queda en la fila y que los
 * tokens se sigan aceptando al compararlos con ella.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAccessToken, createRefreshToken } from '@/lib/auth';
import { authenticateUser, refreshAccessToken } from '@/features/auth/actions';
import { updateUser } from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `sin-clave-update-${Date.now().toString(36)}`;
const CLAVE_ORIGINAL = 'clave-original-de-prueba';
const TELEFONO_ORIGINAL = '3156620418';
const TELEFONO_NUEVO = '3005550142';

let centro: TenantDePrueba;
let usuarioId: string;
let tokenDeAcceso: string;
let tokenDeRefresco: string;
let consecutivo = 0;

function entrarComoAdministrador() {
  mockCookies.setToken('access-token', centro.token);
}

function filaDelUsuario() {
  return prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { password: true, tokenVersion: true, phone: true },
  });
}

/** Lo que manda `edit-user-dialog.tsx`: los campos de su formulario, sin clave. */
async function datosDelFormulario() {
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
  });
  return {
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    phone: TELEFONO_NUEVO,
    address: usuario.address,
    roleId: usuario.roleId,
    professionalCard: usuario.professionalCard,
  };
}

async function expectSesionesVigentes() {
  mockCookies.setToken('access-token', tokenDeAcceso);
  await expect(authenticateUser()).resolves.toMatchObject({
    user: { id: usuarioId },
  });

  mockCookies.setToken('refresh-token', tokenDeRefresco);
  await expect(refreshAccessToken()).resolves.toMatchObject({ success: true });
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [P.EDITAR_USUARIOS]);
});

afterAll(async () => {
  if (centro) await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

beforeEach(async () => {
  consecutivo += 1;
  const usuario = await prisma.user.create({
    data: {
      name: 'Natalia Ospina Restrepo',
      email: `usuaria-${consecutivo}-${TAG}@centroejemplo.test`,
      professionalCard: '204417',
      phone: TELEFONO_ORIGINAL,
      address: 'Carrera 43A # 18-55, Medellín',
      password: await bcrypt.hash(CLAVE_ORIGINAL, 4),
      roleId: centro.roleId,
      tenantId: centro.tenantId,
    },
  });
  usuarioId = usuario.id;

  tokenDeAcceso = await createAccessToken({
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    roleId: centro.roleId,
    roleName: 'Administrador',
    permissions: [P.EDITAR_USUARIOS],
    tenantId: centro.tenantSlug,
    tenantName: `Prueba ${TAG}`,
    lastLogin: new Date(),
    tokenVersion: usuario.tokenVersion,
  });
  tokenDeRefresco = await createRefreshToken({
    userId: usuario.id,
    tenantId: centro.tenantSlug,
    tokenVersion: usuario.tokenVersion,
  });

  entrarComoAdministrador();
});

describe('updateUser con password', () => {
  it.each([
    ['una clave', 'clave-nueva-de-prueba'],
    ['una cadena vacía', ''],
    ['null', null],
  ])(
    'con %s devuelve error y deja intactos la clave, la fila y las sesiones',
    async (_caso, password) => {
      const antes = await filaDelUsuario();

      const result = await updateUser({
        ...(await datosDelFormulario()),
        password,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/contraseña/i);

      const despues = await filaDelUsuario();
      expect(despues).toEqual(antes);
      expect(despues.phone).toBe(TELEFONO_ORIGINAL);
      await expect(
        bcrypt.compare(CLAVE_ORIGINAL, despues.password!),
      ).resolves.toBe(true);

      await expectSesionesVigentes();
    },
  );
});

describe('updateUser sin password', () => {
  it('con los campos del formulario guarda y no cierra sesiones', async () => {
    const antes = await filaDelUsuario();

    const result = await updateUser(await datosDelFormulario());

    expect(result.success).toBe(true);
    await expect(filaDelUsuario()).resolves.toEqual({
      ...antes,
      phone: TELEFONO_NUEVO,
    });
    await expectSesionesVigentes();
  });

  it('otro campo de más se sigue descartando: el esquema no se volvió estricto', async () => {
    const result = await updateUser({
      ...(await datosDelFormulario()),
      campoQueNoExiste: 'valor',
    });

    expect(result.success).toBe(true);
    await expect(filaDelUsuario()).resolves.toMatchObject({
      phone: TELEFONO_NUEVO,
    });
  });

  it('una clave con valor undefined cuenta como no enviada', async () => {
    const result = await updateUser({
      ...(await datosDelFormulario()),
      password: undefined,
    });

    expect(result.success).toBe(true);
  });
});
