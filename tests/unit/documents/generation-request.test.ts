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
