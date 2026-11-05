/**
 * Cambiar el correo de otro usuario tiene que dejar rastro.
 *
 * Con `P.EDITAR_USUARIOS`, `updateUser` cambia el correo de cualquier usuario
 * del centro, y `forgotPassword` manda el enlace de restablecimiento al correo
 * que esté en la fila. Por eso quien edita puede poner un correo suyo, pedir el
 * enlace y entrar a la cuenta ajena: después, todo lo que haga queda en la
 * auditoría a nombre de la otra persona.
 *
 * Esa misma cadena es la que un administrador necesita cuando corrige un correo
 * mal escrito o el usuario perdió su buzón, así que no se prohíbe: la primera
 * prueba la fija como comportamiento válido. Lo que se exige es que no pase en
 * silencio.
 *
 * Necesita Prisma REAL: el enlace se busca por `email_tenantId` y la cadena solo
 * se ve completa si el token, la fila y el inicio de sesión son los de verdad.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

import bcrypt from 'bcrypt';

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { emailService } from '@/lib/email';
import {
  authenticateUser,
  forgotPassword,
  loginUser,
  resetPassword,
} from '@/features/auth/actions';
import { updateUser } from '@/features/user/actions';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  type TenantDePrueba,
} from './helpers/tenant';

const TAG = `cambio-correo-${Date.now().toString(36)}`;
const CLAVE_NUEVA = 'Clave-Nueva-2026!';

let centro: TenantDePrueba;
// No se llama `Administrador`: a ese rol le llega el aviso genérico de cada
// edición, y ese correo se confundiría con los que se comprueban aquí.
let rolOperadora: string;
let consecutivo = 0;
let enviarCorreo: jest.SpyInstance;

interface CorreoEnviado {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function correosEnviados(): CorreoEnviado[] {
  return enviarCorreo.mock.calls.map(([correo]) => correo as CorreoEnviado);
}

async function crearUsuario() {
  consecutivo += 1;
  return prisma.user.create({
    data: {
      name: 'Natalia Ospina Restrepo',
      email: `natalia-${consecutivo}-${TAG}@centroejemplo.test`,
      professionalCard: '204417',
      phone: '3152240078',
      address: 'Avenida 19 # 104-37, Bogotá D.C.',
      password: await bcrypt.hash('Clave-Original-2026!', 4),
      roleId: rolOperadora,
      tenantId: centro.tenantId,
    },
  });
}

/** Lo que manda `edit-user-dialog.tsx`: todos los campos de su formulario. */
function formularioDeEdicion(
  usuario: Awaited<ReturnType<typeof crearUsuario>>,
  cambios: { email?: string; phone?: string } = {},
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

function auditoriaDe(usuarioId: string) {
  return prisma.auditLog.findMany({
    where: {
      tenantId: centro.tenantId,
      entityType: 'user',
      entityId: usuarioId,
      action: 'updated',
    },
  });
}

beforeAll(async () => {
  centro = await crearTenantDePrueba(TAG, [P.EDITAR_USUARIOS]);
  const rol = await prisma.role.create({
    data: {
      name: 'Operadora de Insolvencia',
      description: TAG,
      tenantId: centro.tenantId,
    },
  });
  rolOperadora = rol.id;
});

beforeEach(() => {
  mockCookies.clear();
  mockCookies.setToken('access-token', centro.token);
  enviarCorreo = jest
    .spyOn(
      emailService as unknown as {
        sendEmail: (correo: CorreoEnviado) => Promise<boolean>;
      },
      'sendEmail',
    )
    .mockResolvedValue(true);
});

afterEach(() => {
  enviarCorreo.mockRestore();
});

afterAll(async () => {
  await purgeTenant(centro.tenantId);
  await prisma.$disconnect();
});

describe('updateUser cuando cambia el correo de otro usuario', () => {
  // Es el caso legítimo: corregir el correo es lo que permite recuperar la clave.
  it('el enlace de restablecimiento llega al correo nuevo y da entrada a la cuenta', async () => {
    const usuario = await crearUsuario();
    const correoNuevo = `corregido-${TAG}@centroejemplo.test`;

    const edicion = await updateUser(
      formularioDeEdicion(usuario, { email: correoNuevo }),
    );
    expect(edicion.error).toBeUndefined();
    expect(edicion.success).toBe(true);

    const pedido = await forgotPassword({
      email: correoNuevo,
      tenantId: centro.tenantSlug,
    });
    expect(pedido.success).toBe(true);

    const enlace = correosEnviados().find((c) => c.to === correoNuevo);
    const token = enlace?.html.match(/token=([0-9a-f-]+)/)?.[1];
    expect(token).toBeDefined();

    const restablecida = await resetPassword({
      token,
      password: CLAVE_NUEVA,
      confirmPassword: CLAVE_NUEVA,
      tenantId: centro.tenantSlug,
    });
    expect(restablecida.success).toBe(true);

    mockCookies.clear();
    const ingreso = await loginUser({
      email: correoNuevo,
      password: CLAVE_NUEVA,
      tenantId: centro.tenantSlug,
    });
    expect(ingreso.success).toBe(true);

    const sesion = await authenticateUser();
    expect(sesion.user.id).toBe(usuario.id);
  });

  it('la auditoría dice que cambió el correo', async () => {
    const usuario = await crearUsuario();

    const edicion = await updateUser(
      formularioDeEdicion(usuario, {
        email: `otro-${TAG}@centroejemplo.test`,
      }),
    );
    expect(edicion.success).toBe(true);

    const [registro] = await auditoriaDe(usuario.id);
    expect(registro?.metadata).toEqual(
      expect.objectContaining({
        changedFields: expect.stringContaining('email'),
      }),
    );
  });

  it('avisa al correo anterior', async () => {
    const usuario = await crearUsuario();

    const edicion = await updateUser(
      formularioDeEdicion(usuario, {
        email: `otro-mas-${TAG}@centroejemplo.test`,
      }),
    );
    expect(edicion.success).toBe(true);

    expect(correosEnviados().map((c) => c.to)).toContain(usuario.email);
  });

  // Control: el formulario siempre manda el correo, aunque nadie lo haya tocado.
  it('guardar otros datos con el mismo correo no avisa ni lo registra como cambio', async () => {
    const usuario = await crearUsuario();

    const edicion = await updateUser(
      formularioDeEdicion(usuario, { phone: '3005550142' }),
    );
    expect(edicion.success).toBe(true);

    expect(correosEnviados().map((c) => c.to)).not.toContain(usuario.email);
    const registros = await auditoriaDe(usuario.id);
    expect(JSON.stringify(registros.map((r) => r.metadata))).not.toContain(
      'email',
    );
  });
});
