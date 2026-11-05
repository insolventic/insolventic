/**
 * Poner en la propia cuenta el correo de alguien de OTRO centro no puede dar
 * entrada a la cuenta de esa persona.
 *
 * `switchTenant` decide a quién entrar con una sola cosa: el correo que trae el
 * token. Y ese correo lo escribe `updateUser` sin comprobar que sea de quien lo
 * pone: con `P.EDITAR_USUARIOS` del centro A, alguien se pone el correo de un
 * usuario del centro B, refresca la sesión y pasa al centro B como esa persona.
 * Sin su clave, sin pasar por su buzón y sin que nada lo registre en B.
 *
 * Necesita Prisma REAL: la unicidad del correo es por centro, y eso es lo que
 * deja escribir el correo ajeno.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createRefreshToken } from '@/lib/auth';
import {
  authenticateUser,
  refreshAccessToken,
  switchTenant,
} from '@/features/auth/actions';
import { updateUser } from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `correo-ajeno-${Date.now().toString(36)}`;

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;

/** El éxito de `switchTenant` termina en `redirect`, que se señala lanzando. */
async function cambiarAlCentroB() {
  await switchTenant(centroB.tenantSlug).catch((error: { digest?: string }) => {
    if (!error.digest?.startsWith('NEXT_REDIRECT')) throw error;
  });
}

beforeAll(async () => {
  centroA = await crearTenantDePrueba(TAG, [P.EDITAR_USUARIOS]);
  centroB = await crearTenantDePrueba(`${TAG}-b`, [P.VER_TODOS_CASOS]);
});

afterAll(async () => {
  await purgeTenant(centroA.tenantId);
  await purgeTenant(centroB.tenantId);
  await prisma.$disconnect();
});

describe('switchTenant después de poner en la propia cuenta un correo ajeno', () => {
  it('no da entrada a la cuenta del otro centro', async () => {
    const victima = await prisma.user.findUniqueOrThrow({
      where: { id: centroB.userId },
      select: { email: true },
    });
    mockCookies.clear();
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
      email: victima.email,
    });
    expect(edicion.success).toBe(true);

    // Refrescar vuelve a leer la fila: el token nuevo ya trae el correo ajeno.
    const refresco = await refreshAccessToken();
    expect(refresco.success).toBe(true);

    await cambiarAlCentroB();

    const sesion = await authenticateUser();
    expect(sesion.user.id).not.toBe(centroB.userId);
    expect(sesion.user.id).toBe(centroA.userId);
  });
});
