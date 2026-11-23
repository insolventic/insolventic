/**
 * Cambiar el correo de otro usuario tiene que dejar rastro.
 *
 * Con `Editar usuarios`, `updateUser` puede poner otra dirección en una cuenta
 * ajena, y `forgotPassword` manda el enlace de restablecimiento a esa dirección:
 * quien edita puede terminar entrando a la cuenta. Antes, la auditoría no decía
 * qué había cambiado y al correo anterior no le llegaba nada.
 *
 * El cambio NO se bloquea ni pide confirmación al buzón anterior. Corregir un
 * correo mal escrito es lo que permite recuperar la clave a quien perdió acceso
 * a ese buzón, y por eso esta suite también lo cubre.
 *
 * Necesita Prisma REAL: el aviso y la auditoría dependen de comparar contra la
 * fila anterior, y `resetPassword` busca al usuario por el correo del token.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/email';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { updateUser } from '@/features/user/actions';
import { forgotPassword, resetPassword } from '@/features/auth/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `cambio-correo-${Date.now().toString(36)}`;
const NOMBRE_EDITOR = 'Liliana Patricia Arango Mejía';

interface Correo {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Se espía `sendEmail` y no el método del aviso: así el test mira lo que de
// verdad saldría hacia cada dirección, y falla por la razón correcta si el
// aviso no existe.
const servicio = emailService as unknown as {
  sendEmail: (correo: Correo) => Promise<boolean>;
};

let centro: TenantDePrueba;
let otroCentro: TenantDePrueba;
let rolSinPermisos: string;
let enviar: jest.SpyInstance<Promise<boolean>, [Correo]>;
let contador = 0;

function correosA(direccion: string): Correo[] {
  return enviar.mock.calls
    .map(([correo]) => correo)
    .filter((c) => c.to === direccion);
}

async function crearUsuario(
  tenantId = centro.tenantId,
  roleId = rolSinPermisos,
) {
  contador += 1;
  return prisma.user.create({
    data: {
      name: 'Natalia Ospina Restrepo',
      email: `usuario-${contador}-${TAG}@centroejemplo.test`,
      professionalCard: '204417',
      phone: '3152240078',
      address: 'Avenida 19 # 104-37, Bogotá D.C.',
      roleId,
      tenantId,
    },
  });
}

/** Lo que manda el diálogo de edición: todos los campos en cada guardado. */
function formulario(
  usuario: Awaited<ReturnType<typeof crearUsuario>>,
  cambios: Record<string, unknown> = {},
) {
  return {
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    phone: usuario.phone,
    address: usuario.address,
    roleId: usuario.roleId,
    professionalCard: usuario.professionalCard,
    ...cambios,
  };
}

function auditoriaDe(id: string) {
  return prisma.auditLog.findMany({
    where: { entityId: id, entityType: 'user', action: 'updated' },
    select: { metadata: true },
  });
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [P.EDITAR_USUARIOS]);
  otroCentro = await crearTenantDePrueba(`${TAG}-b`, [P.EDITAR_USUARIOS]);
  mockCookies.setToken('access-token', centro.token);

  // Rol distinto de `Administrador`: a esos también les llega la notificación
  // de acción, y aquí se cuenta lo que recibe la cuenta editada.
  const rol = await prisma.role.create({
    data: { name: 'Consulta', description: TAG, tenantId: centro.tenantId },
  });
  rolSinPermisos = rol.id;
});

beforeEach(() => {
  _resetRateLimitStore();
  enviar = jest.spyOn(servicio, 'sendEmail').mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await purgeTenant(centro.tenantId);
  await purgeTenant(otroCentro.tenantId);
  await prisma.$disconnect();
});

