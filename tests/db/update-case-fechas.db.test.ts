/**
 * Editar un caso con `fechaCesacionPagos`, `propuestaFechaInicioPago` y
 * `fechaRadicacion`, contra Postgres REAL.
 *
 * Reporte de pruebas de funcionalidad (2026-11-05, pruebas 1.1 y 1.3): la
 * edición fallaba con "Invalid value for argument `fechaCesacionPagos`:
 * premature end of input. Expected ISO-8601 DateTime". `updateCase` dejaba
 * esas tres columnas en `...rest` y las mandaba a Prisma como el string del
 * formulario (`''` o `'YYYY-MM-DD'`).
 *
 * Hace falta Prisma real porque el rechazo es de Prisma: el mock acepta
 * cualquier cosa. El guardián con mock, que deriva la lista de columnas del
 * modelo, es `tests/unit/cases/update-case-fechas.test.ts`.
 *
 * LO QUE AFIRMA:
 *   1. Editar con las tres en 'YYYY-MM-DD': se guardan esas fechas.
 *   2. Editar con las tres en '' (lo que manda el diálogo cuando están
 *      vacías): la edición no falla y las fechas quedan como estaban, igual
 *      que las otras 16 fechas de `updateCase`.
 *   3. Editar sin mandarlas: no se borran.
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

const TAG = `updfechas-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '', caseId: '' };

const FECHAS = {
  fechaCesacionPagos: '2026-01-20',
  propuestaFechaInicioPago: '2026-12-01',
  fechaRadicacion: '2026-02-10',
};
const CAMPOS = Object.keys(FECHAS) as (keyof typeof FECHAS)[];

async function leerFechas(id: string) {
  const fila = await prisma.case.findUniqueOrThrow({
    where: { id },
    select: {
      fechaCesacionPagos: true,
      propuestaFechaInicioPago: true,
      fechaRadicacion: true,
      notificationCity: true,
    },
  });
  return {
    ...fila,
    fechas: Object.fromEntries(
      CAMPOS.map((c) => [
        c,
        fila[c] ? fila[c]!.toISOString().slice(0, 10) : null,
      ]),
    ),
  };
}

beforeEach(() => {
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

  // Una conciliación es el alta mínima que pasa las reglas del trámite; las
  // tres columnas son de `Case` y no dependen del tipo.
  const creado = await createCase(
    createCaseFormSchema.parse({
      debtorId: ctx.debtorId,
      operatorId: ctx.userId,
      type: 'CONCILIATION' as const,
      totalDebt: '0',
      creditors: 0,
      causes: [],
    }) as never,
  );
  if (!creado.success || !creado.data) {
    throw new Error(`No se pudo crear el caso de prueba: ${creado.error}`);
  }
  ctx.caseId = creado.data.id;
});

afterAll(async () => {
  if (ctx.tenantId) await purgeTenant(ctx.tenantId);
});

describe('updateCase — fechaCesacionPagos, propuestaFechaInicioPago y fechaRadicacion (Postgres real)', () => {
  it('1. con fecha "YYYY-MM-DD": la edición se guarda', async () => {
    const result = await updateCase({ id: ctx.caseId, ...FECHAS } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect((await leerFechas(ctx.caseId)).fechas).toEqual(FECHAS);
  });

  it('2. vacías (""): la edición no falla y las fechas quedan como estaban', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      fechaCesacionPagos: '',
      propuestaFechaInicioPago: '',
      fechaRadicacion: '',
      notificationCity: `vacias-${TAG}`,
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    const fila = await leerFechas(ctx.caseId);
    expect(fila.notificationCity).toBe(`vacias-${TAG}`);
    expect(fila.fechas).toEqual(FECHAS);
  });

  it('3. sin mandarlas: no se borran', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      notificationCity: `omitidas-${TAG}`,
    } as never);

    expect(result.success).toBe(true);
    const fila = await leerFechas(ctx.caseId);
    expect(fila.notificationCity).toBe(`omitidas-${TAG}`);
    expect(fila.fechas).toEqual(FECHAS);
  });
});
