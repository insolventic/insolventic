/**
 * Unit test: troceo en tandas de `batchGenerateDocuments` (GD-A1, issue #3).
 *
 * El escenario que importa: tanda 1 OK, tanda 2 falla a mitad de camino,
 * se reintenta SOLO la tanda 2 (no se vuelve a correr la 1) y el conteo final
 * no duplica lo que la tanda 1 ya generó. El lock (`activeKey`) y los
 * conteos viven en la MISMA `DocumentGenerationRequest` durante las tres
 * llamadas — nunca se crea una fila nueva.
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
const mockContinueOrResume = jest.fn();
const mockRecordProgress = jest.fn().mockResolvedValue(undefined);
const mockFinalize = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: (...a: unknown[]) => mockClaim(...a),
  markGenerationProcessing: (...a: unknown[]) => mockMarkProcessing(...a),
  completeGenerationRequest: (...a: unknown[]) => mockComplete(...a),
  failGenerationRequest: (...a: unknown[]) => mockFail(...a),
  continueOrResumeGenerationRequest: (...a: unknown[]) =>
    mockContinueOrResume(...a),
  recordBatchTandaProgress: (...a: unknown[]) => mockRecordProgress(...a),
  finalizeBatchGenerationRequest: (...a: unknown[]) => mockFinalize(...a),
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

// Fase 1 fuera de alcance: se fija para llegar determinísticamente a la
// Fase 3, igual que batch-generate-retry.test.ts.
jest.mock('@/features/document/prepare-template', () => ({
  prepareTemplate: jest.fn().mockResolvedValue({
    htmlContent: '<html>sin placeholders</html>',
    html: '<html>sin placeholders</html>',
    placeholders: {},
    unresolved: [],
    coveragePercentage: 100,
    missing: [],
    empty: [],
  }),
  variantDisplayName: (template: { name: string }) => template.name,
  SIN_VARIANTE: { suffix: '', label: '', overlay: {} },
}));

jest.mock('@/lib/html-to-pdf', () => ({
  batchHtmlToPdf: jest
    .fn()
    .mockImplementation(
      (
        inputs: Array<{ filename: string }>,
      ): Promise<Array<{ filename: string; buffer: Buffer }>> =>
        Promise.resolve(
          inputs.map((i) => ({
            filename: i.filename.replace(/\.html$/, '.pdf'),
            buffer: Buffer.from('pdf'),
          })),
        ),
    ),
}));

jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: jest.fn().mockResolvedValue('center-folder-id'),
    uploadDocumentToCase: jest.fn().mockResolvedValue({
      fileId: 'file-1',
      fileUrl: 'https://drive.example/file/file-1',
    }),
  },
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { batchGenerateDocuments } from '@/features/document/actions';

const TENANT_ID = 'armonia';

const activeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  kind: 'BATCH' as const,
  status: 'PROCESSING' as const,
  totalDocuments: 0,
  successCount: 0,
  errorCount: 0,
  error: null,
  createdAt: new Date(),
  startedAt: new Date(),
  finishedAt: null,
  ...overrides,
});

describe('batchGenerateDocuments — troceo en tandas (GD-A1)', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: { ...ADMIN_USER, permissions: Object.values(P) },
      tenantId: TENANT_ID,
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      caseNumber: 'INSOL-000001',
      debtorName: 'Juan Pérez',
      type: 'INSOLVENCY',
      operatorId: ADMIN_USER.id,
      debtorId: 'debtor-1',
      tenantId: TENANT_ID,
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
    mockPrisma.document.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `doc-${data.name}`, ...data }),
    );
  });

  it('tanda 1 (sin requestId, no final): reclama lock nuevo y ACUMULA, no completa', async () => {
    mockClaim.mockResolvedValue({ claimed: true, request: activeRow() });

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['solicitud-insolvencia'],
      isFinalTanda: false,
    });

    expect(result.success).toBe(true);
    expect(mockClaim).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case-1', kind: 'BATCH' }),
    );
    expect(mockRecordProgress).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({ total: 1, success: 1, errors: 0 }),
    );
    // No es la tanda final: ni completa ni finaliza, el lock sigue tomado.
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
    expect((result.data as { requestId: string }).requestId).toBe('req-1');
  });

  it('tanda 2 (con requestId, falla a mitad de camino): NO acumula nada de esta tanda, pero el lock se libera para reintentar', async () => {
    mockContinueOrResume.mockResolvedValue({ ok: true });
    // Fallo que escapa el try completo (ej. Chromium se cae a mitad de
    // render), no un error de un documento puntual — esos se capturan en
    // Fase 1 y SÍ cuentan como tanda completada con errores, otro camino,
    // no este. `batchHtmlToPdf` no tiene try/catch propio: un fallo ahí
    // propaga tal cual.
    const { batchHtmlToPdf } = jest.requireMock('@/lib/html-to-pdf') as {
      batchHtmlToPdf: jest.Mock;
    };
    batchHtmlToPdf.mockRejectedValueOnce(
      new Error('Chromium caído a mitad de la tanda 2'),
    );

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['auto-admision'],
      requestId: 'req-1',
      isFinalTanda: true,
    });

    expect(result.success).toBe(false);
    // Se intentó continuar la MISMA solicitud, no se reclamó una nueva.
    expect(mockContinueOrResume).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'case-1', kind: 'BATCH', requestId: 'req-1' }),
    );
    expect(mockClaim).not.toHaveBeenCalled();
    // El fallo libera el lock para poder reintentar — nunca acumula ni
    // finaliza sobre un resultado a medias.
    expect(mockFail).toHaveBeenCalledWith('req-1', expect.any(Error));
    expect(mockRecordProgress).not.toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('reintento de la tanda 2 (mismo requestId, ahora exitoso): acumula SOLO lo de esta tanda, no reprocesa la 1', async () => {
    mockContinueOrResume.mockResolvedValue({ ok: true });

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['auto-admision'],
      requestId: 'req-1',
      isFinalTanda: true,
    });

    expect(result.success).toBe(true);
    // Un solo documento creado: el de ESTA tanda. La tanda 1 (otro test, otra
    // invocación del server action) no se vuelve a ejecutar — este test ni
    // siquiera le pasa `templateIds` de la tanda 1.
    expect(mockPrisma.document.create).toHaveBeenCalledTimes(1);
    expect(mockRecordProgress).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({ total: 1, success: 1, errors: 0 }),
    );
    // Es la tanda final: cierra la solicitud sobre el acumulado de TODAS las
    // tandas (que vive en la fila, no en esta llamada).
    expect(mockFinalize).toHaveBeenCalledWith('req-1');
    expect(mockFail).not.toHaveBeenCalled();
  });

  it('conflicto al continuar: otra operación tiene el lock — no se reclama uno nuevo ni se genera nada', async () => {
    mockContinueOrResume.mockResolvedValue({
      ok: false,
      error: 'Ya hay otra generación en curso para este caso',
    });

    const result = await batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['auto-admision'],
      requestId: 'req-1',
      isFinalTanda: true,
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockRecordProgress).not.toHaveBeenCalled();
  });
});