describe('auditoría de updateUser', () => {
  it('registra el correo como campo cambiado, con las dos direcciones', async () => {
    const usuario = await crearUsuario();
    const nuevo = `nuevo-${usuario.id}@centroejemplo.test`;

    const result = await updateUser(formulario(usuario, { email: nuevo }));

    expect(result.error).toBeUndefined();
    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].metadata).toEqual({
      changedFields: 'email',
      previousEmail: usuario.email,
      newEmail: nuevo,
    });
  });

  it('deja ver adónde fue el correo si alguien lo cambia y después restaura el original', async () => {
    const usuario = await crearUsuario();
    const intruso = `intruso-${usuario.id}@centroejemplo.test`;

    await updateUser(formulario(usuario, { email: intruso }));
    await updateUser(formulario(usuario));

    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria.map((a) => a.metadata)).toEqual(
      expect.arrayContaining([
        {
          changedFields: 'email',
          previousEmail: usuario.email,
          newEmail: intruso,
        },
        {
          changedFields: 'email',
          previousEmail: intruso,
          newEmail: usuario.email,
        },
      ]),
    );
  });

  it('marca solo lo que cambió, aunque el formulario envíe todos los campos', async () => {
    const usuario = await crearUsuario();

    await updateUser(
      formulario(usuario, {
        phone: '3009998877',
        address: 'Carrera 7 # 32-16',
      }),
    );

    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria[0].metadata).toEqual({
      changedFields: 'address, phone',
    });
  });

  it('registra el cambio de rol', async () => {
    const usuario = await crearUsuario();

    await updateUser(formulario(usuario, { roleId: centro.roleId }));

    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria[0].metadata).toEqual({ changedFields: 'roleId' });
  });

  it('un guardado sin cambios no marca ningún campo', async () => {
    const usuario = await crearUsuario();

    await updateUser(formulario(usuario));

    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria[0].metadata).toEqual({ changedFields: '' });
  });
});

describe('aviso al correo anterior', () => {
  it('avisa a la dirección anterior con quién hizo el cambio, sin revelar la nueva', async () => {
    const usuario = await crearUsuario();
    const nuevo = `nuevo-${usuario.id}@centroejemplo.test`;

    const result = await updateUser(formulario(usuario, { email: nuevo }));

    expect(result.success).toBe(true);
    const avisos = correosA(usuario.email);
    expect(avisos).toHaveLength(1);
    const contenido = `${avisos[0].subject} ${avisos[0].html} ${avisos[0].text}`;
    expect(contenido).toContain(NOMBRE_EDITOR);
    expect(contenido).not.toContain(nuevo);
    expect(correosA(nuevo)).toHaveLength(0);
  });

  it('trata un cambio solo de mayúsculas como cambio, porque el acceso busca el correo exacto', async () => {
    const usuario = await crearUsuario();
    const nuevo = usuario.email.toUpperCase();

    await updateUser(formulario(usuario, { email: nuevo }));

    expect(correosA(usuario.email)).toHaveLength(1);
    const auditoria = await auditoriaDe(usuario.id);
    expect(auditoria[0].metadata).toEqual({
      changedFields: 'email',
      previousEmail: usuario.email,
      newEmail: nuevo,
    });
  });

  it('no avisa si el correo no cambió', async () => {
    const usuario = await crearUsuario();

    await updateUser(formulario(usuario, { phone: '3009998877' }));

    expect(correosA(usuario.email)).toHaveLength(0);
  });

  it('no avisa ni audita si el correo nuevo ya es de otro usuario', async () => {
    const usuario = await crearUsuario();
    const otro = await crearUsuario();

    const result = await updateUser(formulario(usuario, { email: otro.email }));

    expect(result.success).toBe(false);
    expect(correosA(usuario.email)).toHaveLength(0);
    expect(await auditoriaDe(usuario.id)).toHaveLength(0);
  });

  it('no toca, no avisa ni audita a un usuario de otro centro', async () => {
    const ajeno = await crearUsuario(otroCentro.tenantId, otroCentro.roleId);

    const result = await updateUser(
      // Con un rol de ESTE centro: con el del otro se rechazaría antes, por el
      // rol, sin llegar a buscar al usuario.
      formulario(ajeno, {
        email: `robado-${ajeno.id}@centroejemplo.test`,
        roleId: centro.roleId,
      }),
    );

    expect(result).toEqual({ success: false, error: 'Usuario no encontrado' });
    const fila = await prisma.user.findUniqueOrThrow({
      where: { id: ajeno.id },
      select: { email: true },
    });
    expect(fila.email).toBe(ajeno.email);
    expect(correosA(ajeno.email)).toHaveLength(0);
    expect(await auditoriaDe(ajeno.id)).toHaveLength(0);
  });
});

