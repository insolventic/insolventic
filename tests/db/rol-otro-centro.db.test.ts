/**
 * Un usuario no puede nacer con el rol de OTRO centro.
 *
 * `createUser` escribía `role: { connect: { id: roleId } }` sin comprobar el
 * tenant, y el `connect` de Prisma solo exige que el id exista: la action
 * devolvía `success` y el usuario quedaba en este centro con un rol ajeno.
 * `updateUser` ya lo validaba; es la misma clase de hueco que GC-M2 cerró para
 * el operador y `tests/db/deudor-otro-centro.db.test.ts` para el deudor.
 *
 * Necesita Prisma REAL: con el cliente mockeado el `connect` siempre "funciona"
 * y la pertenencia al tenant, que la impone la consulta, no se ve.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { emailService } from '@/lib/email';
import { createUser } from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `rol-cruzado-${Date.now().toString(36)}`;

let centroA: TenantDePrueba;
let centroB: TenantDePrueba;
let enviarActivacion: jest.SpyInstance;

function payload(roleId: string, sufijo: string) {
  return {
    name: 'Natalia Ospina Restrepo',
    email: `usuario-${sufijo}-${TAG}@centroejemplo.test`,
    professionalCard: '204417',
    phone: '3152240078',
    address: 'Avenida 19 # 104-37, Bogotá D.C.',
    roleId,
  };
}

/** Todo lo que una escritura colada dejaría en cualquiera de los dos centros. */
async function huella() {
  const [usuariosA, usuariosB, conRolAjeno, tokens, auditoria, notificaciones] =
    await Promise.all([
      prisma.user.count({ where: { tenantId: centroA.tenantId } }),
      prisma.user.count({ where: { tenantId: centroB.tenantId } }),
      prisma.user.count({ where: { roleId: centroB.roleId } }),
      prisma.passwordResetToken.count({
        where: { tenantId: centroA.tenantId },
      }),
      prisma.auditLog.count({ where: { tenantId: centroA.tenantId } }),
      prisma.notification.count({ where: { tenantId: centroA.tenantId } }),
    ]);

  return {
    usuariosA,
    usuariosB,
    conRolAjeno,
    tokens,
    auditoria,
    notificaciones,
  };
}

beforeAll(async () => {
  centroA = await crearTenantDePrueba(TAG, [P.CREAR_USUARIOS]);
  centroB = await crearTenantDePrueba(`${TAG}-b`, [P.CREAR_USUARIOS]);
  mockCookies.setToken('access-token', centroA.token);
});

beforeEach(() => {
  enviarActivacion = jest
    .spyOn(emailService, 'sendUserCreatedEmail')
    .mockResolvedValue(true);
});

afterEach(() => {
  enviarActivacion.mockRestore();
});

afterAll(async () => {
  await purgeTenant(centroA.tenantId);
  await purgeTenant(centroB.tenantId);
  await prisma.$disconnect();
});

describe('createUser con un roleId que no es de este centro', () => {
  it('rechaza el rol de otro centro sin crear el usuario ni avisarle', async () => {
    const antes = await huella();
    const entrada = payload(centroB.roleId, 'ajeno');

    const result = await createUser(entrada);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rol no encontrado');
    expect(await huella()).toEqual(antes);
    expect(await prisma.user.count({ where: { email: entrada.email } })).toBe(
      0,
    );
    expect(enviarActivacion).not.toHaveBeenCalled();
  });

  it('rechaza un id que no existe en ningún centro con el mismo mensaje', async () => {
    const antes = await huella();

    const result = await createUser(payload('id-que-no-existe', 'inexistente'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rol no encontrado');
    expect(await huella()).toEqual(antes);
    expect(enviarActivacion).not.toHaveBeenCalled();
  });

  // Control: sin él, los rechazos de arriba pasarían igual si createUser
  // estuviera fallando por cualquier otra razón.
  it('sigue aceptando un rol del propio centro', async () => {
    const entrada = payload(centroA.roleId, 'propio');

    const result = await createUser(entrada);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: {
        email_tenantId: { email: entrada.email, tenantId: centroA.tenantId },
      },
      select: { roleId: true, mustChangePassword: true },
    });
    expect(usuario.roleId).toBe(centroA.roleId);
    expect(usuario.mustChangePassword).toBe(true);
    expect(enviarActivacion).toHaveBeenCalledTimes(1);
  });
});
