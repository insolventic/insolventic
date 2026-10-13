/**
 * Integration Tests: teléfono y correo del codeudor/avalista.
 *
 * El bloque de codeudor de `Debt` tenía nombre, domicilio y dirección, pero no
 * datos de contacto: para notificar al avalista había que salir del expediente.
 *
 * Lo que se ejerce acá es la cadena completa de la captura nueva —zod de
 * entrada -> `createCase` -> `prisma.debt.create`— porque es donde se pierden
 * los campos nuevos en silencio: `z.object` descarta las claves que no declara,
 * y `createCase` arma el `create` de cada deuda campo por campo, así que una
 * columna que exista en Prisma pero no se liste en esa proyección nunca se
 * escribe y ningún tipo se queja.
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
jest.mock('next/server', () => ({
  after: jest.fn(),
}));
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
import { createCaseFormSchema } from '@/features/case/schemas';
import { createCase } from '@/features/case/actions';

const CODEUDOR = {
  coDebtorName: 'Pedro López',
  coDebtorCity: 'Medellín',
  coDebtorAddress: 'Cra 45 #30-12',
  coDebtorPhone: '3109876543',
  coDebtorEmail: 'pedro.lopez@ejemplo.com',
};

const PAYLOAD = {
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
      ...CODEUDOR,
    },
  ],
};

/**
 * `data` de cada `prisma.debt.create` de la última llamada a createCase.
 *
 * Las deudas no van como `create` anidado dentro de `prisma.case.create`:
 * createCase resuelve/crea el `Creditor` de cada una y después las inserta una
 * por una, así que la proyección campo-por-campo que hay que vigilar está en
 * esas llamadas.
 */
function createdDebts(): Array<Record<string, unknown>> {
  return mockPrisma.debt.create.mock.calls.map(
    (call: unknown[]) =>
      (call[0] as { data: Record<string, unknown> }).data ?? {},
  );
}

describe('codeudor/avalista — teléfono y correo', () => {
  beforeEach(() => {
    resetAllMocks();
    // GC-M2: `createCase`/`updateCase` ahora verifican que el operador asignado
    // sea un usuario de ESTE centro. Sin este mock el guard corta con "no
    // pertenece a este centro" y lo que falla es la fixture, no el codigo.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
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

  it('las dos columnas existen en el modelo Debt', () => {
    const debt = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Debt');
    const fields = new Set((debt?.fields ?? []).map((f) => f.name));

    expect(fields.has('coDebtorPhone')).toBe(true);
    expect(fields.has('coDebtorEmail')).toBe(true);
  });

  it('el zod del formulario no descarta los campos nuevos al parsear', () => {
    const parsed = createCaseFormSchema.parse(PAYLOAD);

    expect(parsed.debts?.[0]?.coDebtorPhone).toBe('3109876543');
    expect(parsed.debts?.[0]?.coDebtorEmail).toBe('pedro.lopez@ejemplo.com');
  });

  it('createCase los escribe en la fila de la deuda', async () => {
    const created = await createCase(PAYLOAD);
    expect(created.success).toBe(true);

    expect(createdDebts()[0]).toMatchObject({
      coDebtorName: 'Pedro López',
      coDebtorPhone: '3109876543',
      coDebtorEmail: 'pedro.lopez@ejemplo.com',
    });
  });

  it('sin datos de contacto la deuda se crea igual (el codeudor es opcional)', async () => {
    const created = await createCase({
      ...PAYLOAD,
      debts: [{ ...PAYLOAD.debts[0], coDebtorPhone: '', coDebtorEmail: '' }],
    });
    expect(created.success).toBe(true);

    expect(createdDebts()[0]).toMatchObject({
      coDebtorPhone: '',
      coDebtorEmail: '',
    });
  });
});
