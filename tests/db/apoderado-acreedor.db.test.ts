/**
 * El registro de apoderados del acreedor, contra Postgres REAL.
 *
 * POR QUÉ EXISTE. La decisión legal del 2026-10-09 (ítem 13 de
 * `docs/PENDIENTES_DECISION_LEGAL.md`, §6.6) es que el sistema **no elija** entre
 * el registro de poderes y el acta de la audiencia cuando se contradicen: tiene
 * que detectar la discrepancia y bloquear la generación. Para poder comparar dos
 * fuentes hay que poder guardarlas por separado, y hasta este PR no había dónde:
 * `Apoderado` es por caso y del convocante, y `Debt` no tenía el campo.
 *
 * Este es el **PR 1 de 4** del plan
 * (`docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md`) y es puramente aditivo: no
 * cambia ningún comportamiento existente. Lo que se fija acá son las dos
 * invariantes que el gate del PR 3 va a necesitar:
 *
 *  1. **Una fila por fuente, como máximo.** Si hubiera dos filas `REGISTRO` para
 *     el mismo acreedor, la comparación del gate sería ambigua y no habría forma
 *     de decidir cuál contrasta contra el acta.
 *  2. **Las filas mueren con su `Debt`.** Si un acreedor se saca del caso, su
 *     apoderado no puede quedar huérfano bloqueando generaciones futuras.
 *
 * POR QUÉ CONTRA POSTGRES REAL Y NO MOCKEADO. Las dos invariantes son del
 * motor, no del código: el `@@unique` y el `ON DELETE CASCADE` los hace la base.
 * Un test con Prisma mockeado las daría por buenas sin ejercitarlas — que es
 * exactamente cómo se rompió la creación de casos sin que ningún unitario lo
 * notara.
 */

import prisma from '@/lib/prisma';
import { createCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { mockCookies } from '../__mocks__/next-headers';
import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';
import { FIXTURES } from './helpers/casos-sinteticos';

const TAG = `apoderado-${Date.now().toString(36)}`;

const ctx = { tenantId: '', userId: '', debtId: '', caseId: '' };

/** Un apoderado de ejemplo; `fuente` la pone cada caso de prueba. */
function apoderado(fuente: string, overrides: Record<string, unknown> = {}) {
  return {
    debtId: ctx.debtId,
    tenantId: ctx.tenantId,
    fuente,
    nombreCompleto: 'María Gómez Rueda',
    tipoIdentificacion: 'CC',
    identificacion: '52.111.222',
    tarjetaProfesional: '123456',
    correo: 'maria@example.com',
    telefono: '3001112222',
    ...overrides,
  };
}

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG);
  ctx.tenantId = tenant.tenantId;
  ctx.userId = tenant.userId;
  mockCookies.setToken('access-token', tenant.token);

  // Un caso real con acreedores, por el mismo camino que usa el wizard: hace
  // falta un `Debt` que exista de verdad para poder probar la FK y el cascade.
  // Hacen falta DOS acreedores: uno para las invariantes y otro para probar que
  // la unicidad es por (debtId, fuente) y no por tenant. Se exige explícitamente
  // en vez de confiar en el orden de FIXTURES, así un reordenamiento futuro
  // falla con un mensaje claro en vez de con un `findFirstOrThrow` misterioso.
  const fixture = FIXTURES.find(
    (f) => ((f.form as { debts?: unknown[] }).debts?.length ?? 0) >= 2,
  );
  if (!fixture) {
    throw new Error(
      'este test necesita un fixture con al menos 2 acreedores y ninguno lo tiene',
    );
  }

  const debtor = await prisma.debtor.create({
    data: { ...fixture.debtor, tenantId: ctx.tenantId },
  });

  const parsed = createCaseFormSchema.parse({
    ...fixture.form,
    debtorId: debtor.id,
    operatorId: ctx.userId,
  }) as Record<string, unknown>;

  const result = await createCase(wizardSubmit(parsed) as never);
  if (!result.success || !result.data) {
    throw new Error(`createCase falló: ${result.error ?? 'sin error'}`);
  }
  ctx.caseId = result.data.id;

  const deuda = await prisma.debt.findFirstOrThrow({
    where: { caseId: ctx.caseId },
    select: { id: true },
  });
  ctx.debtId = deuda.id;
}, 120_000);

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('1. las dos fuentes se guardan por separado', () => {
  afterEach(async () => {
    await prisma.apoderadoAcreedor.deleteMany({
      where: { debtId: ctx.debtId },
    });
  });

  it('REGISTRO y ACTA conviven para el mismo acreedor', async () => {
    await prisma.apoderadoAcreedor.create({ data: apoderado('REGISTRO') });
    await prisma.apoderadoAcreedor.create({
      data: apoderado('ACTA', {
        nombreCompleto: 'Carlos Ruiz Peña',
        identificacion: '79.333.444',
      }),
    });

    const filas = await prisma.apoderadoAcreedor.findMany({
      where: { debtId: ctx.debtId },
      orderBy: { fuente: 'asc' },
    });

    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.fuente)).toEqual(['ACTA', 'REGISTRO']);
    // Las dos identificaciones distintas son, justamente, el caso que el PR 3
    // va a tener que detectar como contradicción.
    expect(filas[0].identificacion).toBe('79.333.444');
    expect(filas[1].identificacion).toBe('52.111.222');
  });

  it('los campos sobreviven el viaje a la base sin perderse', async () => {
    const creado = await prisma.apoderadoAcreedor.create({
      data: apoderado('REGISTRO'),
    });
    const leido = await prisma.apoderadoAcreedor.findUniqueOrThrow({
      where: { id: creado.id },
    });

    expect(leido.nombreCompleto).toBe('María Gómez Rueda');
    expect(leido.tipoIdentificacion).toBe('CC');
    // Se guarda TAL COMO lo escribió el operador: la normalización es del
    // comparador (PR 3), no del almacenamiento.
    expect(leido.identificacion).toBe('52.111.222');
    expect(leido.tarjetaProfesional).toBe('123456');
    expect(leido.correo).toBe('maria@example.com');
    expect(leido.telefono).toBe('3001112222');
    expect(leido.createdAt).toBeInstanceOf(Date);
  });
});

