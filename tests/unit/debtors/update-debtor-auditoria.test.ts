/**
 * Unit Tests: la auditoría de `updateDebtor` dice qué cambió.
 *
 * La entrada decía solo "Se ha actualizado el deudor X". Un cambio de correo
 * no dejaba rastro, y el correo del deudor es lo que decide qué expedientes ve
 * un usuario con el alcance "cliente" de `case-access`: quien puede editar
 * deudores podía apuntar el expediente de uno a la cuenta de otro sin que el
 * registro lo mostrara.
 *
 * El formato es el de las auditorías existentes: `resumirCambios` (nombres de
 * los campos cambiados y conteos, como en casos) y, si cambia el correo, las
 * dos direcciones (como en usuarios). Los valores de los demás campos no se
 * guardan: son datos personales del deudor.
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
const mockCreateAuditLog = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

import { updateDebtor } from '@/features/debtor/actions';
import { P } from '@/lib/permissions';

const TENANT = 'tenant-1';

/** La fila completa tal como la tiene la base. */
const FILA = {
  id: 'deudor-1',
  name: 'Ana Pérez',
  idNumber: '1010101010',
  idType: 'CC',
  email: 'ana@correo.test',
  phone: '3001112233',
  address: 'Calle 1 # 2-3',
  city: 'Bogotá',
  department: 'Cundinamarca',
  birthDate: new Date('1985-04-12T12:00:00Z'),
  maritalStatus: 'SOLTERO',
  occupation: 'Docente',
  monthlyIncome: { toString: () => '2500000' },
  monthlyExpenses: { toString: () => '1800000' },
  dependents: 1,
  educationLevel: null,
  emergencyContact: null,
  emergencyPhone: null,
  bankAccount: null,
  bankName: null,
  accountType: null,
  description: null,
  totalDebt: 0,
  activeCases: 0,
  createdDate: new Date('2026-01-01T12:00:00Z'),
  lastUpdate: new Date('2026-01-01T12:00:00Z'),
  otherIncomeDescription: null,
  otherIncomeAmount: null,
  hasEmployerCertification: false,
  tenantId: TENANT,
};

/** Lo que reenvía el formulario de edición: todos los campos editables. */
const FORMULARIO = {
  id: FILA.id,
  name: FILA.name,
  idNumber: FILA.idNumber,
  idType: FILA.idType,
  email: FILA.email,
  phone: FILA.phone,
  address: FILA.address,
  city: FILA.city,
  department: FILA.department,
  occupation: FILA.occupation,
  monthlyIncome: 2_500_000,
  monthlyExpenses: 1_800_000,
  dependents: 1,
  hasEmployerCertification: false,
};

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'operadora-1',
      name: 'Operadora',
      email: 'operadora@centro.test',
      roleName: 'Operadora de Insolvencia',
      professionalCard: 'TP-1',
      permissions: [P.EDITAR_DEUDORES],
    },
    tenantId: TENANT,
  });
  // `findFirst` devuelve solo lo que pidió el `select`, como Prisma.
  mockPrisma.debtor.findFirst.mockImplementation(
    async ({ select }: { select: Record<string, true> }) =>
      Object.fromEntries(
        Object.keys(select).map((k) => [
          k,
          (FILA as Record<string, unknown>)[k],
        ]),
      ),
  );
  mockPrisma.debtor.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...FILA,
      ...data,
    }),
  );
});

const metadataDeLaAuditoria = () =>
  mockCreateAuditLog.mock.calls[0][0].metadata;

describe('updateDebtor — diff por campo en la auditoría', () => {
  it('un cambio de correo deja las dos direcciones y el campo cambiado', async () => {
    const resultado = await updateDebtor({
      ...FORMULARIO,
      email: 'otra.persona@correo.test',
    });

    expect(resultado.success).toBe(true);
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    expect(metadataDeLaAuditoria()).toEqual({
      changedFields: 'email',
      changedFieldCount: 1,
      submittedFieldCount: Object.keys(FORMULARIO).length - 1,
      previousEmail: 'ana@correo.test',
      newEmail: 'otra.persona@correo.test',
    });
  });

  it('el select del diff pide solo las columnas enviadas, más id y email', async () => {
    await updateDebtor({ ...FORMULARIO, email: 'otra@correo.test' });

    const [args] = (mockPrisma.debtor.findFirst as jest.Mock).mock.calls[0];
    expect(args.where).toEqual({ id: FILA.id, tenantId: TENANT });
    expect(Object.keys(args.select).sort()).toEqual(
      [...Object.keys(FORMULARIO)].sort(),
    );
  });

  it('varios campos: lista los nombres, sin los valores personales', async () => {
    await updateDebtor({
      ...FORMULARIO,
      phone: '3209998877',
      address: 'Carrera 9 # 8-7',
      monthlyIncome: 3_100_000,
    });

    const metadata = metadataDeLaAuditoria();
    expect(metadata.changedFields).toBe('address, monthlyIncome, phone');
    expect(metadata.changedFieldCount).toBe(3);
    // Sin cambio de correo no van las direcciones.
    expect(metadata).not.toHaveProperty('previousEmail');
    expect(metadata).not.toHaveProperty('newEmail');
    // Ni el teléfono ni la dirección ni el ingreso entran al audit log.
    const texto = JSON.stringify(metadata);
    expect(texto).not.toContain('3209998877');
    expect(texto).not.toContain('Carrera 9');
    expect(texto).not.toContain('3100000');
  });

  it('reenviar el formulario sin cambios no marca nada como cambiado', async () => {
    await updateDebtor(FORMULARIO);

    expect(metadataDeLaAuditoria()).toEqual({
      changedFields: '',
      changedFieldCount: 0,
      submittedFieldCount: Object.keys(FORMULARIO).length - 1,
    });
  });

  it('el mismo correo con otras mayúsculas cuenta como cambio y queda registrado', async () => {
    // `case-access` compara el correo exacto: para el alcance "cliente" es
    // otro correo, así que la auditoría también lo trata como cambio.
    await updateDebtor({ ...FORMULARIO, email: 'Ana@Correo.test' });

    expect(metadataDeLaAuditoria()).toMatchObject({
      changedFields: 'email',
      previousEmail: 'ana@correo.test',
      newEmail: 'Ana@Correo.test',
    });
  });

  it('un deudor que no existe en el centro no se actualiza ni se audita', async () => {
    mockPrisma.debtor.findFirst.mockResolvedValue(null);

    const resultado = await updateDebtor({
      ...FORMULARIO,
      id: 'de-otro-centro',
    });

    expect(resultado).toEqual({
      success: false,
      error: 'Deudor no encontrado',
    });
    expect(mockPrisma.debtor.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});
