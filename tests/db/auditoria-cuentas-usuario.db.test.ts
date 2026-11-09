/**
 * Lo que le pasa a una cuenta de usuario queda en la auditoría, y queda antes
 * de que la acción responda.
 *
 * Dos huecos:
 *
 *  1. `createUser`, `deleteUser` y `revokeUserSessions` llamaban a
 *     `createAuditLog` sin `await`. En Vercel la función puede terminar al
 *     devolver la respuesta y matar el insert en vuelo (ver GC-M4 en
 *     `createAuditLog`).
 *  2. `resetPassword` y `changePassword` cambiaban la contraseña sin dejar
 *     ninguna entrada.
 *
 * Por qué se demora el registro: sin demora, el insert sin `await` suele ganarle
 * a la consulta del test y el hueco no se ve, o se ve solo a veces. Con la
 * demora, la fila no puede existir al volver la acción a menos que la acción la
 * haya esperado. El insert sigue siendo el real.
 *
 * Necesita Prisma REAL: las contraseñas se comparan contra la fila, y el fallo
 * de la última sección lo produce el propio Postgres.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

const DEMORA_DEL_REGISTRO_MS = 300;

jest.mock('@/features/audit-log/actions', () => {
  const real = jest.requireActual('@/features/audit-log/actions');
  return {
    ...real,
    createAuditLog: async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, DEMORA_DEL_REGISTRO_MS));
      return real.createAuditLog(...args);
    },
  };
});

import { randomUUID } from 'crypto';

import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { P } from '@/lib/permissions';
import { emailService } from '@/lib/email';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { changePassword, resetPassword } from '@/features/auth/actions';
import {
  createUser,
  deleteUser,
  revokeUserSessions,
} from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `auditoria-cuentas-${Date.now().toString(36)}`;
const CLAVE_ORIGINAL = 'Clave-Original-2026!';
const CLAVE_NUEVA = 'Clave-Nueva-2026!';
const SIN_AUDITORIA = 'sin_auditoria_de_prueba';

let centro: TenantDePrueba;
let consecutivo = 0;
let enviarCorreo: jest.SpyInstance;

async function crearUsuario() {
  consecutivo += 1;
  return prisma.user.create({
    data: {
      name: 'Natalia Ospina Restrepo',
      email: `natalia-${consecutivo}-${TAG}@centroejemplo.test`,
      professionalCard: '204417',
      phone: '3152240078',
      address: 'Avenida 19 # 104-37, Bogotá D.C.',
      password: await bcrypt.hash(CLAVE_ORIGINAL, 4),
      roleId: centro.roleId,
      tenantId: centro.tenantId,
    },
  });
}

function auditoriaDe(usuarioId: string) {
  return prisma.auditLog.findMany({
    where: {
      tenantId: centro.tenantId,
      entityType: 'user',
      entityId: usuarioId,
    },
  });
}

async function crearEnlaceDeRecuperacion(email: string) {
  const token = randomUUID();
  await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      tenantId: centro.tenantId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  return token;
}

function restablecer(token: string) {
  return resetPassword({
    token,
    password: CLAVE_NUEVA,
    confirmPassword: CLAVE_NUEVA,
    tenantId: centro.tenantSlug,
  });
}

function cambiarLaPropia() {
  return changePassword({
    currentPassword: CLAVE_ORIGINAL,
    newPassword: CLAVE_NUEVA,
    confirmPassword: CLAVE_NUEVA,
  });
}

async function devolverLaClaveDelAdministrador() {
  await prisma.user.update({
    where: { id: centro.userId },
    data: { password: await bcrypt.hash(CLAVE_ORIGINAL, 4), tokenVersion: 0 },
  });
}

/** Lo que el registro no puede contener, ni siquiera dentro de la descripción. */
async function esperarSinSecretos(
  registro: unknown,
  usuarioId: string,
  token?: string,
) {
  const texto = JSON.stringify(registro);
  const { password } = await prisma.user.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { password: true },
  });

  expect(texto).not.toContain(CLAVE_NUEVA);
  expect(texto).not.toContain(CLAVE_ORIGINAL);
  expect(texto).not.toContain(password!);
  if (token) expect(texto).not.toContain(token);
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [
    P.CREAR_USUARIOS,
    P.EDITAR_USUARIOS,
    P.ELIMINAR_USUARIOS,
  ]);
});

beforeEach(async () => {
  _resetRateLimitStore();
  mockCookies.clear();
  mockCookies.setToken('access-token', centro.token);
  enviarCorreo = jest
    .spyOn(
      emailService as unknown as { sendEmail: () => Promise<boolean> },
      'sendEmail',
    )
    .mockResolvedValue(true);
  await devolverLaClaveDelAdministrador();
});

afterEach(() => {
  enviarCorreo.mockRestore();
});

