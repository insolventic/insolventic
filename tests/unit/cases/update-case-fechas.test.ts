/**
 * `updateCase` convierte TODA columna `DateTime` de `Case` antes de escribirla.
 *
 * Hallazgo del reporte de pruebas de funcionalidad (2026-11-05, pruebas 1.1 y
 * 1.3): editar un caso respondía "Invalid value for argument
 * `fechaCesacionPagos`: premature end of input. Expected ISO-8601 DateTime".
 * El reporte lo atribuyó al tamaño del adjunto, pero no tenía que ver.
 *
 * `createCase` pasaba por `parseDateOnly` 19 fechas; `updateCase`, solo 16.
 * `fechaCesacionPagos`, `propuestaFechaInicioPago` y `fechaRadicacion` viajaban
 * dentro de `...rest` tal como las manda el formulario: `''` cuando están
 * vacías (`blankValueFor` en `edit-case-dialog/general-fields.ts`) o
 * `'YYYY-MM-DD'` del `<input type="date">`. Prisma rechaza las dos para una
 * columna `DateTime`. Como el diálogo de edición manda siempre los campos
 * generales (`pickGeneralValues`, desde #102), la edición fallaba entera.
 *
 * La lista de columnas sale de `Prisma.dmmf` y no se escribe a mano a
 * propósito: así fue como quedaron afuera estas tres. Si mañana se agrega una
 * columna `DateTime` al modelo y al `updateCaseSchema` sin convertirla en
 * `updateCase`, este test falla.
 *
 * El mock de Prisma no reproduce el rechazo de Prisma; lo que se fija acá es
 * que a `case.update` no llegue un string en una columna de fecha. El ciclo
 * contra Postgres real está en `tests/db/update-case-fechas.db.test.ts`.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { Prisma } from '@prisma/client';

import { P } from '@/lib/permissions';
import { updateCase } from '@/features/case/actions';
import { updateCaseSchema } from '@/features/case/schemas';

/** Columnas `DateTime` de `Case` que la edición puede mandar. */
const FECHAS_EDITABLES: string[] = (() => {
  const modelo = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Case')!;
  const editables = new Set(Object.keys(updateCaseSchema.shape));
  return modelo.fields
    .filter((f) => f.kind === 'scalar' && f.type === 'DateTime')
    .map((f) => f.name)
    .filter((n) => editables.has(n));
})();

const LAS_TRES_DEL_REPORTE = [
  'fechaCesacionPagos',
  'propuestaFechaInicioPago',
  'fechaRadicacion',
];

const payloadBase = {
  id: 'case-1',
  version: 1,
  debtorId: 'debtor-1',
  operatorId: 'user-1',
  type: 'INSOLVENCY' as const,
  creditors: 1,
};

// Se mira el `data` que recibe `case.update` y no el `success` de la action: el
// mock devuelve una fila parcial y el schema de salida (`caseSummarySchema`) la
// rechaza después de escribir. Mismo criterio que
// `editar-conciliacion-apoyo.test.ts`.
function dataDeUpdate(): Record<string, unknown> {
  const llamada = (mockPrisma.case.update as jest.Mock).mock.calls.at(-1);
  return (llamada?.[0] as { data: Record<string, unknown> }).data;
}

function payloadConFechas(valor: string): Record<string, unknown> {
  return {
    ...payloadBase,
    ...Object.fromEntries(FECHAS_EDITABLES.map((c) => [c, valor])),
  };
}

beforeEach(() => {
  resetAllMocks();
  mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
  mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-1' });
  jest.clearAllMocks();
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'user-1',
      name: 'Operadora',
      permissions: [P.EDITAR_CASOS, P.VER_TODOS_CASOS],
    },
    tenantId: 'tenant-1',
  });
  mockPrisma.case.findUnique.mockResolvedValue({
    id: 'case-1',
    tenantId: 'tenant-1',
    version: 1,
    phase: 'Inicial',
    filingDate: null,
    createdDate: new Date('2026-03-01T12:00:00Z'),
  });
  mockPrisma.case.update.mockResolvedValue({
    id: 'case-1',
    caseNumber: 'INSOL-000001',
    debtorName: 'Ana Torres',
    type: 'INSOLVENCY',
    totalDebt: 0,
    creditors: 1,
    phase: 'Inicial',
    createdDate: new Date(),
    operatorId: 'user-1',
    tenantId: 'tenant-1',
  });
});

describe('updateCase — las columnas DateTime llegan a Prisma como Date', () => {
  it('la lista derivada del modelo incluye las tres del reporte', () => {
    expect(FECHAS_EDITABLES).toEqual(
      expect.arrayContaining(LAS_TRES_DEL_REPORTE),
    );
    // Las 16 que ya se convertían más las 3: si baja de acá, la derivación se
    // rompió y el test dejaría de cubrir lo que dice.
    expect(FECHAS_EDITABLES.length).toBeGreaterThanOrEqual(19);
  });

  it('una fecha "YYYY-MM-DD" se escribe como Date del mismo día', async () => {
    await updateCase(payloadConFechas('2024-06-15') as never);

    expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    const data = dataDeUpdate();
    for (const columna of FECHAS_EDITABLES) {
      const valor = data[columna];
      expect({ columna, esDate: valor instanceof Date }).toEqual({
        columna,
        esDate: true,
      });
      expect((valor as Date).toISOString().slice(0, 10)).toBe('2024-06-15');
    }
  });

  it('una fecha vacía ("") no llega como string: deja la columna como estaba', async () => {
    await updateCase(payloadConFechas('') as never);

    expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    const data = dataDeUpdate();
    for (const columna of FECHAS_EDITABLES) {
      expect({ columna, valor: data[columna] }).toEqual({
        columna,
        valor: undefined,
      });
    }
  });

  it('el payload del reporte: las tres sueltas, sin el resto de fechas', async () => {
    await updateCase({
      ...payloadBase,
      fechaCesacionPagos: '',
      propuestaFechaInicioPago: '2026-12-01',
      fechaRadicacion: '2026-02-10',
    } as never);

    expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    const data = dataDeUpdate();
    expect(data.fechaCesacionPagos).toBeUndefined();
    expect((data.propuestaFechaInicioPago as Date).toISOString()).toMatch(
      /^2026-12-01/,
    );
    expect((data.fechaRadicacion as Date).toISOString()).toMatch(/^2026-02-10/);
  });
});
