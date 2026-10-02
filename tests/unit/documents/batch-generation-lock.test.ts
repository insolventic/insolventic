/**
 * Unit Tests: idempotencia de la generación por lotes (C-4).
 *
 * `batchGenerateDocuments` —la ruta manual de /documents— era la única sin el
 * lock anti-duplicados: solo tenía rate limit. Dos operadores generando el
 * mismo paquete a la vez, o un doble click, duplicaban archivos en Drive y
 * filas en BD.
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

const mockClaim = jest.fn();
const mockMarkProcessing = jest.fn().mockResolvedValue(undefined);
const mockComplete = jest.fn().mockResolvedValue(undefined);
const mockFail = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: (...a: unknown[]) => mockClaim(...a),
  markGenerationProcessing: (...a: unknown[]) => mockMarkProcessing(...a),
  completeGenerationRequest: (...a: unknown[]) => mockComplete(...a),
  failGenerationRequest: (...a: unknown[]) => mockFail(...a),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest
    .fn()
    .mockResolvedValue({ allowed: true, remainingAttempts: 5, resetInMs: 0 }),
  getRateLimitKey: (scope: string, id: string) => `${scope}:${id}`,
  RATE_LIMIT_CONFIGS: { batchDocumentGeneration: {} },
}));

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { TENANT, ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { batchGenerateDocuments } from '@/features/document/actions';
import type { GenerationKind } from '@/features/document/generation-request';

const activeRequest = {
  id: 'req-existing',
  kind: 'BATCH' as GenerationKind,
  status: 'PROCESSING' as const,
  totalDocuments: 0,
  successCount: 0,
  errorCount: 0,
  error: null,
  createdAt: new Date(),
  startedAt: new Date(),
  finishedAt: null,
};

describe('batchGenerateDocuments — lock anti-duplicados (C-4)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockMarkProcessing.mockResolvedValue(undefined);
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT.id,
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      caseNumber: 'INSOL-000001',
      debtorName: 'Juan Pérez',
      type: 'INSOLVENCY',
      operatorId: ADMIN_USER.id,
      debtorId: 'debtor-1',
      tenantId: TENANT.id,
      debtor: { name: 'Juan Pérez' },
      debts: [],
      assets: [],
      documents: [],
      libranzas: [],
      suspendedServices: [],
      dependents: [],
      legalProcesses: [],
      operator: ADMIN_USER,
    });
  });

  it('reclama el lock con kind BATCH, scopeado por tenant y caso', async () => {
    mockClaim.mockResolvedValue({
      claimed: true,
      request: { ...activeRequest, id: 'req-new' },
    });

    await batchGenerateDocuments({ caseId: 'case-1', packageNumber: 1 });

    expect(mockClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT.id,
        caseId: 'case-1',
        kind: 'BATCH',
        requestedById: ADMIN_USER.id,
      }),
    );
  });

  it('DUPLICADO: si ya hay una generación activa, no genera y devuelve el requestId', async () => {
    mockClaim.mockResolvedValue({ claimed: false, request: activeRequest });

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      packageNumber: 1,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('generación en curso');
    expect((result as { requestId?: string }).requestId).toBe('req-existing');
    // Nada se subió ni se persistió
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('no reclama el lock si el usuario no tiene permiso de generar', async () => {
    mockAuthenticateUser.mockResolvedValue({
      // Ve documentos pero NO puede generarlos.
      user: { ...ADMIN_USER, permissions: [P.VER_DOCUMENTOS] },
      tenantId: TENANT.id,
    });

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      packageNumber: 1,
    });

    expect(result.success).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('no reclama el lock para un caso de otro tenant', async () => {
    mockPrisma.case.findUnique.mockResolvedValue(null);

    const result = await batchGenerateDocuments({
      caseId: 'ajeno',
      packageNumber: 1,
    });

    expect(result.success).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('libera el lock cuando la generación falla DESPUÉS de reclamarlo', async () => {
    mockClaim.mockResolvedValue({
      claimed: true,
      request: { ...activeRequest, id: 'req-new' },
    });
    // El fallo tiene que ocurrir con el lock ya tomado: si no, el test no
    // probaría nada. `markGenerationProcessing` es el primer paso posterior.
    mockMarkProcessing.mockRejectedValueOnce(new Error('Drive caído'));

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      packageNumber: 1,
    });

    expect(result.success).toBe(false);
    // El lock no puede quedar tomado: bloquearía todo reintento 10 minutos.
    expect(mockFail).toHaveBeenCalledWith('req-new', expect.any(Error));
  });
});

describe('completeGenerationRequest — estado honesto (C-4)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
  });

  // Se re-importa el módulo real (sin el mock de arriba) para probar la lógica.
  const realModule = jest.requireActual(
    '@/features/document/generation-request',
  ) as typeof import('@/features/document/generation-request');

  const statusOf = () =>
    (
      mockPrisma.documentGenerationRequest.update.mock.calls[0][0] as {
        data: { status: string };
      }
    ).data.status;

  it('COMPLETED cuando se generó todo sin errores', async () => {
    await realModule.completeGenerationRequest('req-1', {
      total: 5,
      success: 5,
      errors: 0,
    });
    expect(statusOf()).toBe('COMPLETED');
  });

  it('COMPLETED_WITH_ERRORS cuando hubo errores', async () => {
    await realModule.completeGenerationRequest('req-1', {
      total: 5,
      success: 3,
      errors: 2,
    });
    expect(statusOf()).toBe('COMPLETED_WITH_ERRORS');
  });

  it('REGRESIÓN: no marca COMPLETED si no se produjo ni un documento', async () => {
    // Con el bloqueo por datos incompletos (C-3) los documentos salen como
    // `skipped`, que no cuenta como error: la solicitud quedaba "completada"
    // habiendo generado cero documentos.
    await realModule.completeGenerationRequest('req-1', {
      total: 8,
      success: 0,
      errors: 0,
    });
    expect(statusOf()).toBe('COMPLETED_WITH_ERRORS');
  });

  it('COMPLETED en el caso vacío legítimo (no había plantillas)', async () => {
    await realModule.completeGenerationRequest('req-1', {
      total: 0,
      success: 0,
      errors: 0,
    });
    expect(statusOf()).toBe('COMPLETED');
  });

  it('libera siempre el lock (activeKey a null)', async () => {
    await realModule.completeGenerationRequest('req-1', {
      total: 1,
      success: 1,
      errors: 0,
    });
    const call = mockPrisma.documentGenerationRequest.update.mock
      .calls[0][0] as {
      data: { activeKey: string | null };
    };
    expect(call.data.activeKey).toBeNull();
  });
});

describe('maxDuration configurado en las rutas con Chromium (C-4)', () => {
  it('/documents declara presupuesto de ejecución explícito', async () => {
    const page = await import('@/app/documents/page');
    expect(page.maxDuration).toBe(60);
  });

  it('/cases declara presupuesto de ejecución explícito', async () => {
    const page = await import('@/app/cases/page');
    expect(page.maxDuration).toBe(60);
  });
});
