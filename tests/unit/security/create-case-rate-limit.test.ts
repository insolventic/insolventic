/**
 * GC-B2: `createCase` no tenía rate limit.
 *
 * Es de las acciones más caras del sistema — dispara la generación inicial de
 * documentos vía `after()`, que lanza Chromium — y era la única de ese peso sin
 * límite. `batchGenerateDocuments` sí lo tenía. Un doble click, un reintento
 * automático del cliente o un bucle dejaban N×Chromium corriendo contra el
 * mismo presupuesto de ejecución de la función (60 s, el techo del plan Hobby).
 *
 * NOTA PARA QUIEN ESCRIBA TESTS NUEVOS QUE CREEN CASOS: el limitador
 * in-memory guarda estado por proceso, y Jest comparte el proceso entre los
 * tests de una misma suite. Una suite que cree más de 10 casos con el mismo
 * usuario empezará a recibir errores de límite que no tienen nada que ver con
 * lo que esté probando. `_resetRateLimitStore()` en el `beforeEach` lo evita,
 * como se hace acá.
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

jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: jest.fn().mockResolvedValue(undefined),
  generateDocumentsForAdmission: jest.fn().mockResolvedValue([]),
  generateDocumentsForAgreement: jest.fn().mockResolvedValue([]),
  generateDocumentsForFailure: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/features/notification/actions', () => ({
  createNotificationForAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue({ ok: true }),
}));

import { TENANT, PERMISSIONS } from '../../helpers/fixtures';
import {
  RATE_LIMIT_CONFIGS,
  _resetRateLimitStore,
} from '@/lib/rate-limit';
import { createCase } from '@/features/case/actions';

const LIMITE = RATE_LIMIT_CONFIGS.caseCreation.maxAttempts;

function signIn(permissions: string[], userId = 'user-que-crea') {
  mockAuthenticateUser.mockResolvedValue({
    user: {
      id: userId,
      name: 'Operadora',
      email: 'op@test.com',
      roleName: 'Operadora de Insolvencia',
      professionalCard: 'TP-010',
      permissions,
    },
    tenantId: TENANT.id,
  });
}

const PERMISOS_COMPLETOS = [
  PERMISSIONS.VIEW_CASES,
  PERMISSIONS.VIEW_ALL_CASES,
  PERMISSIONS.CREATE_CASES,
];

/** Un payload que falla DESPUÉS del rate limit, para no montar media base. */
const PAYLOAD = {
  debtorId: 'debtor-1',
  type: 'CONCILIATION' as const,
  totalDebt: '0',
  creditors: 0,
  operatorId: 'operador-1',
  causes: [],
};

async function crear() {
  return createCase(PAYLOAD as never);
}

describe('createCase — rate limit (GC-B2)', () => {
  beforeEach(() => {
    resetAllMocks();
    mockAuthenticateUser.mockReset();
    jest.clearAllMocks();
    _resetRateLimitStore();
    // El operador existe; el deudor NO, así que cada intento muere justo
    // después del límite y no hay que mockear la creación entera.
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'operador-1' });
    mockPrisma.debtor.findUnique.mockResolvedValue(null);
    signIn(PERMISOS_COMPLETOS);
  });

  it('existe una configuración propia para la creación de casos', () => {
    expect(RATE_LIMIT_CONFIGS.caseCreation).toEqual({
      windowMs: 10 * 60 * 1000,
      maxAttempts: 10,
    });
  });

  it('deja pasar los primeros intentos dentro del límite', async () => {
    for (let i = 0; i < LIMITE; i++) {
      const r = await crear();
      // Falla por el deudor inexistente, NO por el límite.
      expect(r.error).not.toMatch(/Demasiadas creaciones/);
    }
  });

  it('corta al superar el límite, y lo dice con los minutos que faltan', async () => {
    for (let i = 0; i < LIMITE; i++) await crear();

    const result = await crear();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Demasiadas creaciones de casos seguidas/);
    expect(result.error).toMatch(/Intente en \d+ minutos/);
  });

  it('una vez cortado, NO llega a tocar la base', async () => {
    for (let i = 0; i < LIMITE; i++) await crear();
    jest.clearAllMocks();

    await crear();

    // Ni el operador, ni el deudor, ni el consecutivo, ni la creación.
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.debtor.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('el límite es POR USUARIO: otro usuario no hereda el corte', async () => {
    for (let i = 0; i < LIMITE; i++) await crear();
    expect((await crear()).error).toMatch(/Demasiadas creaciones/);

    // Otra persona del mismo centro empieza con su ventana limpia.
    signIn(PERMISOS_COMPLETOS, 'otro-usuario');
    const result = await crear();

    expect(result.error).not.toMatch(/Demasiadas creaciones/);
  });

  it('no se gasta cupo en quien no tiene permiso de crear', async () => {
    signIn([PERMISSIONS.VIEW_CASES, PERMISSIONS.VIEW_ALL_CASES]);

    // Muchos intentos sin permiso.
    for (let i = 0; i < LIMITE + 5; i++) {
      const r = await crear();
      expect(r.error).toMatch(/No tienes permisos para crear casos/);
    }

    // El usuario con permiso sigue con su ventana intacta: el check de
    // permiso va ANTES del limitador, así que un rol sin permiso no puede
    // consumirle la cuota a nadie.
    signIn(PERMISOS_COMPLETOS);
    const result = await crear();
    expect(result.error).not.toMatch(/Demasiadas creaciones/);
  });
});
