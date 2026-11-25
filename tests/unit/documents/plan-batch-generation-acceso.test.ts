/**
 * Unit test: `planBatchGeneration` lee el caso acotado por `tenantId` y
 * aplica la visibilidad por rol antes de planificar.
 *
 * Antes recibía el `caseId` y no lo leía: el plan salía solo de la
 * configuración estática de plantillas, igual para cualquier id. No exponía
 * datos de otro centro (no consultaba nada), pero aceptaba un id ajeno o
 * inexistente. Ahora el plan depende del tipo del caso, así que la lectura es
 * obligatoria y tiene que pasar por el mismo control que
 * `batchGenerateDocuments`.
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

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { planBatchGeneration } from '@/features/document/actions';

const TENANT_ID = 'armonia';
const OPERADOR = { ...ADMIN_USER, id: 'operador-1' };

function sesion(permissions: string[]) {
  mockAuthenticateUser.mockResolvedValue({
    user: { ...OPERADOR, permissions },
    tenantId: TENANT_ID,
  });
}

const casoDe = (operatorId: string) => ({
  id: 'case-1',
  operatorId,
  debtorId: 'debtor-1',
  type: 'INSOLVENCY',
});

describe('planBatchGeneration — lectura y control de acceso del caso', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  it('busca el caso acotado por el tenant de la sesión', async () => {
    sesion([P.GENERAR_DOCUMENTOS, P.VER_TODOS_CASOS]);
    mockPrisma.case.findUnique.mockResolvedValue(casoDe('otro'));

    const plan = await planBatchGeneration({ caseId: 'case-1' });

    expect(plan.success).toBe(true);
    expect(mockPrisma.case.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'case-1', tenantId: TENANT_ID } }),
    );
  });

  it('un caso que no está en el tenant (de otro centro o inexistente) no se planifica', async () => {
    sesion([P.GENERAR_DOCUMENTOS, P.VER_TODOS_CASOS]);
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const plan = await planBatchGeneration({ caseId: 'case-de-otro-centro' });

    expect(plan).toEqual({
      success: false,
      message: 'Caso no encontrado',
      data: null,
    });
  });

  it('un rol limitado a sus casos no planifica el caso de otro operador', async () => {
    sesion([P.GENERAR_DOCUMENTOS, P.VER_CASOS_PROPIOS]);
    mockPrisma.case.findUnique.mockResolvedValue(casoDe('otro-operador'));

    const plan = await planBatchGeneration({ caseId: 'case-1' });

    expect(plan).toEqual({
      success: false,
      message: 'No tienes permisos para acceder a este caso',
      data: null,
    });
  });

  it('un rol limitado a sus casos sí planifica uno propio', async () => {
    sesion([P.GENERAR_DOCUMENTOS, P.VER_CASOS_PROPIOS]);
    mockPrisma.case.findUnique.mockResolvedValue(casoDe(OPERADOR.id));

    const plan = await planBatchGeneration({ caseId: 'case-1' });

    expect(plan.success).toBe(true);
    expect(plan.data!.tandas.flat().length).toBeGreaterThan(0);
  });

  it('sin el permiso de generar no llega a leer el caso', async () => {
    sesion([P.VER_TODOS_CASOS]);

    const plan = await planBatchGeneration({ caseId: 'case-1' });

    expect(plan.success).toBe(false);
    expect(mockPrisma.case.findUnique).not.toHaveBeenCalled();
  });
});
