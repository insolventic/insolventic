/**
 * Integration Tests: texto libre de "Otros" y correo del juzgado.
 *
 * Dos cosas que se perdían entre el formulario y la fila:
 *
 *  - `tipoProcesoOtro` estaba en el zod de la Sección VII y el formulario lo
 *    capturaba, pero no existía la columna y la proyección de `createCase` no lo
 *    listaba: se descartaba en silencio, sin que tsc ni Prisma se quejaran.
 *  - el correo del juzgado no existía en ninguna parte, y es a donde se manda el
 *    oficio de suspensión.
 *
 * Se ejercen los dos modelos que guardan procesos, porque los dos comparten
 * ahora la misma lista de tipos.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('next/server', () => ({ after: jest.fn() }));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/centro-conciliacion', () => ({
  resolveCenterFolderName: jest.fn().mockReturnValue('Centro Test'),
}));

import { Prisma } from '@prisma/client';
import { TENANT, ADMIN_USER, DEBTOR, CASE_DATA } from '../helpers/fixtures';
import { P } from '@/lib/permissions';
import { legalProcessSchema } from '@/features/case/schemas';
import { createCase } from '@/features/case/actions';

const JUZGADO_CORREO = 'j15cctobogota@cendoj.ramajudicial.gov.co';

const BASE = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: '1',
  operatorId: ADMIN_USER.id,
  causes: ['SOBREENDEUDAMIENTO'],
  debts: [
    {
      creditor: 'Banco Test',
      type: 'TARJETA_CREDITO',
      interestRate: '2.5',
      capitalAmount: '50000000',
      interestAmount: '0',
    },
  ],
};

/** `data` que createCase le pasó a prisma.case.create en la última llamada. */
function createdCaseData(): Record<string, unknown> {
  const calls = mockPrisma.case.create.mock.calls;
  return (calls[calls.length - 1][0] as { data: Record<string, unknown> }).data;
}

function nestedCreate(key: string): Array<Record<string, unknown>> {
  const rel = createdCaseData()[key] as
    | { create?: Array<Record<string, unknown>> }
    | undefined;
  return rel?.create ?? [];
}