describe('si el aviso falla, la edición se mantiene', () => {
  async function cambiarCorreo() {
    const usuario = await crearUsuario();
    const nuevo = `nuevo-${usuario.id}@centroejemplo.test`;
    const result = await updateUser(formulario(usuario, { email: nuevo }));
    const fila = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { email: true },
    });
    return { usuario, nuevo, result, correoGuardado: fila.email };
  }

  it('cuando SMTP rechaza el envío', async () => {
    enviar.mockResolvedValue(false);

    const { usuario, nuevo, result, correoGuardado } = await cambiarCorreo();

    expect(result.success).toBe(true);
    expect(correoGuardado).toBe(nuevo);
    expect(correosA(usuario.email)).toHaveLength(1);
    expect(await auditoriaDe(usuario.id)).toHaveLength(1);
  });

  it('cuando el envío lanza un error, y deja constancia', async () => {
    enviar.mockRejectedValue(new Error('SMTP caído'));
    const registrarError = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => {});

    const { usuario, nuevo, result, correoGuardado } = await cambiarCorreo();

    expect(result.success).toBe(true);
    expect(correoGuardado).toBe(nuevo);
    expect(await auditoriaDe(usuario.id)).toHaveLength(1);
    expect(registrarError).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Error),
      expect.objectContaining({ action: 'update-user.aviso-correo' }),
    );
  });

  it('cuando SMTP se queda colgado: no espera más de lo acordado y deja constancia', async () => {
    enviar.mockImplementation(() => new Promise<boolean>(() => {}));
    const registrarAviso = jest
      .spyOn(logger, 'warn')
      .mockImplementation(() => {});

    const inicio = Date.now();
    const { usuario, nuevo, result, correoGuardado } = await cambiarCorreo();
    const duracion = Date.now() - inicio;

    expect(result.success).toBe(true);
    expect(correoGuardado).toBe(nuevo);
    expect(await auditoriaDe(usuario.id)).toHaveLength(1);
    expect(duracion).toBeLessThan(15_000);
    expect(registrarAviso).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ action: 'update-user.aviso-correo' }),
    );
  });
});

describe('corregir un correo mal escrito', () => {
  it('aplica de inmediato, deja sin efecto el enlace pendiente y la recuperación llega a la dirección corregida', async () => {
    const usuario = await crearUsuario();
    const corregido = `corregido-${usuario.id}@centroejemplo.test`;
    const tokenPendiente = `token-pendiente-${usuario.id}`;
    await prisma.passwordResetToken.create({
      data: {
        email: usuario.email,
        token: tokenPendiente,
        tenantId: centro.tenantId,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    // El buzón anterior no existe: el aviso falla y aun así se corrige.
    enviar.mockResolvedValue(false);
    const edicion = await updateUser(formulario(usuario, { email: corregido }));
    expect(edicion.success).toBe(true);
    enviar.mockClear();
    enviar.mockResolvedValue(true);

    const clave = 'Clave-Nueva-Segura-2026!';
    const conEnlaceViejo = await resetPassword({
      token: tokenPendiente,
      password: clave,
      confirmPassword: clave,
      tenantId: centro.tenantSlug,
    });
    expect(conEnlaceViejo.success).toBe(false);
    const fila = await prisma.user.findUniqueOrThrow({
      where: { id: usuario.id },
      select: { password: true },
    });
    expect(fila.password).toBeNull();

    const recuperacion = await forgotPassword({
      email: corregido,
      tenantId: centro.tenantSlug,
    });
    expect(recuperacion.success).toBe(true);
    const enlaces = correosA(corregido).filter((c) =>
      c.html.includes('/reset-password?token='),
    );
    expect(enlaces).toHaveLength(1);

    const conCorreoViejo = await forgotPassword({
      email: usuario.email,
      tenantId: centro.tenantSlug,
    });
    expect(conCorreoViejo.success).toBe(false);
    expect(correosA(usuario.email)).toHaveLength(0);
  });
});
