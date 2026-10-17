/**
 * Ciclo crear -> editar -> leer, contra Postgres REAL, para los 8 campos de
 * conciliación que las tareas 2 (Zoom) y 3 (los 5 de C-2) de la auditoría del
 * formulario de conciliación (2026-10-12) agregaron al formulario:
 *
 *   Tarea 2 (Zoom):          zoomLink, zoomMeetingId, zoomPassword
 *   Tarea 3 (C-2):           concApoderadoConvocanteDireccion,
 *                            concApoderadoConvocanteCiudad,
 *                            concFechaNacimiento, concHoraProgramada,
 *                            concTipoConstanciaSolicitada
 *
 * POR QUÉ HACE FALTA PRISMA REAL Y NO EL MOCK. Un test unitario con Prisma
 * mockeado no puede distinguir "el campo se escribió" de "el mock devolvió lo
 * que le dijimos que devolviera" — demostraría que `createCase`/`updateCase`
 * LLAMAN a Prisma con esos campos, no que Prisma los acepta y los conserva.
 * Es el mismo motivo que `case-wizard.db.test.ts` y `persistencia-casos.db.test.ts`.
 *
 * LO QUE AFIRMA, Y POR QUÉ EN ESE ORDEN:
 *   1. Crear con los 8 en un valor A y leer: confirma que `createCase` los
 *      persiste (ya se sabía por la UI — esto lo comprueba en servidor).
 *   2. Editar los 8 a un valor B (distinto del A) y leer: confirma que
 *      `updateCase` los ACTUALIZA, no solo que los acepta. Son columnas sin
 *      prefijo (zoom*) y con prefijo (conc*) a propósito: las primeras pasan
 *      por `GENERAL_SCALAR_FIELDS`, las segundas por el mecanismo genérico de
 *      `conc*`/`apoyo*` (PR #89) — los dos caminos de persistencia que el
 *      formulario de edición usa.
 *   3. Editar SIN reenviar los 8 (payload solo con `{ id }` + un campo
 *      ajeno) y leer: confirma que NO se borran por omisión. Es el patrón
 *      exacto del hallazgo de `pre-generation-form` (`updateCase` con un
 *      payload parcial no debe tocar lo que no envía).
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import prisma from '@/lib/prisma';
import { createCase, updateCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';
import { crearTenantDePrueba, purgeTenant } from './helpers/tenant';

const TAG = `concform-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '', caseId: '' };

/** Los 8 campos bajo prueba, con un valor A y un valor B bien distintos. */
const VALOR_A = {
  zoomMeetingId: '111 2222 3333',
  zoomPassword: 'PASS-A',
  zoomLink: 'https://zoom.us/j/1112223333',
  concApoderadoConvocanteDireccion: 'Calle 10 # 20-30, Bogotá',
  concApoderadoConvocanteCiudad: 'Bogotá',
  concFechaNacimiento: '15 de marzo de 1990',
  concHoraProgramada: '09:00',
  concTipoConstanciaSolicitada: 'constancia de no acuerdo',
};

const VALOR_B = {
  zoomMeetingId: '444 5555 6666',
  zoomPassword: 'PASS-B',
  zoomLink: 'https://zoom.us/j/4445556666',
  concApoderadoConvocanteDireccion: 'Avenida 50 # 60-70, Medellín',
  concApoderadoConvocanteCiudad: 'Medellín',
  concFechaNacimiento: '3 de julio de 1985',
  concHoraProgramada: '14:30',
  concTipoConstanciaSolicitada: 'constancia de inasistencia',
};

const CAMPOS = Object.keys(VALOR_A) as (keyof typeof VALOR_A)[];

/** Lo que `createCaseFormSchema` necesita para una conciliación mínima. */
function payloadConciliacion(extra: Record<string, unknown> = {}) {
  return createCaseFormSchema.parse({
    debtorId: ctx.debtorId,
    operatorId: ctx.userId,
    type: 'CONCILIATION' as const,
    totalDebt: '0',
    creditors: 0,
    causes: [],
    ...VALOR_A,
    ...extra,
  }) as Record<string, unknown>;
}

async function leerCaso(id: string) {
  return prisma.case.findUniqueOrThrow({
    where: { id },
    select: {
      zoomMeetingId: true,
      zoomPassword: true,
      zoomLink: true,
      concApoderadoConvocanteDireccion: true,
      concApoderadoConvocanteCiudad: true,
      concFechaNacimiento: true,
      concHoraProgramada: true,
      concTipoConstanciaSolicitada: true,
    },
  });
}

beforeEach(() => {
  // GC-B2: el limitador de createCase es por proceso; esta suite crea más de
  // un caso.
  _resetRateLimitStore();
});

beforeAll(async () => {
  const tenant = await crearTenantDePrueba(TAG);
  ctx.tenantId = tenant.tenantId;
  ctx.userId = tenant.userId;
  mockCookies.setToken('access-token', tenant.token);

  const debtor = await prisma.debtor.create({
    data: {
      name: 'Pepita Pérez',
      idType: 'CC',
      idNumber: `${TAG}-cc`,
      email: `pepita-${TAG}@test.local`,
      phone: '3000000000',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
      department: 'Cundinamarca',
      occupation: 'Empleada',
      monthlyIncome: 2000000,
      totalDebt: 0,
      activeCases: 0,
      maritalStatus: 'Soltero(a)',
      tenantId: ctx.tenantId,
    },
  });
  ctx.debtorId = debtor.id;
});

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
});

describe('formulario de conciliación — Zoom + C-2, ciclo crear → editar → leer (Postgres real)', () => {
  it('1. crear con los 8 campos en valor A: createCase los persiste', async () => {
    const result = await createCase(payloadConciliacion() as never);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBeDefined();
    ctx.caseId = result.data!.id;

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS) {
      expect(fila[campo]).toBe(VALOR_A[campo]);
    }
  });

  it('2. editar los 8 a valor B: updateCase los actualiza, no solo los acepta', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      ...VALOR_B,
    } as never);

    expect(result.success).toBe(true);

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS) {
      expect(fila[campo]).toBe(VALOR_B[campo]);
      // Y que de verdad cambió respecto del valor A (no es que el mock, o un
      // default, coincidiera por accidente).
      expect(fila[campo]).not.toBe(VALOR_A[campo]);
    }
  });

  it('3. editar sin reenviarlos: NO se borran por omisión (igual que pre-generation-form)', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      // Un payload parcial real: solo toca un campo ajeno a los 8.
      concAsunto: 'Asunto actualizado, sin tocar los 8 campos bajo prueba',
    } as never);

    expect(result.success).toBe(true);

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS) {
      // Siguen en B: una edición que no los envía no los toca.
      expect(fila[campo]).toBe(VALOR_B[campo]);
    }
  });
});
