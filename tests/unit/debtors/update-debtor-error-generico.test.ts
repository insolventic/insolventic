/**
 * `updateDebtor` no le muestra al usuario el mensaje crudo de un error.
 *
 * El `catch` devolvía `error.message` tal cual. El mensaje de un error de
 * Prisma imprime los datos de la operación (cédula, correo, ingresos del
 * deudor). Ahora el usuario ve un mensaje propio y el error completo va al log
 * (y de ahí a Sentry). Los mensajes que sí son para el usuario se conservan:
 * el de permisos, el de cédula o correo duplicado y el de validación.
 */
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
  createAuditLog: jest.fn().mockResolvedValue({ ok: true }),
}));

import { Prisma } from '@prisma/client';

import { updateDebtor } from '@/features/debtor/actions';
import { logger } from '@/lib/logger';
import { P } from '@/lib/permissions';

const TENANT = 'tenant-1';
const CEDULA = '1010101010';
const CORREO = 'ana@correo.test';

const FORMULARIO = {
  id: 'deudor-1',
  name: 'Ana Pérez',
  idNumber: CEDULA,
  idType: 'CC',
  email: CORREO,
  phone: '3001112233',
  address: 'Calle 1 # 2-3',
  city: 'Bogotá',
  department: 'Cundinamarca',
  occupation: 'Docente',
  monthlyIncome: 2_500_000,
  monthlyExpenses: 1_800_000,
  dependents: 1,
  hasEmployerCertification: false,
};

function sesion(permisos: string[]) {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: 'operadora-1',
      name: 'Operadora',
      email: 'operadora@centro.test',
      roleName: 'Operadora de Insolvencia',
      professionalCard: 'TP-1',
      permissions: permisos,
    },
    tenantId: TENANT,
  });
}

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  sesion([P.EDITAR_DEUDORES]);
  mockPrisma.debtor.findFirst.mockResolvedValue({
    id: FORMULARIO.id,
    email: CORREO,
    name: FORMULARIO.name,
  });
});

afterEach(() => errorSpy.mockRestore());

describe('updateDebtor: lo que ve el usuario cuando algo falla', () => {
  it('un error de Prisma no muestra su mensaje: el usuario ve uno propio y el error completo va al log', async () => {
    const errorDePrisma = new Prisma.PrismaClientKnownRequestError(
      `Invalid \`prisma.debtor.update()\` invocation: idNumber: "${CEDULA}", email: "${CORREO}", monthlyIncome: 2500000`,
      { code: 'P2025', clientVersion: 'test' },
    );
    mockPrisma.debtor.update.mockRejectedValue(errorDePrisma);

    const resultado = await updateDebtor(FORMULARIO);

    expect(resultado).toEqual({
      success: false,
      error: 'No se pudo actualizar el deudor. Intenta de nuevo.',
    });
    expect(resultado.error).not.toContain(CEDULA);
    expect(resultado.error).not.toContain(CORREO);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error al actualizar el deudor',
      errorDePrisma,
      { action: 'updateDebtor' },
    );
  });

  it('un error cualquiera tampoco muestra su mensaje', async () => {
    mockPrisma.debtor.update.mockRejectedValue(
      new Error(`detalle interno con ${CORREO}`),
    );

    const resultado = await updateDebtor(FORMULARIO);

    expect(resultado.error).toBe(
      'No se pudo actualizar el deudor. Intenta de nuevo.',
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('una cédula o un correo repetidos siguen diciendo cuál, sin ir al log como error', async () => {
    mockPrisma.debtor.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
      ),
    );

    const resultado = await updateDebtor(FORMULARIO);

    expect(resultado).toEqual({
      success: false,
      error: 'Ya existe un deudor con ese correo electrónico.',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('sin permiso sigue diciendo cuál falta, y no lee ni escribe nada', async () => {
    sesion([]);

    const resultado = await updateDebtor(FORMULARIO);

    expect(resultado).toEqual({
      success: false,
      error: 'No tiene permisos para: Editar deudores',
    });
    expect(mockPrisma.debtor.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.debtor.update).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
