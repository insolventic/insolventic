/**
 * Unit Tests: Job de generación en background (P4)
 * src/features/document/generation-job.ts
 *
 * Ciclo de vida: claim → PROCESSING → generate → persist → COMPLETED +
 * notificación; y camino de fallo → FAILED + notificación, sin lanzar.
 */

import mockPrisma from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

// Sentry lo alcanza SOLO el logger (entrega con flush); el job ya no lo llama
// directamente. Con DSN definido, logger.error captura de verdad y el mock
// cuenta cuántos eventos salen por cada fallo.
const mockCaptureException = jest.fn();
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));

beforeAll(() => {
  process.env.SENTRY_DSN = 'https://k@o1.ingest.sentry.io/1';
});

const mockGenerate = jest.fn();
jest.mock('@/features/document/generate-documents', () => ({
  generateDocumentsForNewCase: (...args: unknown[]) => mockGenerate(...args),
}));

jest.mock('@/lib/centro-conciliacion', () => ({
  resolveCenterFolderName: jest.fn().mockReturnValue('Centro Test'),
}));

import { runInitialGenerationJob } from '@/features/document/generation-job';

const CASE_ROW = {
  id: 'case-1',
  tenantId: 'tenant-1',
  caseNumber: 'INS-001',
  centroConciliacionNombre: null,
  debtor: { name: 'Juan Pérez' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runInitialGenerationJob — P4 background', () => {
  it('camino feliz: PROCESSING → genera → persiste → COMPLETED → notifica', async () => {
    mockPrisma.case.findUnique.mockResolvedValueOnce(CASE_ROW);
    mockGenerate.mockResolvedValueOnce({
      caseFolderId: 'folder-1',
      caseFolderUrl: 'https://drive/folder-1',
      documents: [
        {
          status: 'success',
          googleDriveId: 'f1',
          templateName: 'Doc A',
          googleDriveUrl: 'u1',
          fileName: 'a.pdf',
          templateId: 't1',
        },
        {
          status: 'success',
          googleDriveId: 'f2',
          templateName: 'Doc B',
          googleDriveUrl: 'u2',
          fileName: 'b.pdf',
          templateId: 't2',
        },
        {
          status: 'skipped',
          googleDriveId: '',
          templateName: 'Doc C',
          googleDriveUrl: '',
          fileName: '',
          templateId: 't3',
        },
      ],
    });

    const result = await runInitialGenerationJob({
      requestId: 'req-1',
      caseId: 'case-1',
      tenantId: 'tenant-1',
      requestedById: 'user-1',
    });

    expect(result).toEqual({
      total: 3,
      success: 2,
      errors: 0,
      caseFolderId: 'folder-1',
    });

    // PROCESSING al arrancar
    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      }),
    );
    // driveFolderId persistido en el caso
    expect(mockPrisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { driveFolderId: 'folder-1', layoutVersion: 1 },
      }),
    );
    // Documentos exitosos persistidos (createMany vía persistence.ts)
    expect(mockPrisma.document.createMany).toHaveBeenCalled();
    // COMPLETED con lock liberado
    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', activeKey: null }),
      }),
    );
    // Notificación in-app al solicitante
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          caseId: 'case-1',
          relatedId: 'req-1',
          type: 'document_generation',
        }),
      }),
    );
  });

  it('fallo: marca FAILED, libera lock, notifica y reporta a Sentry — sin lanzar', async () => {
    mockPrisma.case.findUnique.mockResolvedValueOnce(CASE_ROW);
    mockGenerate.mockRejectedValueOnce(new Error('Drive API down'));

    const result = await runInitialGenerationJob({
      requestId: 'req-2',
      caseId: 'case-1',
      tenantId: 'tenant-1',
      requestedById: 'user-1',
    });

    expect(result).toBeNull();
    // La captura del logger es asíncrona (import dinámico + flush).
    await new Promise((resolve) => setImmediate(resolve));
    // Exactamente UN evento por fallo (antes eran dos: logger + captura directa).
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Drive API down' }),
      expect.objectContaining({
        tags: { action: 'generation-job' },
        extra: expect.objectContaining({
          requestId: 'req-2',
          caseId: 'case-1',
        }),
      }),
    );
    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-2' },
        data: expect.objectContaining({
          status: 'FAILED',
          activeKey: null,
          error: 'Drive API down',
        }),
      }),
    );
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'document_generation_failed',
        }),
      }),
    );
  });

  it('caso inexistente: falla controladamente sin lanzar', async () => {
    mockPrisma.case.findUnique.mockResolvedValueOnce(null);

    const result = await runInitialGenerationJob({
      requestId: 'req-3',
      caseId: 'case-x',
      tenantId: 'tenant-1',
    });

    expect(result).toBeNull();
    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    // Sin requestedById no se intenta notificar
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
