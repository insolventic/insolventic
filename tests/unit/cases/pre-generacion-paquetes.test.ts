/**
 * El formulario "Datos requeridos para Admisión / Acuerdo" no funcionaba nunca.
 *
 * `pre-generation-form.tsx` manda a `updateCase` exactamente esto:
 *
 *   Paquete 2 → { id, filingDate, designationDate, positionAcceptanceDate }
 *   Paquete 3 → { id, approvalPercentage, agreementValidityDate }
 *
 * Sin `debtorId` ni `operatorId`, y sin `version`. Los dos fallaban, por dos
 * razones distintas (hallazgos T3 y T5 de
 * `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`):
 *
 *   T5 — `updateCase` armaba `debtor: { connect: { id: debtorId } }` de forma
 *        incondicional. Con `debtorId` undefined, Prisma rechazaba el update.
 *        Rompía el Paquete 2.
 *   T3 — `agreementValidityDate` es `DateTime?` en Prisma y nadie la convertía:
 *        viajaba como el string "YYYY-MM-DD" del <input type="date"> y Prisma
 *        la rechazaba. Rompía el Paquete 3 incluso con los dos ids.
 *
 * Y como `documents-section.tsx` abre ese formulario mientras falte
 * `agreementValidityDate`, y el formulario no podía guardarla, el botón
 * "Generar documentos de acuerdo" era un bucle cerrado: no había NINGÚN camino
 * en la app para persistir esa columna.
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
  createAuditLog: jest.fn(),
}));

import {
  TENANT,
  ADMIN_USER,
  CASE_DATA,
  PERMISSIONS,
} from '../../helpers/fixtures';
import { updateCase } from '@/features/case/actions';

const CASE_ID = 'case-pregen-1';

/** Lo que el update deja escrito en `tx.case.update({ data })`. */
function datosDelUpdate(): Record<string, unknown> {
  const call = mockPrisma.case.update.mock.calls.at(-1)?.[0] as {
    data: Record<string, unknown>;
  };
  return call.data;
}

beforeEach(() => {
  resetAllMocks();
  // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
  // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
  // pertenece a este centro" y lo que falla es la fixture, no el codigo.
  mockPrisma.user.findFirst.mockResolvedValue({ id: 'operador-1' });
  mockAuthenticateUser.mockReset();
  jest.clearAllMocks();

  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      roleName: 'Administrador',
      professionalCard: 'TP-1',
      // GC-A1: `updateCase` ahora aplica visibilidad por fila, asi que el
      // usuario necesita un permiso de ALCANCE y no solo `EDITAR_CASOS`. El
      // rol que dice ser (`Administrador`) lo tiene; la fixture no lo tenia.
      permissions: [PERMISSIONS.EDIT_CASES, PERMISSIONS.VIEW_ALL_CASES],
    },
    tenantId: TENANT.id,
  });

  // `updateCase` corre dentro de una transacción interactiva.
  mockPrisma.$transaction.mockImplementation(async (fn: unknown) =>
    typeof fn === 'function'
      ? (fn as (tx: unknown) => unknown)(mockPrisma)
      : undefined,
  );
  mockPrisma.case.findUnique.mockResolvedValue({
    id: CASE_ID,
    tenantId: TENANT.id,
    version: 3,
    operatorId: ADMIN_USER.id,
  });
  // La fila que devuelve el update pasa por `caseSummarySchema.parse`, que pide
  // las ~230 columnas de Case: se reutiliza el fixture completo.
  mockPrisma.case.update.mockResolvedValue({
    ...CASE_DATA,
    id: CASE_ID,
    version: 4,
  });
});

describe('pre-generation-form — Paquete 2 (Admisión)', () => {
  it('guarda las tres fechas aunque no se reenvíen debtorId ni operatorId', async () => {
    const result = await updateCase({
      id: CASE_ID,
      filingDate: '2026-02-11',
      designationDate: '2026-02-18',
      positionAcceptanceDate: '2026-02-20',
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const data = datosDelUpdate();
    expect(data.filingDate).toEqual(new Date('2026-02-11T12:00:00.000Z'));
    expect(data.designationDate).toEqual(new Date('2026-02-18T12:00:00.000Z'));
    expect(data.positionAcceptanceDate).toEqual(
      new Date('2026-02-20T12:00:00.000Z'),
    );
  });

  it('sin debtorId/operatorId no se arma ningún connect', async () => {
    await updateCase({ id: CASE_ID, filingDate: '2026-02-11' } as never);

    const data = datosDelUpdate();
    expect(data.debtor).toBeUndefined();
    expect(data.operator).toBeUndefined();
  });

  it('cuando sí vienen, se conectan como antes', async () => {
    await updateCase({
      id: CASE_ID,
      debtorId: 'deudor-1',
      operatorId: 'operador-1',
      filingDate: '2026-02-11',
    } as never);

    const data = datosDelUpdate();
    expect(data.debtor).toEqual({ connect: { id: 'deudor-1' } });
    expect(data.operator).toEqual({ connect: { id: 'operador-1' } });
  });
});

describe('pre-generation-form — Paquete 3 (Acuerdo)', () => {
  it('guarda la vigencia del acuerdo como Date, no como string', async () => {
    const result = await updateCase({
      id: CASE_ID,
      approvalPercentage: 72.5,
      agreementValidityDate: '2031-04-10',
    } as never);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const data = datosDelUpdate();
    // El string crudo es lo que Prisma rechazaba con
    // "premature end of input. Expected ISO-8601 DateTime".
    expect(typeof data.agreementValidityDate).not.toBe('string');
    expect(data.agreementValidityDate).toEqual(
      new Date('2031-04-10T12:00:00.000Z'),
    );
    expect(data.approvalPercentage).toBe(72.5);
  });
});

describe('las otras dos columnas DateTime que tampoco se convertían', () => {
  it('paymentStartDate llega como Date', async () => {
    await updateCase({ id: CASE_ID, paymentStartDate: '2026-04-10' } as never);
    expect(datosDelUpdate().paymentStartDate).toEqual(
      new Date('2026-04-10T12:00:00.000Z'),
    );
  });

  it('failureDate llega como Date', async () => {
    await updateCase({ id: CASE_ID, failureDate: '2026-05-20' } as never);
    expect(datosDelUpdate().failureDate).toEqual(
      new Date('2026-05-20T12:00:00.000Z'),
    );
  });

  it('si no se mandan, no se tocan (undefined, no null)', async () => {
    await updateCase({ id: CASE_ID, attorney: 'Dra. Prueba' } as never);
    const data = datosDelUpdate();
    expect(data.paymentStartDate).toBeUndefined();
    expect(data.agreementValidityDate).toBeUndefined();
    expect(data.failureDate).toBeUndefined();
  });
});
