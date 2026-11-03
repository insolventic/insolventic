/**
 * Avisos de expediente y visibilidad por fila, contra Postgres real.
 *
 * `createNotificationForAction` repartía los avisos de caso a TODOS los
 * usuarios del centro con `Ver casos`. Ese permiso lo tienen también los roles
 * acotados (Abogado y Asistente Legal a sus propios expedientes, Usuario a los
 * suyos como deudor), y el mensaje trae número de caso y nombre del deudor: un
 * aviso le contaba a un cliente que existía el expediente de otra persona, y
 * quién era. El listado y `getCaseById` ya aplicaban `case-access.ts`; el aviso
 * no.
 *
 * Por qué contra Postgres y no con mocks: lo que se verifica es QUIÉN queda con
 * una fila en `notifications`, y eso depende de la consulta real de roles,
 * permisos y deudores. Se recorren las cuatro acciones reales que avisan
 * (crear, editar, cambiar de fase, borrar). El borrado es el caso aparte: la
 * fila del expediente ya no existe cuando se arma el aviso.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/server', () => ({ after: jest.fn() }));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import {
  createCase,
  deleteCase,
  updateCase,
  updateCasePhase,
} from '@/features/case/actions';
import { assertCaseAccess } from '@/features/case/case-access';
import { createNotificationForAction } from '@/features/notification/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { mockCookies } from '../__mocks__/next-headers';
import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';
import { FIXTURES } from './helpers/casos-sinteticos';

const TAG = `avisos-visibilidad-${Date.now().toString(36)}`;
const FIXTURE = FIXTURES.find((f) => f.key === 'I2-insolvencia-minima')!;

const PERMISOS_ACTOR = [
  P.CREAR_CASOS,
  P.VER_CASOS,
  P.EDITAR_CASOS,
  P.ELIMINAR_CASOS,
  P.VER_TODOS_CASOS,
];

const correoCliente = `cliente-${TAG}@correo.test`;
const correoClienteAjeno = `cliente-ajeno-${TAG}@correo.test`;

const ctx = {
  tenantId: '',
  actorId: '',
  debtorId: '',
  usuarios: {} as Record<
    string,
    { id: string; email: string; permisos: string[] }
  >,
};

/** Crea rol + usuario con exactamente esos permisos, como los del seed. */
async function crearUsuario(
  nombre: string,
  permisos: string[],
  email?: string,
) {
  const role = await prisma.role.create({
    data: { name: `Rol ${nombre}`, description: TAG, tenantId: ctx.tenantId },
  });
  for (const name of permisos) {
    const permission = await prisma.permission.upsert({
      where: { name_tenantId: { name, tenantId: ctx.tenantId } },
      update: {},
      create: { name, category: 'casos', tenantId: ctx.tenantId },
    });
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        tenantId: ctx.tenantId,
      },
    });
  }
  const user = await prisma.user.create({
    data: {
      name: nombre,
      email: email ?? `${nombre}-${TAG}@centroejemplo.test`,
      professionalCard: '100200',
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      roleId: role.id,
      tenantId: ctx.tenantId,
    },
  });
  ctx.usuarios[nombre] = { id: user.id, email: user.email, permisos: permisos };
  return user;
}

/** Nombres de los usuarios que recibieron avisos que cumplen el filtro. */
async function destinatarios(where: {
  type: string;
  caseId?: string;
  message?: { contains: string };
}) {
  const filas = await prisma.notification.findMany({
    where: { tenantId: ctx.tenantId, ...where },
    select: { userId: true },
  });
  const porId = new Map(
    Object.entries(ctx.usuarios).map(([nombre, u]) => [u.id, nombre]),
  );
  return filas.map((f) => porId.get(f.userId) ?? f.userId).sort();
}

/**
 * `updateCasePhase` dispara el aviso sin `await`. `createMany` escribe todas
 * las filas de una, así que basta esperar a que aparezca la primera.
 */