afterAll(async () => {
  // Con el código sin arreglar quedan registros demorados en vuelo: se les da
  // tiempo de terminar para que no choquen con el borrado del tenant.
  await new Promise((r) => setTimeout(r, DEMORA_DEL_REGISTRO_MS * 2));
  await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

// `updateUser` no está aquí: su llamada la mueve y la espera la rama
// `fix/update-user-aviso-cambio-correo`, que además le añade `changedFields`.
describe('las acciones sobre usuarios esperan el registro de auditoría', () => {
  it('createUser', async () => {
    const creado = await createUser({
      name: 'Julián Cárdenas Vega',
      email: `julian-${TAG}@centroejemplo.test`,
      professionalCard: '318822',
      phone: '3004417766',
      address: 'Carrera 7 # 71-21, Bogotá D.C.',
      roleId: centro.roleId,
    });
    expect(creado.error).toBeUndefined();

    const registros = await auditoriaDe(creado.data!.id);
    expect(registros.map((r) => r.action)).toEqual(['created']);
  });

  it('deleteUser', async () => {
    const usuario = await crearUsuario();

    const borrado = await deleteUser(usuario.id);
    expect(borrado.error).toBeUndefined();

    const registros = await auditoriaDe(usuario.id);
    expect(registros.map((r) => r.action)).toEqual(['deleted']);
  });

  it('revokeUserSessions', async () => {
    const usuario = await crearUsuario();

    const revocado = await revokeUserSessions(usuario.id);
    expect(revocado.error).toBeUndefined();

    const registros = await auditoriaDe(usuario.id);
    expect(registros.map((r) => r.action)).toEqual(['updated']);
  });
});

describe('cambiar la contraseña deja registro', () => {
  it('resetPassword: sin sesión, el actor es el dueño de la cuenta', async () => {
    const usuario = await crearUsuario();
    const token = await crearEnlaceDeRecuperacion(usuario.email);
    mockCookies.clear();

    const resultado = await restablecer(token);
    expect(resultado.success).toBe(true);

    const registros = await auditoriaDe(usuario.id);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      action: 'updated',
      entityName: usuario.name,
      userId: usuario.id,
      userName: usuario.name,
      userCedula: usuario.professionalCard,
      tenantId: centro.tenantId,
      metadata: {
        changedFields: 'password, mustChangePassword, tokenVersion',
        via: 'enlace por correo, sin sesión',
      },
    });
    await esperarSinSecretos(registros[0], usuario.id, token);
  });

  it('changePassword: el actor es quien tiene la sesión', async () => {
    const resultado = await cambiarLaPropia();
    expect(resultado.message).toBe('Contraseña cambiada exitosamente');

    const registros = await prisma.auditLog.findMany({
      where: {
        tenantId: centro.tenantId,
        entityType: 'user',
        entityId: centro.userId,
        metadata: { path: ['via'], equals: 'sesión propia' },
      },
    });
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      action: 'updated',
      userId: centro.userId,
      metadata: { changedFields: 'password, lastLogin, tokenVersion' },
    });
    await esperarSinSecretos(registros[0], centro.userId);
  });

  // Controles: un intento que no cambia nada no es un cambio de contraseña.
  it('un enlace inválido no deja registro', async () => {
    const usuario = await crearUsuario();

    const resultado = await restablecer(randomUUID());
    expect(resultado.success).toBe(false);

    expect(await auditoriaDe(usuario.id)).toEqual([]);
  });

  it('una contraseña actual equivocada no deja registro', async () => {
    const antes = await auditoriaDe(centro.userId);

    const resultado = await changePassword({
      currentPassword: 'No-Es-Esta-2026!',
      newPassword: CLAVE_NUEVA,
      confirmPassword: CLAVE_NUEVA,
    });
    expect(resultado.success).toBe(false);

    expect(await auditoriaDe(centro.userId)).toHaveLength(antes.length);
  });
});

describe('si Postgres rechaza el registro de auditoría', () => {
  let errorDelLogger: jest.SpyInstance;

  beforeEach(async () => {
    errorDelLogger = jest.spyOn(logger, 'error').mockImplementation(() => {});
    // NOT VALID: las filas de auditoría que ya existen no se revisan.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE audit_logs ADD CONSTRAINT ${SIN_AUDITORIA}
       CHECK ("tenantId" <> '${centro.tenantId}') NOT VALID`,
    );
  });

  afterEach(async () => {
    errorDelLogger.mockRestore();
    await prisma.$executeRawUnsafe(
      `ALTER TABLE audit_logs DROP CONSTRAINT ${SIN_AUDITORIA}`,
    );
  });

  function constanciaEnElLog() {
    return errorDelLogger.mock.calls.find(
      ([mensaje]) => mensaje === 'No se pudo escribir el registro de auditoría',
    )?.[2];
  }

  it('la contraseña se restablece igual y el log conserva quién y qué', async () => {
    const usuario = await crearUsuario();
    const token = await crearEnlaceDeRecuperacion(usuario.email);
    mockCookies.clear();

    const resultado = await restablecer(token);
    expect(resultado.success).toBe(true);

    const fila = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
    });
    expect(await bcrypt.compare(CLAVE_NUEVA, fila.password!)).toBe(true);
    expect(await auditoriaDe(usuario.id)).toEqual([]);

    expect(constanciaEnElLog()).toMatchObject({
      entityType: 'user',
      entityId: usuario.id,
      auditedAction: 'updated',
      userId: usuario.id,
      tenantId: centro.tenantId,
      changedFields: 'password, mustChangePassword, tokenVersion',
    });
  });

  it('el usuario se elimina igual y el log conserva quién lo eliminó', async () => {
    const usuario = await crearUsuario();

    const borrado = await deleteUser(usuario.id);
    expect(borrado.error).toBeUndefined();
    expect(borrado.success).toBe(true);

    expect(
      await prisma.user.findUnique({ where: { id: usuario.id } }),
    ).toBeNull();
    expect(constanciaEnElLog()).toMatchObject({
      entityId: usuario.id,
      auditedAction: 'deleted',
      userId: centro.userId,
      tenantId: centro.tenantId,
    });
  });
});
