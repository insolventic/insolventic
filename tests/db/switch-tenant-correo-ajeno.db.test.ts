/**
 * Poner en la propia cuenta el correo de alguien de OTRO centro no puede dar
 * entrada a la cuenta de esa persona.
 *
 * `switchTenant` decidía a quién entrar con una sola cosa: el correo que trae el
 * token. Y ese correo lo escribe `updateUser` sin comprobar que sea de quien lo
 * pone: con `P.EDITAR_USUARIOS` del centro A, alguien se ponía el correo de un
 * usuario del centro B, refrescaba la sesión y pasaba al centro B como esa
 * persona. Sin su clave, sin pasar por su buzón y sin que nada lo registrara en B.
 *
 * La action se eliminó: ninguna pantalla la llamaba. Cambiar de centro es salir
 * (`switchDatabase`) y entrar con la clave de la cuenta destino (`loginUser`).
 * El segundo bloque es el control de que esa vía sigue sirviendo a quien de
 * verdad tiene cuenta en ambos centros.
 *
 * Necesita Prisma REAL: la unicidad del correo es por centro, y eso es lo que
 * deja escribir el correo ajeno y tener la misma dirección en dos centros.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createRefreshToken } from '@/lib/auth';
import * as authActions from '@/features/auth/actions';
import { updateUser } from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const { authenticateUser, loginUser, refreshAccessToken, switchDatabase } =
  authActions;

const TAG = `correo-ajeno-${Date.now().toString(36)}`;
const CLAVE_A = 'clave-de-la-cuenta-en-A';
const CLAVE_B = 'clave-de-la-cuenta-en-B';

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;

/** `redirect` se señala lanzando: aquí solo interesa lo que dejó en las cookies. */
async function ignorarRedirect(accion: Promise<unknown>) {
  await accion.catch((error: { digest?: string }) => {
    if (!error.digest?.startsWith('NEXT_REDIRECT')) throw error;
  });
}

async function ponerClave(userId: string, clave: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(clave, 4) },
  });
}

async function correoDe(userId: string) {
  const { email } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  return email;
}

beforeAll(async () => {
  centroA = await crearTenantDePrueba(TAG, [P.EDITAR_USUARIOS]);
  centroB = await crearTenantDePrueba(`${TAG}-b`, [P.VER_TODOS_CASOS]);
  await ponerClave(centroA.userId, CLAVE_A);
  await ponerClave(centroB.userId, CLAVE_B);
});

afterAll(async () => {
  await purgeTenant(centroA.tenantId);
  await purgeTenant(centroB.tenantId);
  await prisma.$disconnect();
});

beforeEach(() => {
  mockCookies.clear();
});

describe('poner en la propia cuenta un correo ajeno', () => {
  it('no da entrada a la cuenta del otro centro', async () => {
    const correoOriginal = await correoDe(centroA.userId);
    const correoVictima = await correoDe(centroB.userId);
    mockCookies.setToken('access-token', centroA.token);
    mockCookies.setToken(
      'refresh-token',
      await createRefreshToken({
        userId: centroA.userId,
        tenantId: centroA.tenantSlug,
        tokenVersion: 0,
      }),
    );

    const edicion = await updateUser({
      id: centroA.userId,
      email: correoVictima,
    });
    expect(edicion.success).toBe(true);

    // Refrescar vuelve a leer la fila: el token nuevo ya trae el correo ajeno.
    const refresco = await refreshAccessToken();
    expect(refresco.success).toBe(true);

    // La entrada que había: si alguien la reintroduce con este nombre, este
    // ataque la vuelve a recorrer. Se llega por el índice para que el test
    // compile con la action eliminada.
    const { switchTenant } = authActions as unknown as {
      switchTenant?: (slug: string) => Promise<unknown>;
    };
    if (switchTenant) {
      await ignorarRedirect(switchTenant(centroB.tenantSlug));
    }

    const sesion = await authenticateUser();
    expect(sesion.user.id).not.toBe(centroB.userId);
    expect(sesion.user.id).toBe(centroA.userId);
    expect(switchTenant).toBeUndefined();

    // Tampoco por el login: en B, ese correo pide la clave de la cuenta de B.
    await ignorarRedirect(switchDatabase());
    const conClavePropia = await loginUser({
      email: correoVictima,
      password: CLAVE_A,
      tenantId: centroB.tenantSlug,
    });
    expect(conClavePropia.success).toBe(false);
    expect(mockCookies.get('access-token')).toBeUndefined();

    await prisma.user.update({
      where: { id: centroA.userId },
      data: { email: correoOriginal },
    });
  });
});

describe('quien de verdad tiene cuenta en ambos centros', () => {
  it('cambia de centro saliendo y entrando con la clave de la cuenta destino', async () => {
    const correoCompartido = `doble-cuenta-${TAG}@centroejemplo.test`;
    await prisma.user.update({
      where: { id: centroA.userId },
      data: { email: correoCompartido },
    });
    await prisma.user.update({
      where: { id: centroB.userId },
      data: { email: correoCompartido },
    });

    const enA = await loginUser({
      email: correoCompartido,
      password: CLAVE_A,
      tenantId: centroA.tenantSlug,
    });
    expect(enA.success).toBe(true);
    expect((await authenticateUser()).user.id).toBe(centroA.userId);

    // "Cambiar Organización" del menú: cierra la sesión y lleva al login.
    await ignorarRedirect(switchDatabase());
    expect(mockCookies.get('access-token')).toBeUndefined();

    const enB = await loginUser({
      email: correoCompartido,
      password: CLAVE_B,
      tenantId: centroB.tenantSlug,
    });
    expect(enB.success).toBe(true);

    const sesion = await authenticateUser();
    expect(sesion.user.id).toBe(centroB.userId);
    expect(sesion.tenantId).toBe(centroB.tenantId);
  });
});
