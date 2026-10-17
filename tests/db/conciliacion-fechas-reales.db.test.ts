/**
 * Ciclo crear -> editar -> leer, contra Postgres REAL, para las 11 columnas
 * nuevas de `Case` que la tarea 2 de la auditoría del formulario de
 * conciliación (2026-10-12, C-1a + C-1c) agregó:
 *
 *   C-1a (fechas reales, DateTime): concFechaSolicitud, concFechaCitacion,
 *                                   concFechaDesistimiento
 *   C-1c (Aclaración de Acta):      concCampoConError, concDescripcionError,
 *                                   concValorIncorrecto, concValorCorrecto
 *   C-1c (referencias + desistimiento):
 *                                   concNumeroActaUnionRef,
 *                                   concNumeroTramiteUnionRef,
 *                                   concTipoSolicitanteDesistimiento,
 *                                   concApoderadoDesistimientoName
 *
 * POR QUÉ HACE FALTA PRISMA REAL (y no el mock): las 3 fechas son el motivo
 * concreto. `createCase`/`updateCase` extraen `concFecha*` de `rest` ANTES
 * del spread y las pasan por `parseDateOnly` (ver actions.ts) precisamente
 * porque el mecanismo genérico de `conc*`/`apoyo*` (PR #89) las dejaría viajar
 * como el string "YYYY-MM-DD" del `<input type="date">`, y Prisma rechaza eso
 * para una columna `DateTime` ("premature end of input. Expected ISO-8601
 * DateTime"). Un mock de Prisma no distingue "se guardó la fecha real" de
 * "el mock devolvió lo que le dijimos" — hace falta que la escritura
 * sobreviva un server real para demostrar que no rompe, y que lo que se lee
 * de vuelta es la fecha correcta.
 *
 * LO QUE AFIRMA, Y POR QUÉ EN ESE ORDEN (mismo patrón que
 * `conciliacion-formulario.db.test.ts`):
 *   1. Crear con los 11 en un valor A y leer: createCase los persiste.
 *   2. Editar los 11 a un valor B (distinto de A) y leer: updateCase los
 *      ACTUALIZA, no solo los acepta.
 *   3. Editar sin reenviarlos (payload solo con `{ id }` + un campo ajeno) y
 *      leer: no se borran por omisión.
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

const TAG = `concfechas-${Date.now().toString(36)}`;
const ctx = { tenantId: '', userId: '', debtorId: '', caseId: '' };

/** Las 3 fechas (string "YYYY-MM-DD", como manda el <input type="date">). */
const FECHAS_A = {
  concFechaSolicitud: '2026-01-15',
  concFechaCitacion: '2026-02-10',
  concFechaDesistimiento: '2026-03-05',
};
const FECHAS_B = {
  concFechaSolicitud: '2025-11-20',
  concFechaCitacion: '2025-12-02',
  concFechaDesistimiento: '2026-01-08',
};

/** Los 8 campos de texto. */
const TEXTOS_A = {
  concCampoConError: 'Nombre del convocado',
  concDescripcionError: 'Error de digitación en el nombre',
  concValorIncorrecto: 'Juan Perez',
  concValorCorrecto: 'Juan Pérez',
  concNumeroActaUnionRef: '045-2024',
  concNumeroTramiteUnionRef: 'T-2024-045',
  concTipoSolicitanteDesistimiento: 'la parte convocante',
  concApoderadoDesistimientoName: 'María Apoderada A',
};
const TEXTOS_B = {
  concCampoConError: 'Dirección del convocante',
  concDescripcionError: 'Dirección incompleta',
  concValorIncorrecto: 'Calle 10',
  concValorCorrecto: 'Calle 10 # 20-30',
  concNumeroActaUnionRef: '099-2025',
  concNumeroTramiteUnionRef: 'T-2025-099',
  concTipoSolicitanteDesistimiento: 'la parte convocada',
  concApoderadoDesistimientoName: 'Pedro Apoderado B',
};

const VALOR_A = { ...FECHAS_A, ...TEXTOS_A };
const VALOR_B = { ...FECHAS_B, ...TEXTOS_B };

const CAMPOS_FECHA = Object.keys(FECHAS_A) as (keyof typeof FECHAS_A)[];
const CAMPOS_TEXTO = Object.keys(TEXTOS_A) as (keyof typeof TEXTOS_A)[];

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
      concFechaSolicitud: true,
      concFechaCitacion: true,
      concFechaDesistimiento: true,
      concCampoConError: true,
      concDescripcionError: true,
      concValorIncorrecto: true,
      concValorCorrecto: true,
      concNumeroActaUnionRef: true,
      concNumeroTramiteUnionRef: true,
      concTipoSolicitanteDesistimiento: true,
      concApoderadoDesistimientoName: true,
    },
  });
}

/** "YYYY-MM-DD" desde un `Date` guardado por `parseDateOnly` (mediodía UTC). */
function soloFecha(valor: Date | null): string | null {
  return valor ? valor.toISOString().slice(0, 10) : null;
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

describe('formulario de conciliación — 11 columnas de C-1a/C-1c, ciclo crear → editar → leer (Postgres real)', () => {
  it('1. crear con los 11 campos en valor A: createCase los persiste', async () => {
    const result = await createCase(payloadConciliacion() as never);

    expect(result.success).toBe(true);
    expect(result.data?.id).toBeDefined();
    ctx.caseId = result.data!.id;

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS_FECHA) {
      expect(soloFecha(fila[campo])).toBe(FECHAS_A[campo]);
    }
    for (const campo of CAMPOS_TEXTO) {
      expect(fila[campo]).toBe(TEXTOS_A[campo]);
    }
  });

  it('2. editar los 11 a valor B: updateCase los actualiza, no solo los acepta', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      ...VALOR_B,
    } as never);

    expect(result.success).toBe(true);

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS_FECHA) {
      expect(soloFecha(fila[campo])).toBe(FECHAS_B[campo]);
      expect(soloFecha(fila[campo])).not.toBe(FECHAS_A[campo]);
    }
    for (const campo of CAMPOS_TEXTO) {
      expect(fila[campo]).toBe(TEXTOS_B[campo]);
      expect(fila[campo]).not.toBe(TEXTOS_A[campo]);
    }
  });

  it('3. editar sin reenviarlos: NO se borran por omisión (igual que pre-generation-form)', async () => {
    const result = await updateCase({
      id: ctx.caseId,
      // Un payload parcial real: solo toca un campo ajeno a los 11.
      concAsunto: 'Asunto actualizado, sin tocar los 11 campos bajo prueba',
    } as never);

    expect(result.success).toBe(true);

    const fila = await leerCaso(ctx.caseId);
    for (const campo of CAMPOS_FECHA) {
      // Siguen en B: una edición que no los envía no los toca.
      expect(soloFecha(fila[campo])).toBe(FECHAS_B[campo]);
    }
    for (const campo of CAMPOS_TEXTO) {
      expect(fila[campo]).toBe(TEXTOS_B[campo]);
    }
  });
});
