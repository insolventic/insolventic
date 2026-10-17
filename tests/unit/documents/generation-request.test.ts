/**
 * Unit Tests: DocumentGenerationRequest lock (P3 anti-duplicados)
 * src/features/document/generation-request.ts
 *
 * El lock real es el unique index de Postgres sobre activeKey; aquí se
 * simula la violación (P2002) con el mock de Prisma para verificar el
 * comportamiento del claim ante carreras, locks huérfanos y liberación.
 */

import mockPrisma from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

import { Prisma } from '@prisma/client';
import {
  claimGenerationRequest,
  completeGenerationRequest,
  failGenerationRequest,
  continueOrResumeGenerationRequest,
  recordBatchTandaProgress,
  finalizeBatchGenerationRequest,
  STALE_GENERATION_TIMEOUT_MS,
} from '@/features/document/generation-request';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

const baseRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'req-1',
  tenantId: 'tenant-1',
  caseId: 'case-1',
  kind: 'INITIAL',
  status: 'PENDING',
  activeKey: 'case-1:INITIAL',
  requestedById: 'user-1',
  error: null,
  totalDocuments: 0,
  successCount: 0,
  errorCount: 0,
  createdAt: new Date(),
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('claimGenerationRequest — P3 lock anti-duplicados', () => {
  it('obtiene el lock cuando no hay solicitud activa', async () => {
    mockPrisma.documentGenerationRequest.create.mockResolvedValueOnce(
      baseRow(),
    );

    const result = await claimGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'INITIAL',
      requestedById: 'user-1',
    });

    expect(result.claimed).toBe(true);
    expect(result.request.id).toBe('req-1');
    expect(mockPrisma.documentGenerationRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        kind: 'INITIAL',
        status: 'PENDING',
        activeKey: 'case-1:INITIAL',
      }),
    });
  });

  it('devuelve la solicitud existente cuando ya hay una activa (409 semántico)', async () => {
    mockPrisma.documentGenerationRequest.create.mockRejectedValueOnce(p2002());
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'req-existente', status: 'PROCESSING' }),
    );

    const result = await claimGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'INITIAL',
    });

    expect(result.claimed).toBe(false);
    expect(result.request.id).toBe('req-existente');
    expect(result.request.status).toBe('PROCESSING');
  });

  it('race condition: 5 claims simultáneos → 1 gana, 4 reciben el requestId del ganador', async () => {
    const winner = baseRow({ id: 'req-ganador' });
    // El primero en llegar crea la fila; los otros 4 chocan con el unique index.
    mockPrisma.documentGenerationRequest.create
      .mockResolvedValueOnce(winner)
      .mockRejectedValue(p2002());
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValue(winner);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimGenerationRequest({
          tenantId: 'tenant-1',
          caseId: 'case-1',
          kind: 'INITIAL',
        }),
      ),
    );

    const claimed = results.filter((r) => r.claimed);
    const rejected = results.filter((r) => !r.claimed);
    expect(claimed).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const r of results) {
      expect(r.request.id).toBe('req-ganador');
    }
  });

  it('recupera locks huérfanos: solicitud activa más vieja que el timeout se libera y se re-reclama', async () => {
    const stale = baseRow({
      id: 'req-huerfana',
      createdAt: new Date(Date.now() - STALE_GENERATION_TIMEOUT_MS - 1000),
    });
    mockPrisma.documentGenerationRequest.create
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce(baseRow({ id: 'req-nueva' }));
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      stale,
    );
    mockPrisma.documentGenerationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await claimGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'INITIAL',
    });

    expect(result.claimed).toBe(true);
    expect(result.request.id).toBe('req-nueva');
    // La huérfana se liberó condicionalmente (activeKey en el where)
    expect(
      mockPrisma.documentGenerationRequest.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: 'req-huerfana', activeKey: 'case-1:INITIAL' },
      data: expect.objectContaining({ status: 'FAILED', activeKey: null }),
    });
  });

  it('propaga errores que no son violación de unicidad', async () => {
    mockPrisma.documentGenerationRequest.create.mockRejectedValueOnce(
      new Error('connection refused'),
    );

    await expect(
      claimGenerationRequest({
        tenantId: 'tenant-1',
        caseId: 'case-1',
        kind: 'INITIAL',
      }),
    ).rejects.toThrow('connection refused');
  });
});

describe('complete / fail — liberación del lock', () => {
  it('completeGenerationRequest libera el lock y registra conteos', async () => {
    await completeGenerationRequest('req-1', {
      total: 6,
      success: 6,
      errors: 0,
    });

    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        activeKey: null,
        totalDocuments: 6,
        successCount: 6,
        errorCount: 0,
      }),
    });
  });

  it('marca COMPLETED_WITH_ERRORS cuando hubo fallos parciales', async () => {
    await completeGenerationRequest('req-1', {
      total: 6,
      success: 4,
      errors: 2,
    });

    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED_WITH_ERRORS' }),
      }),
    );
  });

  it('failGenerationRequest libera el lock, trunca el mensaje y permite reintento', async () => {
    await failGenerationRequest('req-1', new Error('x'.repeat(900)));

    const call = mockPrisma.documentGenerationRequest.update.mock.calls[0][0];
    expect(call.data.status).toBe('FAILED');
    expect(call.data.activeKey).toBeNull();
    expect((call.data.error as string).length).toBeLessThanOrEqual(500);
  });
});

