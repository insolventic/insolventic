/**
 * Edición de procesos judiciales contra Postgres REAL: updateCase crea,
 * actualiza y elimina procesos del caso dentro de su transacción; exige la
 * confirmación para eliminar cuando hay documentos generados que los citan;
 * audita cada eliminación; rechaza procesos de otro centro y versiones
 * desactualizadas; y la Solicitud generada desde la base refleja el cambio.
 */

jest.mock('next/headers', () => require('../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../__mocks__/next-cache'));

const mockAfter = jest.fn();
jest.mock('next/server', () => ({
  after: (...args: unknown[]) => mockAfter(...args),
}));
jest.mock('@/features/document/generation-job', () => ({
  runInitialGenerationJob: jest.fn(),
}));

import fs from 'fs';

import prisma from '@/lib/prisma';
import { createCase, updateCase } from '@/features/case/actions';
import { createCaseFormSchema } from '@/features/case/schemas';
import {
  ERROR_FALTA_CONFIRMACION,
  ERROR_PROCESO_AJENO,
} from '@/features/case/procesos-judiciales';
import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  asCaseWithRelations,
  fetchCaseForGeneration,
} from '@/features/document/persistence';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { _resetRateLimitStore } from '@/lib/rate-limit';
import { mockCookies } from '../__mocks__/next-headers';

import {
  crearTenantDePrueba,
  purgeTenant,
  wizardSubmit,
} from './helpers/tenant';

const TAG = `procedit-${Date.now().toString(36)}`;
const A = { tenantId: '', userId: '', token: '', debtorId: '' };
const B = { tenantId: '', userId: '', token: '', debtorId: '' };

const proceso = (court: string, extra: Record<string, unknown> = {}) => ({
  processType: 'EJECUTIVO_SINGULAR',
  plaintiff: 'Banco de Prueba S.A.',
  court,
  fileNumber: `66001-${court.length}`,
  ...extra,
});

async function crearCaso(ctx: typeof A, procesos: unknown[]) {
  mockCookies.setToken('access-token', ctx.token);
  const parsed = createCaseFormSchema.parse({
    debtorId: ctx.debtorId,
    operatorId: ctx.userId,
    type: 'INSOLVENCY',
    totalDebt: '45200000',
    creditors: 1,
    phase: 'Inicial',
    caseNumber: '',
    hearingDate: null,
    causes: ['SOBREENDEUDAMIENTO'],
    filingDate: '2026-03-04',
    monthlyIncome: 1800000,
    monthlyExpenses: 1450000,
    debts: [
      {
        creditor: 'Banco Falabella S.A.',
        type: 'TARJETA_CREDITO',
        interestRate: '2.35',
        capitalAmount: '41200000',
        interestAmount: '4000000',
      },
    ],
    assets: [],
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    legalProcesses: procesos,
    apoderados: [],
  }) as Record<string, unknown>;
  const r = await createCase(wizardSubmit(parsed) as never);
  if (!r.success) throw new Error(r.error);
  return r.data!.id;
}

async function editar(caseId: string, cambios: Record<string, unknown>) {
  mockCookies.setToken('access-token', A.token);
  const caso = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  return updateCase({
    id: caseId,
    version: caso.version,
    debtorId: caso.debtorId,
    type: 'INSOLVENCY',
    creditors: 1,
    ...cambios,
  } as never);
}

const procesosDe = (caseId: string) =>
  prisma.legalProcess.findMany({
    where: { caseId },
    orderBy: { court: 'asc' },
  });

async function deudor(ctx: typeof A, sufijo: string) {
  const d = await prisma.debtor.create({
    data: {
      name: `Deudor ${sufijo}`,
      idNumber: `${sufijo}-${TAG}`,
      idType: 'CC',
      email: `deudor-${sufijo}-${TAG}@correoejemplo.test`,
      phone: '3001112233',
      address: 'Calle 1 # 2-3',
      city: 'Pereira',
      department: 'Risaralda',
      occupation: 'Comerciante',
      monthlyIncome: 1800000,
      totalDebt: 0,
      activeCases: 0,
      maritalStatus: 'Soltero(a)',
      tenantId: ctx.tenantId,
    },
  });
  ctx.debtorId = d.id;
}

beforeEach(() => _resetRateLimitStore());

beforeAll(async () => {
  for (const [ctx, sufijo] of [
    [A, 'a'],
    [B, 'b'],
  ] as const) {
    const t = await crearTenantDePrueba(`${TAG}-${sufijo}`);
    ctx.tenantId = t.tenantId;
    ctx.userId = t.userId;
    ctx.token = t.token;
    await deudor(ctx, sufijo);
  }
});

afterAll(async () => {
  for (const ctx of [A, B]) if (ctx.tenantId) await purgeTenant(ctx.tenantId);
  await prisma.$disconnect();
});

