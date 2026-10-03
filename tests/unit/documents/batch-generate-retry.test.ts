/**
 * Unit test: reintentos en la ruta manual de generación de documentos
 * (`batchGenerateDocuments`, la que usan los operadores desde /documents).
 *
 * Backlog anotado en CLAUDE.md (sección "Next Sessions" / Fase 2): la ruta
 * automática envuelve la subida a Drive en `withRetry` (backoff exponencial);
 * la manual no tenía ninguno — un fallo transitorio de Drive se traducía en
 * un documento que no se subió, sin reintento.
 *
 * `withRetry` NO se mockea acá a propósito (a diferencia de
 * generate-documents-pipeline.test.ts): lo que este test prueba es que el
 * reintento real ocurre, no solo que se llama a la función.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'root-folder-id';

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

jest.mock('@/features/document/generation-request', () => ({
  claimGenerationRequest: jest.fn().mockResolvedValue({
    claimed: true,
    request: { id: 'req-1', kind: 'BATCH', status: 'PROCESSING' },
  }),
  markGenerationProcessing: jest.fn().mockResolvedValue(undefined),
  completeGenerationRequest: jest.fn().mockResolvedValue(undefined),
  failGenerationRequest: jest.fn().mockResolvedValue(undefined),
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

// Fase 1 (lectura + render de plantilla) fuera de alcance de este test: se
// deja fija para llegar determinísticamente a la Fase 3 (subida).
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
  batchHtmlToPdf: jest.fn().mockResolvedValue([
    { filename: 'solicitud-insolvencia.pdf', buffer: Buffer.from('pdf') },
  ]),
}));

const mockUploadDocumentToCase = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    listFoldersAndFiles: jest.fn().mockResolvedValue({
      folders: [{ id: 'docgen-id', name: 'documentos-generados' }],
      files: [],
    }),
    createFolder: jest.fn().mockResolvedValue('new-folder-id'),
    createFolderHierarchy: jest.fn().mockResolvedValue('center-folder-id'),
    findOrCreateCaseFolder: jest.fn().mockResolvedValue('case-folder-id'),
    getFolderUrl: jest.fn((id: string) => `https://drive.example/folder/${id}`),
    getFileUrl: jest.fn((id: string) => `https://drive.example/file/${id}`),
    uploadDocumentToCase: (...args: unknown[]) =>
      mockUploadDocumentToCase(...args),
  },
}));

import { ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { batchGenerateDocuments } from '@/features/document/actions';

// 'armonia' en vez de TENANT.id (fixture compartido): resolveCenterFolderName
// solo reconoce los tenants reales de CENTRO_BY_TENANT, y 'tenant-test-id'
// no es uno — con ese id la función fallaba antes de llegar a Drive,
// enmascarado en los otros tests porque no revisan `result.data`.
const TENANT_ID = 'armonia';

describe('batchGenerateDocuments — reintentos en la subida a Drive (ruta manual)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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
      Promise.resolve({ id: 'doc-1', ...data }),
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('un fallo transitorio de Drive se recupera con reintento (antes se perdía sin avisar)', async () => {
    mockUploadDocumentToCase
      .mockRejectedValueOnce(new Error('ETIMEDOUT: Drive no respondió'))
      .mockResolvedValueOnce({
        fileId: 'file-1',
        fileUrl: 'https://drive.example/file/file-1',
      });

    const resultPromise = batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['solicitud-insolvencia'],
      outputFormat: 'pdf',
    });

    // El backoff default de withRetry es 500ms para el 1er reintento.
    await jest.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(mockUploadDocumentToCase).toHaveBeenCalledTimes(2);

    const data = result.data as {
      documents: Array<{ status: string; documentUrl: string }>;
    };
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].status).toBe('success');
    expect(data.documents[0].documentUrl).toBe(
      'https://drive.example/file/file-1',
    );

    // El registro en BD también tiene que llevar la URL del reintento
    // exitoso, no quedar con url vacía.
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: 'https://drive.example/file/file-1',
          googleDriveId: 'file-1',
        }),
      }),
    );
  });

  it('agotados los reintentos, el documento queda registrado sin URL pero no rompe el lote', async () => {
    mockUploadDocumentToCase.mockRejectedValue(
      new Error('ETIMEDOUT: Drive no respondió'),
    );

    const resultPromise = batchGenerateDocuments({
      caseId: 'case-1',
      templateIds: ['solicitud-insolvencia'],
      outputFormat: 'pdf',
    });

    // 3 intentos default: 1ro inmediato, 2do a los 500ms, 3ro a los 1000ms.
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(mockUploadDocumentToCase).toHaveBeenCalledTimes(3);

    const data = result.data as {
      documents: Array<{ status: string; documentUrl: string }>;
    };
    expect(data.documents).toHaveLength(1);
    // Se agota el reintento, no el lote: el documento queda igual que antes
    // de este cambio (registrado, sin URL), no lanza ni bloquea el resto.
    expect(data.documents[0].status).toBe('success');
    expect(data.documents[0].documentUrl).toBe('');
  });
});