describe('continueOrResumeGenerationRequest — GD-A1, tandas sobre una sola solicitud', () => {
  it('continúa una tanda normal: la solicitud ya está PROCESSING con el lock de este caso', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({
        id: 'req-1',
        kind: 'BATCH',
        status: 'PROCESSING',
        activeKey: 'case-1:BATCH',
      }),
    );

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    // No reclama nada de nuevo — solo valida.
    expect(mockPrisma.documentGenerationRequest.updateMany).not.toHaveBeenCalled();
  });

  it('retoma una tanda que FAILED: re-activa el lock sobre la misma fila, sin crear una nueva', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({
        id: 'req-1',
        kind: 'BATCH',
        status: 'FAILED',
        activeKey: null,
        totalDocuments: 10,
        successCount: 10,
        errorCount: 0,
      }),
    );
    mockPrisma.documentGenerationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    expect(
      mockPrisma.documentGenerationRequest.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: 'req-1', activeKey: null },
      data: expect.objectContaining({
        activeKey: 'case-1:BATCH',
        status: 'PROCESSING',
        error: null,
      }),
    });
    expect(mockPrisma.documentGenerationRequest.create).not.toHaveBeenCalled();
  });

  it('retoma una tanda COMPLETED_WITH_ERRORS (reintento parcial)', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({
        id: 'req-1',
        kind: 'BATCH',
        status: 'COMPLETED_WITH_ERRORS',
        activeKey: null,
      }),
    );
    mockPrisma.documentGenerationRequest.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
  });

  it('conflicto: otra operación ya tomó el lock de este caso/kind mientras se reintentaba', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'req-1', kind: 'BATCH', status: 'FAILED', activeKey: null }),
    );
    mockPrisma.documentGenerationRequest.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(false);
  });

  it('rechaza una solicitud ya COMPLETED: no se puede continuar lo que ya terminó', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'req-1', kind: 'BATCH', status: 'COMPLETED', activeKey: null }),
    );

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(false);
  });

  it('rechaza un requestId de otro tenant/caso/kind (aislamiento)', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ id: 'req-1', tenantId: 'tenant-ajeno', kind: 'BATCH' }),
    );

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(false);
  });

  it('rechaza un requestId inexistente', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(null);

    const result = await continueOrResumeGenerationRequest({
      tenantId: 'tenant-1',
      caseId: 'case-1',
      kind: 'BATCH',
      requestId: 'req-fantasma',
    });

    expect(result.ok).toBe(false);
  });
});

describe('recordBatchTandaProgress — GD-A1, acumula sin sobrescribir', () => {
  it('incrementa los 3 conteos, no los reemplaza', async () => {
    await recordBatchTandaProgress('req-1', { total: 5, success: 4, errors: 1 });

    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: {
        totalDocuments: { increment: 5 },
        successCount: { increment: 4 },
        errorCount: { increment: 1 },
      },
    });
  });

  it('no toca status ni activeKey — el lock sigue tomado entre tandas', async () => {
    await recordBatchTandaProgress('req-1', { total: 1, success: 1, errors: 0 });

    const call = mockPrisma.documentGenerationRequest.update.mock.calls[0][0];
    expect(call.data.status).toBeUndefined();
    expect(call.data.activeKey).toBeUndefined();
  });
});

describe('finalizeBatchGenerationRequest — GD-A1, cierre sobre el total acumulado', () => {
  it('COMPLETED cuando el total acumulado no tuvo errores', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ totalDocuments: 20, successCount: 20, errorCount: 0 }),
    );

    await finalizeBatchGenerationRequest('req-1');

    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({ status: 'COMPLETED', activeKey: null }),
    });
  });

  it('COMPLETED_WITH_ERRORS cuando alguna tanda tuvo errores', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ totalDocuments: 20, successCount: 18, errorCount: 2 }),
    );

    await finalizeBatchGenerationRequest('req-1');

    expect(mockPrisma.documentGenerationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED_WITH_ERRORS' }),
      }),
    );
  });

  it('libera el lock y marca finishedAt', async () => {
    mockPrisma.documentGenerationRequest.findUnique.mockResolvedValueOnce(
      baseRow({ totalDocuments: 1, successCount: 1, errorCount: 0 }),
    );

    await finalizeBatchGenerationRequest('req-1');

    const call = mockPrisma.documentGenerationRequest.update.mock.calls[0][0];
    expect(call.data.activeKey).toBeNull();
    expect(call.data.finishedAt).toBeInstanceOf(Date);
  });
});