describe('editar procesos judiciales', () => {
  it('actualiza el juzgado de origen, agrega uno y quita otro (sin documentos)', async () => {
    const caseId = await crearCaso(A, [
      proceso('Juzgado 1 Civil'),
      proceso('Juzgado 2 Civil'),
    ]);
    const [p1, p2] = await procesosDe(caseId);

    const r = await editar(caseId, {
      legalProcesses: [
        proceso('Juzgado 1 Civil', {
          id: p1.id,
          originCourt: 'Juzgado 7 Civil del Circuito',
        }),
        proceso('Juzgado 3 Civil'),
      ],
      legalProcessesEliminados: [p2.id],
    });
    expect(r.error).toBeUndefined();

    const despues = await procesosDe(caseId);
    expect(despues.map((p) => [p.court, p.originCourt])).toEqual([
      ['Juzgado 1 Civil', 'Juzgado 7 Civil del Circuito'],
      ['Juzgado 3 Civil', null],
    ]);
    expect(despues.find((p) => p.id === p1.id)).toBeDefined();
    const caso = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(caso.hasLegalProcesses).toBe(true);

    // La Solicitud generada desde la base muestra el juzgado de origen nuevo.
    const datos = asCaseWithRelations(
      (await fetchCaseForGeneration(caseId, A.tenantId))!,
    );
    const t = ALL_TEMPLATES.find((x) => x.id === 'solicitud-insolvencia')!;
    const { html } = renderDocumentHtml(
      fs.readFileSync(getTemplatePath(t), 'utf8'),
      mapCaseToPlaceholders(datos),
      buildTemplateContext(datos),
    );
    expect(html).toContain(
      'Juzgado 1 Civil (juzgado de origen: Juzgado 7 Civil del Circuito)',
    );

    const auditoria = await prisma.auditLog.findMany({
      where: { entityId: caseId, tenantId: A.tenantId },
    });
    const eliminaciones = auditoria.filter(
      (a) =>
        (a.metadata as Record<string, unknown> | null)?.evento ===
        'proceso_judicial_eliminado',
    );
    expect(eliminaciones).toHaveLength(1);
    expect(eliminaciones[0].metadata).toMatchObject({
      procesoId: p2.id,
      juzgado: 'Juzgado 2 Civil',
      conDocumentosGenerados: false,
    });
    expect(eliminaciones[0].userId).toBe(A.userId);
  });

  it('con un documento generado que los cita: sin confirmar se rechaza; confirmado se elimina y audita', async () => {
    const caseId = await crearCaso(A, [
      proceso('Juzgado 4 Civil'),
      proceso('Juzgado 5 Civil'),
    ]);
    const [p4] = await procesosDe(caseId);
    await prisma.document.create({
      data: {
        name: 'Suspension Juzgados — Juzgado 4 Civil',
        type: 'generated',
        status: 'completed',
        url: 'https://drive.test/x',
        caseId,
        tenantId: A.tenantId,
        isGenerated: true,
      },
    });

    const sinConfirmar = await editar(caseId, {
      legalProcessesEliminados: [p4.id],
    });
    expect(sinConfirmar.error).toBe(ERROR_FALTA_CONFIRMACION);
    expect(await procesosDe(caseId)).toHaveLength(2);

    const confirmado = await editar(caseId, {
      legalProcessesEliminados: [p4.id],
      legalProcessesEliminacionConfirmada: [p4.id],
    });
    expect(confirmado.error).toBeUndefined();
    expect((await procesosDe(caseId)).map((p) => p.court)).toEqual([
      'Juzgado 5 Civil',
    ]);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: caseId },
    });
    expect(
      audit.some(
        (a) =>
          (a.metadata as Record<string, unknown> | null)?.procesoId === p4.id &&
          (a.metadata as Record<string, unknown> | null)
            ?.conDocumentosGenerados === true,
      ),
    ).toBe(true);
  });

  it('rechaza editar o quitar un proceso de otro centro, y no lo toca', async () => {
    const casoB = await crearCaso(B, [proceso('Juzgado de B')]);
    const [pB] = await procesosDe(casoB);
    const casoA = await crearCaso(A, [proceso('Juzgado de A')]);

    const editarAjeno = await editar(casoA, {
      legalProcesses: [proceso('Juzgado hackeado', { id: pB.id })],
    });
    expect(editarAjeno.error).toBe(ERROR_PROCESO_AJENO);
    const quitarAjeno = await editar(casoA, {
      legalProcessesEliminados: [pB.id],
    });
    expect(quitarAjeno.error).toBe(ERROR_PROCESO_AJENO);

    const intacto = await prisma.legalProcess.findUniqueOrThrow({
      where: { id: pB.id },
    });
    expect(intacto.court).toBe('Juzgado de B');
    expect(intacto.caseId).toBe(casoB);
  });

  it('con una versión desactualizada no toca los procesos', async () => {
    const caseId = await crearCaso(A, [proceso('Juzgado 6 Civil')]);
    const [p6] = await procesosDe(caseId);
    const caso = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });

    mockCookies.setToken('access-token', A.token);
    const r = await updateCase({
      id: caseId,
      version: caso.version - 1,
      debtorId: caso.debtorId,
      type: 'INSOLVENCY',
      creditors: 1,
      legalProcesses: [proceso('Juzgado cambiado', { id: p6.id })],
    } as never);
    expect(r.error).toMatch(/modificado por otro usuario/);
    expect((await procesosDe(caseId))[0].court).toBe('Juzgado 6 Civil');
  });
});