describe('2. INVARIANTE: una fila por fuente, como máximo', () => {
  afterEach(async () => {
    await prisma.apoderadoAcreedor.deleteMany({
      where: { debtId: ctx.debtId },
    });
  });

  it('la base rechaza una segunda fila de la misma fuente', async () => {
    await prisma.apoderadoAcreedor.create({ data: apoderado('REGISTRO') });

    // Lo rechaza el @@unique del motor, no una validación nuestra: por eso este
    // test tiene que correr contra Postgres y no con Prisma mockeado.
    await expect(
      prisma.apoderadoAcreedor.create({
        data: apoderado('REGISTRO', { nombreCompleto: 'Otra Persona' }),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(
      await prisma.apoderadoAcreedor.count({ where: { debtId: ctx.debtId } }),
    ).toBe(1);
  });

  it('el mismo apoderado sí puede estar en dos acreedores distintos', async () => {
    // La unicidad es (debtId, fuente), no (tenantId, fuente): un abogado puede
    // representar a varios acreedores en el mismo caso.
    const otra = await prisma.debt.findFirstOrThrow({
      where: { caseId: ctx.caseId, id: { not: ctx.debtId } },
      select: { id: true },
    });

    await prisma.apoderadoAcreedor.create({ data: apoderado('REGISTRO') });
    await prisma.apoderadoAcreedor.create({
      data: { ...apoderado('REGISTRO'), debtId: otra.id },
    });

    expect(
      await prisma.apoderadoAcreedor.count({
        where: { debtId: { in: [ctx.debtId, otra.id] } },
      }),
    ).toBe(2);

    await prisma.apoderadoAcreedor.deleteMany({ where: { debtId: otra.id } });
  });
});

describe('3. INVARIANTE: las filas mueren con su acreedor', () => {
  it('borrar el Debt cascadea sus apoderados', async () => {
    // Un Debt propio, para poder borrarlo sin tocar el del resto de los casos.
    const deuda = await prisma.debt.findFirstOrThrow({
      where: { caseId: ctx.caseId },
    });
    const efimera = await prisma.debt.create({
      data: {
        amount: deuda.amount,
        interestRate: deuda.interestRate,
        type: deuda.type,
        caseId: ctx.caseId,
        creditorId: deuda.creditorId,
        tenantId: ctx.tenantId,
      },
    });

    await prisma.apoderadoAcreedor.create({
      data: { ...apoderado('REGISTRO'), debtId: efimera.id },
    });
    expect(
      await prisma.apoderadoAcreedor.count({ where: { debtId: efimera.id } }),
    ).toBe(1);

    await prisma.debt.delete({ where: { id: efimera.id } });

    // Si esto fallara, un apoderado huérfano quedaría bloqueando generaciones
    // de un acreedor que ya no está en el caso.
    expect(
      await prisma.apoderadoAcreedor.count({ where: { debtId: efimera.id } }),
    ).toBe(0);
  });
});

describe('4. la confirmación vive en Debt y acepta null', () => {
  it('las cuatro columnas nuevas arrancan vacías y aceptan valores', async () => {
    const antes = await prisma.debt.findUniqueOrThrow({
      where: { id: ctx.debtId },
      select: {
        apoderadoConfirmadoFuente: true,
        apoderadoConfirmadoHuella: true,
        apoderadoConfirmadoPor: true,
        apoderadoConfirmadoAt: true,
      },
    });
    // Migración aditiva: las filas que ya existían quedan en null, sin bloquear
    // nada. Es lo que permite que el código viejo siga andando.
    expect(antes.apoderadoConfirmadoFuente).toBeNull();
    expect(antes.apoderadoConfirmadoHuella).toBeNull();
    expect(antes.apoderadoConfirmadoPor).toBeNull();
    expect(antes.apoderadoConfirmadoAt).toBeNull();

    const cuando = new Date('2026-10-10T15:00:00Z');
    await prisma.debt.update({
      where: { id: ctx.debtId },
      data: {
        apoderadoConfirmadoFuente: 'ACTA',
        apoderadoConfirmadoHuella: 'sha256:prueba',
        apoderadoConfirmadoPor: ctx.userId,
        apoderadoConfirmadoAt: cuando,
      },
    });

    const despues = await prisma.debt.findUniqueOrThrow({
      where: { id: ctx.debtId },
      select: {
        apoderadoConfirmadoFuente: true,
        apoderadoConfirmadoHuella: true,
        apoderadoConfirmadoPor: true,
        apoderadoConfirmadoAt: true,
      },
    });
    expect(despues.apoderadoConfirmadoFuente).toBe('ACTA');
    expect(despues.apoderadoConfirmadoHuella).toBe('sha256:prueba');
    expect(despues.apoderadoConfirmadoPor).toBe(ctx.userId);
    expect(despues.apoderadoConfirmadoAt?.toISOString()).toBe(
      cuando.toISOString(),
    );

    await prisma.debt.update({
      where: { id: ctx.debtId },
      data: {
        apoderadoConfirmadoFuente: null,
        apoderadoConfirmadoHuella: null,
        apoderadoConfirmadoPor: null,
        apoderadoConfirmadoAt: null,
      },
    });
  });
});
