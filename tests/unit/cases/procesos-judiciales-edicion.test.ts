/**
 * Procesos judiciales en la edición de un caso.
 *
 * - El plan de cambios: crear, actualizar, eliminar solo lo quitado, rechazar
 *   ids ajenos al caso, y exigir confirmación si hay documentos que los citan.
 * - updateCase: lo aplica dentro de la transacción, después del chequeo de
 *   versión, con el tenant en cada operación, y audita cada eliminación.
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
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

import { P } from '@/lib/permissions';
import { updateCase } from '@/features/case/actions';
import {
  ERROR_FALTA_CONFIRMACION,
  ERROR_PROCESO_AJENO,
  ERROR_PROCESO_CONTRADICTORIO,
  NOMBRES_DOCUMENTOS_QUE_CITAN_PROCESOS,
  documentoCitaProcesos,
  planificarCambiosDeProcesos,
} from '@/features/case/procesos-judiciales';
import { ALL_TEMPLATES } from '@/features/document/templates-config';

const proceso = (extra: Record<string, unknown> = {}) => ({
  processType: 'EJECUTIVO_SINGULAR',
  plaintiff: 'Banco X',
  court: 'Juzgado 5 Civil Municipal',
  fileNumber: '2025-001',
  ...extra,
});

const EXISTENTES = [
  {
    id: 'lp-1',
    court: 'Juzgado 5 Civil Municipal',
    processType: 'EJECUTIVO_SINGULAR',
  },
  {
    id: 'lp-2',
    court: 'Juzgado 9 Civil del Circuito',
    processType: 'HIPOTECARIO',
  },
];

describe('documentoCitaProcesos', () => {
  it('los nombres coinciden con templates-config', () => {
    const nombres = ALL_TEMPLATES.filter((t) =>
      ['solicitud-insolvencia', 'suspension-juzgados'].includes(t.id),
    ).map((t) => t.name);
    expect([...NOMBRES_DOCUMENTOS_QUE_CITAN_PROCESOS].sort()).toEqual(
      nombres.sort(),
    );
  });

  it.each([
    [{ name: 'Solicitud de Insolvencia', isGenerated: true }, true],
    [
      { name: 'Suspension Juzgados — Juzgado 5 Civil', isGenerated: true },
      true,
    ],
    [{ name: 'Suspension Juzgados', isGenerated: true }, true],
    [{ name: 'Solicitud de Insolvencia', isGenerated: false }, false],
    [{ name: 'Designacion del Conciliador', isGenerated: true }, false],
  ])('%o → %p', (doc, esperado) => {
    expect(documentoCitaProcesos(doc)).toBe(esperado);
  });
});

describe('planificarCambiosDeProcesos', () => {
  const base = {
    existentes: EXISTENTES,
    eliminados: [] as string[],
    confirmados: [] as string[],
    hayDocumentosQueCitan: false,
  };

  it('crea las filas sin id y actualiza las que traen uno', () => {
    const plan = planificarCambiosDeProcesos({
      ...base,
      entrada: [
        proceso({ id: 'lp-1', originCourt: 'Juzgado 1' }),
        proceso({ court: 'Nuevo' }),
      ],
    });
    expect(plan).toMatchObject({ ok: true, totalFinal: 3 });
    if (plan.ok) {
      expect(plan.actualizar.map((p) => p.id)).toEqual(['lp-1']);
      expect(plan.crear.map((p) => p.court)).toEqual(['Nuevo']);
      expect(plan.eliminar).toEqual([]);
    }
  });

  it('solo elimina lo quitado explícitamente; lo que no llega no se toca', () => {
    const plan = planificarCambiosDeProcesos({
      ...base,
      entrada: [],
      eliminados: ['lp-2'],
    });
    expect(plan).toMatchObject({ ok: true, totalFinal: 1 });
    if (plan.ok) expect(plan.eliminar.map((e) => e.id)).toEqual(['lp-2']);
  });

  it('rechaza un id que no es de este caso (otro caso u otro centro)', () => {
    expect(
      planificarCambiosDeProcesos({
        ...base,
        entrada: [proceso({ id: 'ajeno' })],
      }),
    ).toEqual({ ok: false, error: ERROR_PROCESO_AJENO });
    expect(
      planificarCambiosDeProcesos({
        ...base,
        entrada: [],
        eliminados: ['ajeno'],
      }),
    ).toEqual({ ok: false, error: ERROR_PROCESO_AJENO });
  });

  it('rechaza editar y eliminar el mismo proceso', () => {
    expect(
      planificarCambiosDeProcesos({
        ...base,
        entrada: [proceso({ id: 'lp-1' })],
        eliminados: ['lp-1'],
      }),
    ).toEqual({ ok: false, error: ERROR_PROCESO_CONTRADICTORIO });
  });

  it('con documentos que citan procesos, eliminar exige confirmación por id', () => {
    const conDocs = { ...base, hayDocumentosQueCitan: true, entrada: [] };
    expect(
      planificarCambiosDeProcesos({ ...conDocs, eliminados: ['lp-1'] }),
    ).toEqual({
      ok: false,
      error: ERROR_FALTA_CONFIRMACION,
    });
    expect(
      planificarCambiosDeProcesos({
        ...conDocs,
        eliminados: ['lp-1'],
        confirmados: ['lp-1'],
      }),
    ).toMatchObject({ ok: true, totalFinal: 1 });
  });
});

describe('updateCase — procesos judiciales', () => {
  const payload = {
    id: 'case-1',
    version: 3,
    debtorId: 'debtor-1',
    operatorId: 'user-1',
    type: 'INSOLVENCY' as const,
    creditors: 1,
  };

  const errorDe = async (input: Record<string, unknown>) => {
    const r = await updateCase({ ...payload, ...input } as never);
    return r.error;
  };

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-del-centro' });
    mockPrisma.debtor.findFirst.mockResolvedValue({ id: 'debtor-1' });
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Operadora',
        professionalCard: 'TP-1',
        permissions: [P.EDITAR_CASOS, P.VER_TODOS_CASOS],
      },
      tenantId: 'tenant-1',
    });
    mockPrisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      tenantId: 'tenant-1',
      version: 3,
      phase: 'Inicial',
      filingDate: null,
      createdDate: new Date('2026-03-01T12:00:00Z'),
    });
    mockPrisma.case.update.mockResolvedValue({
      id: 'case-1',
      caseNumber: 'INSOL-000001',
      debtorName: 'Ana Torres',
      type: 'INSOLVENCY',
      totalDebt: 0,
      creditors: 1,
      phase: 'Inicial',
      createdDate: new Date(),
      operatorId: 'user-1',
      tenantId: 'tenant-1',
    });
    mockPrisma.legalProcess.findMany.mockResolvedValue(EXISTENTES);
    mockPrisma.document.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('crea y actualiza dentro del caso y del centro', async () => {
    await updateCase({
      ...payload,
      legalProcesses: [
        proceso({ id: 'lp-1', originCourt: 'Juzgado 1 Civil del Circuito' }),
        proceso({ court: 'Juzgado 3 Civil' }),
      ],
    } as never);

    expect(mockPrisma.legalProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { caseId: 'case-1', tenantId: 'tenant-1' },
      }),
    );
    expect(mockPrisma.legalProcess.updateMany).toHaveBeenCalledWith({
      where: { id: 'lp-1', caseId: 'case-1', tenantId: 'tenant-1' },
      data: expect.objectContaining({
        originCourt: 'Juzgado 1 Civil del Circuito',
      }),
    });
    expect(mockPrisma.legalProcess.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          court: 'Juzgado 3 Civil',
          caseId: 'case-1',
          tenantId: 'tenant-1',
        }),
      ],
    });
    expect(mockPrisma.legalProcess.deleteMany).not.toHaveBeenCalled();
    const data = (mockPrisma.case.update as jest.Mock).mock.calls[0][0].data;
    expect(data.hasLegalProcesses).toBe(true);
    expect(data).not.toHaveProperty('legalProcesses');
  });

  it('elimina sin documentos generados: permitido, sin confirmación, y auditado', async () => {
    const r = await updateCase({
      ...payload,
      legalProcesses: [proceso({ id: 'lp-1' })],
      legalProcessesEliminados: ['lp-2'],
    } as never);

    // El mock devuelve una fila parcial y el schema de salida puede rechazarla
    // DESPUÉS de escribir; lo que se mira aquí son las escrituras.
    expect(r.error ?? '').not.toBe(ERROR_FALTA_CONFIRMACION);
    expect(mockPrisma.legalProcess.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['lp-2'] }, caseId: 'case-1', tenantId: 'tenant-1' },
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updated',
        entityType: 'case',
        entityId: 'case-1',
        actor: expect.objectContaining({ userId: 'user-1' }),
        tenantId: 'tenant-1',
        metadata: {
          evento: 'proceso_judicial_eliminado',
          procesoId: 'lp-2',
          tipoProceso: 'HIPOTECARIO',
          juzgado: 'Juzgado 9 Civil del Circuito',
          conDocumentosGenerados: false,
        },
      }),
    );
  });

  it('con documentos que lo citan y sin confirmar: rechazado, no borra nada', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      { name: 'Solicitud de Insolvencia', isGenerated: true },
    ]);

    expect(await errorDe({ legalProcessesEliminados: ['lp-2'] })).toBe(
      ERROR_FALTA_CONFIRMACION,
    );
    expect(mockPrisma.legalProcess.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.case.update).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('con documentos que lo citan y confirmado: permitido y auditado', async () => {
    mockPrisma.document.findMany.mockResolvedValue([
      {
        name: 'Suspension Juzgados — Juzgado 9 Civil del Circuito',
        isGenerated: true,
      },
    ]);

    await updateCase({
      ...payload,
      legalProcessesEliminados: ['lp-2'],
      legalProcessesEliminacionConfirmada: ['lp-2'],
    } as never);

    expect(mockPrisma.legalProcess.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          evento: 'proceso_judicial_eliminado',
          procesoId: 'lp-2',
          conDocumentosGenerados: true,
        }),
      }),
    );
  });

  it('rechaza un proceso de otro centro (no aparece entre los de este caso y tenant)', async () => {
    // Los procesos del caso se leen con el tenant de la sesión: un id de otro
    // centro no está en esa lista.
    expect(
      await errorDe({ legalProcesses: [proceso({ id: 'lp-de-otro-centro' })] }),
    ).toBe(ERROR_PROCESO_AJENO);
    expect(
      await errorDe({ legalProcessesEliminados: ['lp-de-otro-centro'] }),
    ).toBe(ERROR_PROCESO_AJENO);
    expect(mockPrisma.legalProcess.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.legalProcess.deleteMany).not.toHaveBeenCalled();
  });

  it('versión desactualizada: rechaza antes de tocar los procesos', async () => {
    expect(
      await errorDe({ version: 2, legalProcesses: [proceso({ id: 'lp-1' })] }),
    ).toMatch(/modificado por otro usuario/);
    expect(mockPrisma.legalProcess.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.legalProcess.updateMany).not.toHaveBeenCalled();
  });

  it('una edición sin procesos (p. ej. el formulario de pre-generación) no los toca', async () => {
    await updateCase(payload as never);
    expect(mockPrisma.legalProcess.findMany).not.toHaveBeenCalled();
    const data = (mockPrisma.case.update as jest.Mock).mock.calls[0][0].data;
    expect(data).not.toHaveProperty('hasLegalProcesses');
  });

  it('si quedan cero procesos, hasLegalProcesses pasa a false (sin regla que lo bloquee)', async () => {
    await updateCase({
      ...payload,
      hasLegalProcesses: true,
      legalProcesses: [],
      legalProcessesEliminados: ['lp-1', 'lp-2'],
    } as never);
    const data = (mockPrisma.case.update as jest.Mock).mock.calls[0][0].data;
    expect(data.hasLegalProcesses).toBe(false);
  });
});