async function esperarAviso(where: { type: string; caseId: string }) {
  for (let intento = 0; intento < 50; intento++) {
    const hay = await prisma.notification.count({
      where: { tenantId: ctx.tenantId, ...where },
    });
    if (hay > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('El aviso nunca llegó a la base');
}

async function crearCaso(operatorId: string, debtorId: string) {
  const parsed = createCaseFormSchema.parse({
    ...FIXTURE.form,
    debtorId,
    operatorId,
  }) as Record<string, unknown>;
  const result = await createCase(wizardSubmit(parsed) as never);
  if (!result.success || !result.data) {
    throw new Error(`No se pudo crear el caso de prueba: ${result.error}`);
  }
  return result.data;
}

// Quienes pueden ver un expediente de `abogado-asignado` y `cliente-dueno`.
const VEN_EL_CASO = [
  'abogado-asignado',
  'actor',
  'cliente-dueno',
  'operadora',
].sort();

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('avisos de expediente — solo a quien puede verlo (Postgres real)', () => {
  let caseId = '';
  let caseNumber = '';

  beforeAll(async () => {
    const tenant = await crearTenantDePrueba(TAG, PERMISOS_ACTOR);
    ctx.tenantId = tenant.tenantId;
    ctx.actorId = tenant.userId;
    mockCookies.setToken('access-token', tenant.token);
    ctx.usuarios.actor = {
      id: tenant.userId,
      email: `conciliadora-${TAG}@centroejemplo.test`,
      permisos: PERMISOS_ACTOR,
    };

    const deudor = await prisma.debtor.create({
      data: { ...FIXTURE.debtor, email: correoCliente, tenantId: ctx.tenantId },
    });
    ctx.debtorId = deudor.id;
    await prisma.debtor.create({
      data: {
        ...FIXTURE.debtor,
        idNumber: `${FIXTURE.debtor.idNumber}9`,
        email: correoClienteAjeno,
        tenantId: ctx.tenantId,
      },
    });

    const abogado = await crearUsuario('abogado-asignado', [
      P.VER_CASOS,
      P.VER_CASOS_PROPIOS,
    ]);
    await crearUsuario('abogado-ajeno', [P.VER_CASOS, P.VER_CASOS_PROPIOS]);
    await crearUsuario('operadora', [P.VER_CASOS, P.VER_TODOS_CASOS]);
    await crearUsuario(
      'cliente-dueno',
      [P.VER_CASOS, P.VER_CASOS_CLIENTE],
      correoCliente,
    );
    await crearUsuario(
      'cliente-ajeno',
      [P.VER_CASOS, P.VER_CASOS_CLIENTE],
      correoClienteAjeno,
    );
    // Rol de cliente cuyo correo no corresponde a ningún deudor.
    await crearUsuario('cliente-sin-deudor', [
      P.VER_CASOS,
      P.VER_CASOS_CLIENTE,
    ]);
    await crearUsuario('sin-alcance', [P.VER_CASOS]);
    // Tiene el alcance pero no el permiso de la pantalla: no entra a casos.
    await crearUsuario('sin-ver-casos', [P.VER_TODOS_CASOS]);

    const caso = await crearCaso(abogado.id, deudor.id);
    caseId = caso.id;
    caseNumber = caso.caseNumber;
  }, 120_000);

  it('crear: el aviso solo llega a quien puede ver el expediente', async () => {
    expect(await destinatarios({ type: 'case_created', caseId })).toEqual(
      VEN_EL_CASO,
    );
  });

  it('editar: el aviso solo llega a quien puede ver el expediente', async () => {
    const result = await updateCase({ id: caseId, city: 'Medellín' } as never);
    expect(result.error).toBeUndefined();

    expect(await destinatarios({ type: 'case_updated', caseId })).toEqual(
      VEN_EL_CASO,
    );
  });

  it('cambiar de fase: el aviso solo llega a quien puede ver el expediente', async () => {
    await prisma.notification.deleteMany({
      where: { tenantId: ctx.tenantId, type: 'case_updated', caseId },
    });

    const result = await updateCasePhase({ caseId, newPhase: 'Admisión' });
    expect(result.error).toBeUndefined();
    await esperarAviso({ type: 'case_updated', caseId });

    expect(await destinatarios({ type: 'case_updated', caseId })).toEqual(
      VEN_EL_CASO,
    );
  });

  it('los destinatarios coinciden con el guard de lectura, usuario por usuario', async () => {
    const recibieron = await destinatarios({ type: 'case_created', caseId });

    for (const [nombre, u] of Object.entries(ctx.usuarios)) {
      const pasaElGuard = await assertCaseAccess({
        caseId,
        user: { id: u.id, email: u.email, permissions: u.permisos },
        tenantId: ctx.tenantId,
      }).then(
        () => true,
        () => false,
      );
      const entraAPantalla = u.permisos.includes(P.VER_CASOS);

      expect({ nombre, recibio: recibieron.includes(nombre) }).toEqual({
        nombre,
        recibio: pasaElGuard && entraAPantalla,
      });
    }
  });

  it('reasignar: el aviso sigue al operador actual, no al anterior', async () => {
    const otro = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.usuarios['abogado-ajeno'].id },
    });
    const caso = await crearCaso(
      ctx.usuarios['abogado-asignado'].id,
      ctx.debtorId,
    );

    const result = await updateCase({
      id: caso.id,
      operatorId: otro.id,
    } as never);
    expect(result.error).toBeUndefined();

    const recibieron = await destinatarios({
      type: 'case_updated',
      caseId: caso.id,
    });
    expect(recibieron).toContain('abogado-ajeno');
    expect(recibieron).not.toContain('abogado-asignado');
  });

  it('sin expediente que consultar, el aviso de caso solo llega a quien ve todos', async () => {
    await createNotificationForAction(
      'case_updated',
      `${TAG}-sin-caso`,
      prisma,
      ctx.tenantId,
    );

    expect(
      await destinatarios({
        type: 'case_updated',
        message: { contains: `${TAG}-sin-caso` },
      }),
    ).toEqual(['actor', 'operadora']);
  });

  it('una lista explícita de destinatarios se respeta tal cual', async () => {
    await createNotificationForAction(
      'case_updated',
      `${TAG}-explicito`,
      prisma,
      ctx.tenantId,
      undefined,
      undefined,
      [ctx.usuarios['sin-alcance'].id],
    );

    expect(
      await destinatarios({
        type: 'case_updated',
        message: { contains: `${TAG}-explicito` },
      }),
    ).toEqual(['sin-alcance']);
  });

  // Va al final: destruye el expediente que usan los demás casos.
  it('borrar: el aviso llega a quien veía el expediente, aunque la fila ya no exista', async () => {
    const result = await deleteCase({
      id: caseId,
      confirmCaseNumber: caseNumber,
    });
    expect(result.error).toBeUndefined();

    expect(
      await destinatarios({
        type: 'case_deleted',
        message: { contains: caseNumber },
      }),
    ).toEqual(VEN_EL_CASO);
  });
});