describe('procesos judiciales — "Otros" y correo del juzgado', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();

    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });

    mockPrisma.case.findFirst.mockResolvedValue(null);
    mockPrisma.case.count.mockResolvedValue(0);
    mockPrisma.debtor.findUnique.mockResolvedValue(DEBTOR);
    mockPrisma.debtor.update.mockResolvedValue(DEBTOR);
    mockPrisma.case.create.mockResolvedValue({
      ...CASE_DATA,
      id: 'new-case-id',
      caseNumber: 'CASO-000001',
    });
  });

  describe('las columnas existen', () => {
    const fieldsOf = (model: string) =>
      new Set(
        (
          Prisma.dmmf.datamodel.models.find((m) => m.name === model)?.fields ??
          []
        ).map((f) => f.name),
      );

    it('LegalProcess tiene processTypeOther y courtEmail', () => {
      const fields = fieldsOf('LegalProcess');
      expect(fields.has('processTypeOther')).toBe(true);
      expect(fields.has('courtEmail')).toBe(true);
    });

    it('ProcesoJudicial tiene tipoProcesoOtro y juzgadoCorreo', () => {
      const fields = fieldsOf('ProcesoJudicial');
      expect(fields.has('tipoProcesoOtro')).toBe(true);
      expect(fields.has('juzgadoCorreo')).toBe(true);
    });
  });

  describe('validación del texto libre', () => {
    const VALID = {
      processType: 'EJECUTIVO',
      plaintiff: 'Banco XYZ',
      court: 'Juzgado 15 Civil del Circuito',
      fileNumber: '2024-00123-00',
    };

    it('"Otros" sin texto no pasa', () => {
      const result = legalProcessSchema.safeParse({
        ...VALID,
        processType: 'OTROS',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['processTypeOther']);
      }
    });

    it('"Otros" con solo espacios tampoco', () => {
      expect(
        legalProcessSchema.safeParse({
          ...VALID,
          processType: 'OTROS',
          processTypeOther: '   ',
        }).success,
      ).toBe(false);
    });

    it('"Otros" con texto pasa', () => {
      expect(
        legalProcessSchema.safeParse({
          ...VALID,
          processType: 'OTROS',
          processTypeOther: 'Insolvencia de persona natural',
        }).success,
      ).toBe(true);
    });

    it('los otros 6 tipos no piden texto', () => {
      for (const processType of [
        'EJECUTIVO',
        'COACTIVO',
        'RESTITUCION_INMUEBLE',
        'PAGO_DIRECTO',
        'CIVIL_ALIMENTOS',
        'LABORAL',
      ]) {
        expect(
          legalProcessSchema.safeParse({ ...VALID, processType }).success,
        ).toBe(true);
      }
    });

    it('un correo de juzgado inválido no pasa, y vacío sí', () => {
      expect(
        legalProcessSchema.safeParse({ ...VALID, courtEmail: 'no-es-correo' })
          .success,
      ).toBe(false);
      expect(
        legalProcessSchema.safeParse({ ...VALID, courtEmail: '' }).success,
      ).toBe(true);
    });
  });

  describe('LegalProcess — createCase', () => {
    it('escribe el texto de "Otros" y el correo del juzgado', async () => {
      const created = await createCase({
        ...BASE,
        legalProcesses: [
          {
            processType: 'OTROS',
            processTypeOther: 'Insolvencia de persona natural',
            plaintiff: 'Banco XYZ',
            court: 'Juzgado 15 Civil del Circuito',
            courtEmail: JUZGADO_CORREO,
            fileNumber: '2024-00123-00',
          },
        ],
      });
      expect(created.success).toBe(true);

      expect(nestedCreate('legalProcesses')[0]).toMatchObject({
        processType: 'OTROS',
        processTypeOther: 'Insolvencia de persona natural',
        courtEmail: JUZGADO_CORREO,
      });
    });

    it('la descripción usa el texto libre, no el valor crudo "OTROS"', async () => {
      await createCase({
        ...BASE,
        legalProcesses: [
          {
            processType: 'OTROS',
            processTypeOther: 'Insolvencia de persona natural',
            plaintiff: 'Banco XYZ',
            court: 'Juzgado 15',
            fileNumber: '2024-00123-00',
          },
        ],
      });

      expect(nestedCreate('legalProcesses')[0].description).toBe(
        'Insolvencia de persona natural - Banco XYZ',
      );
    });

    it('la descripción traduce los tipos normales a su etiqueta', async () => {
      await createCase({
        ...BASE,
        legalProcesses: [
          {
            processType: 'RESTITUCION_INMUEBLE',
            plaintiff: 'Arrendador S.A.',
            court: 'Juzgado 3 Civil Municipal',
            fileNumber: '2024-00999-00',
          },
        ],
      });

      expect(nestedCreate('legalProcesses')[0].description).toBe(
        'Restitución de inmueble - Arrendador S.A.',
      );
    });

    it('no guarda texto libre en un tipo que no es "Otros"', async () => {
      await createCase({
        ...BASE,
        legalProcesses: [
          {
            processType: 'LABORAL',
            processTypeOther: 'quedó pegado de antes',
            plaintiff: 'Ex empleador',
            court: 'Juzgado Laboral 2',
            fileNumber: '2024-00777-00',
          },
        ],
      });

      expect(nestedCreate('legalProcesses')[0].processTypeOther).toBeNull();
    });

    it('un correo vacío se guarda como null, no como cadena vacía', async () => {
      await createCase({
        ...BASE,
        legalProcesses: [
          {
            processType: 'EJECUTIVO',
            plaintiff: 'Banco XYZ',
            court: 'Juzgado 15',
            courtEmail: '',
            fileNumber: '2024-00123-00',
          },
        ],
      });

      expect(nestedCreate('legalProcesses')[0].courtEmail).toBeNull();
    });
  });

  describe('ProcesoJudicial (Sección VII) — createCase', () => {
    it('ya no descarta tipoProcesoOtro ni el correo del juzgado', async () => {
      await createCase({
        ...BASE,
        procesosJudiciales: [
          {
            tipoProceso: 'OTROS',
            tipoProcesoOtro: 'Acción de tutela',
            juzgadoNombre: 'Juzgado 8 Civil',
            juzgadoCiudad: 'Cali',
            juzgadoCorreo: JUZGADO_CORREO,
          },
        ],
      });

      expect(nestedCreate('procesosJudiciales')[0]).toMatchObject({
        tipoProceso: 'OTROS',
        tipoProcesoOtro: 'Acción de tutela',
        juzgadoCorreo: JUZGADO_CORREO,
      });
    });
  });
});
