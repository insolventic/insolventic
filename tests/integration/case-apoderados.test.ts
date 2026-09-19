/**
 * Integration Tests: createCase + apoderados (Sección XI, doble escritura).
 *
 * Verifica lo que `createCase` le entrega a Prisma: nested create en la tabla
 * `apoderados` (con `orden` y `tenantId`) y espejo del principal en las 8
 * columnas escalares de Case — solo si vienen vacías.
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

jest.mock('@/lib/centro-conciliacion', () => ({
  resolveCenterFolderName: jest.fn().mockReturnValue('Centro Test'),
}));

import {
  TENANT,
  ADMIN_USER,
  DEBTOR,
  CASE_DATA,
  PERMISSIONS,
} from '../helpers/fixtures';
import { createCase } from '@/features/case/actions';

const VALID_CASE_PAYLOAD = {
  debtorId: DEBTOR.id,
  type: 'INSOLVENCY' as const,
  totalDebt: '50000000',
  creditors: '3',
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

const ANA = {
  nombreCompleto: 'Ana Torres',
  tipoIdentificacion: 'CC',
  identificacion: '52111222',
  tarjetaProfesional: 'TP-111',
  direccion: 'Calle 1 # 2-3',
  telefono: '3001112222',
  correo: 'ana@abogados.co',
  existePoderOtorgado: true,
};

const LUIS = {
  nombreCompleto: 'Luis Rojas',
  tipoIdentificacion: 'CE',
  identificacion: '99887766',
  tarjetaProfesional: 'TP-222',
  direccion: 'Carrera 9 # 8-7',
  telefono: '3105556666',
  correo: 'luis@abogados.co',
  existePoderOtorgado: false,
};

/** `data` que createCase le pasó a prisma.case.create en la primera llamada. */
const createdData = (): Record<string, unknown> =>
  (mockPrisma.case.create.mock.calls[0][0] as { data: Record<string, unknown> })
    .data;

describe('createCase — apoderados (doble escritura)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();

    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        permissions: [PERMISSIONS.CREATE_CASES, PERMISSIONS.VIEW_CASES],
      },
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

  it('persiste la lista completa (con orden y tenantId) y espeja al principal', async () => {
    const result = await createCase({
      ...VALID_CASE_PAYLOAD,
      apoderados: [ANA, LUIS],
    });

    expect(result.success).toBe(true);
    const data = createdData() as {
      apoderados: { create: Array<Record<string, unknown>> };
    } & Record<string, unknown>;

    expect(data.apoderados.create).toHaveLength(2);
    expect(data.apoderados.create[0]).toMatchObject({
      orden: 0,
      nombreCompleto: 'Ana Torres',
      tenantId: TENANT.id,
    });
    expect(data.apoderados.create[1]).toMatchObject({
      orden: 1,
      nombreCompleto: 'Luis Rojas',
      tenantId: TENANT.id,
    });

    // Espejo del PRIMERO en las 8 columnas escalares.
    expect(data).toMatchObject({
      apoderadoNombreCompleto: 'Ana Torres',
      apoderadoTipoIdentificacion: 'CC',
      apoderadoIdentificacion: '52111222',
      apoderadoTarjetaProfesional: 'TP-111',
      apoderadoDireccion: 'Calle 1 # 2-3',
      apoderadoTelefono: '3001112222',
      apoderadoCorreo: 'ana@abogados.co',
      existePoderOtorgado: true,
    });
  });

  it('no envía la clave `apoderados` cruda a Prisma como columna (sale por el nested create)', async () => {
    await createCase({ ...VALID_CASE_PAYLOAD, apoderados: [ANA] });

    const data = createdData();
    // Debe ser el objeto { create: [...] }, nunca el array del formulario.
    expect(Array.isArray(data.apoderados)).toBe(false);
    expect(data.apoderados).toHaveProperty('create');
  });

  it('respeta las columnas legadas si el payload ya las trae (no pisa ni mezcla)', async () => {
    await createCase({
      ...VALID_CASE_PAYLOAD,
      apoderadoNombreCompleto: 'Dr. Legado',
      apoderados: [ANA, LUIS],
    });

    const data = createdData() as Record<string, unknown>;
    expect(data.apoderadoNombreCompleto).toBe('Dr. Legado');
    // Ninguna otra columna se rellena con datos de Ana (nada de híbridos).
    expect(data.apoderadoIdentificacion).toBeUndefined();
    expect(data.apoderadoCorreo).toBeUndefined();
    // La lista completa sí se guarda.
    expect((data.apoderados as { create: unknown[] }).create).toHaveLength(2);
  });

  it('sin apoderados: no hay nested create ni espejo', async () => {
    await createCase({ ...VALID_CASE_PAYLOAD });

    const data = createdData();
    expect(data.apoderados).toBeUndefined();
    expect(data.apoderadoNombreCompleto).toBeUndefined();
  });

  it('rechaza un apoderado sin nombre y NO llega a escribir en BD', async () => {
    const result = await createCase({
      ...VALID_CASE_PAYLOAD,
      apoderados: [{ ...ANA, nombreCompleto: '   ' }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/apoderado/i);
    expect(mockPrisma.case.create).not.toHaveBeenCalled();
  });

  it('acepta y guarda notificationCity y otherCauseDetail (columnas nuevas)', async () => {
    const result = await createCase({
      ...VALID_CASE_PAYLOAD,
      notificationCity: 'Bogotá D.C.',
      otherCauseDetail: 'Enfermedad del deudor',
    });

    expect(result.success).toBe(true);
    expect(createdData()).toMatchObject({
      notificationCity: 'Bogotá D.C.',
      otherCauseDetail: 'Enfermedad del deudor',
    });
  });
});
