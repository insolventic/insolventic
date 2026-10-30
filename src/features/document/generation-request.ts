/**
 * DocumentGenerationRequest — lock anti-duplicados (P3) + estado de job (P4).
 *
 * El lock es atómico a nivel de BD: la columna `activeKey` (única, nullable)
 * vale "{caseId}:{kind}" mientras la solicitud está activa y NULL al terminar.
 * Un segundo claim simultáneo choca con el unique index (P2002) y recibe la
 * solicitud ya activa en lugar de crear una duplicada.
 *
 * Módulo sin 'use server': lo consumen las server actions y el job.
 */

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { GeneratedDocument } from './generate-documents';

/**
 * Tipo de generación — una por caso puede estar activa a la vez.
 * BATCH cubre la generación manual por paquete desde /documents (C-4): era la
 * única ruta sin lock, así que dos operadores —o un doble click— duplicaban
 * archivos en Drive y filas en BD.
 */
export type GenerationKind =
  | 'INITIAL'
  | 'ADMISSION'
  | 'AGREEMENT'
  | 'FAILURE'
  | 'BATCH';

export type GenerationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export interface GenerationRequestSummary {
  id: string;
  kind: GenerationKind;
  status: GenerationStatus;
  totalDocuments: number;
  successCount: number;
  errorCount: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface ClaimResult {
  /** true: esta llamada obtuvo el lock y debe ejecutar la generación */
  claimed: boolean;
  /** Solicitud propia (claimed) o la ya activa de otra llamada (!claimed) */
  request: GenerationRequestSummary;
}

/**
 * Una solicitud activa más vieja que esto se considera huérfana (proceso
 * serverless muerto sin liberar el lock) y puede ser reclamada de nuevo.
 */
export const STALE_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

const activeKeyFor = (caseId: string, kind: GenerationKind) =>
  `${caseId}:${kind}`;

function toSummary(row: {
  id: string;
  kind: string;
  status: string;
  totalDocuments: number;
  successCount: number;
  errorCount: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}): GenerationRequestSummary {
  return {
    id: row.id,
    kind: row.kind as GenerationKind,
    status: row.status as GenerationStatus,
    totalDocuments: row.totalDocuments,
    successCount: row.successCount,
    errorCount: row.errorCount,
    error: row.error,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Intenta obtener el lock de generación para (caseId, kind).
 *
 * - Si no hay solicitud activa: crea una fila PENDING con activeKey → claimed.
 * - Si ya hay una activa y fresca: devuelve esa solicitud → !claimed
 *   (el cliente puede poolear su estado; equivale al 409 + requestId del spec).
 * - Si la activa está huérfana (más vieja que STALE_GENERATION_TIMEOUT_MS):
 *   la marca FAILED, libera el lock y reintenta el claim una vez.
 */
export async function claimGenerationRequest(params: {
  tenantId: string;
  caseId: string;
  kind: GenerationKind;
  requestedById?: string;
}): Promise<ClaimResult> {
  const { tenantId, caseId, kind, requestedById } = params;
  const activeKey = activeKeyFor(caseId, kind);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const created = await prisma.documentGenerationRequest.create({
        data: {
          tenantId,
          caseId,
          kind,
          status: 'PENDING',
          activeKey,
          requestedById: requestedById ?? null,
        },
      });
      return { claimed: true, request: toSummary(created) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const existing = await prisma.documentGenerationRequest.findUnique({
        where: { activeKey },
      });

      // El lock se liberó entre el create y el findUnique: reintentar.
      if (!existing) continue;

      const age = Date.now() - existing.createdAt.getTime();
      if (age < STALE_GENERATION_TIMEOUT_MS) {
        return { claimed: false, request: toSummary(existing) };
      }

      // Solicitud huérfana: liberar condicionalmente (updateMany con el
      // activeKey en el where — si otro proceso la libera primero, count=0
      // y el siguiente intento de create resuelve la carrera).
      await prisma.documentGenerationRequest.updateMany({
        where: { id: existing.id, activeKey },
        data: {
          status: 'FAILED',
          activeKey: null,
          error: 'Generación huérfana: superó el tiempo máximo sin finalizar',
          finishedAt: new Date(),
        },
      });
    }
  }

  // Dos colisiones seguidas con locks que desaparecen: estado inconsistente
  // transitorio; el cliente puede reintentar.
  throw new Error(
    'No se pudo obtener el lock de generación; intente nuevamente',
  );
}

/** Marca la solicitud como en proceso. */
export async function markGenerationProcessing(id: string): Promise<void> {
  await prisma.documentGenerationRequest.update({
    where: { id },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });
}

/**
 * Finaliza la solicitud con los resultados y libera el lock.
 * status: COMPLETED si no hubo errores, COMPLETED_WITH_ERRORS si hubo mixto.
 */
export async function completeGenerationRequest(
  id: string,
  counts: { total: number; success: number; errors: number },
): Promise<void> {
  // Una generación que no produjo ni un documento no es un éxito, aunque no
  // haya lanzado ningún error técnico. Con el bloqueo por datos incompletos
  // (C-3) este caso pasa a ser frecuente: los documentos salen como `skipped`,
  // que no cuenta como error, y la solicitud quedaba marcada COMPLETED.
  const producedNothing = counts.total > 0 && counts.success === 0;

  await prisma.documentGenerationRequest.update({
    where: { id },
    data: {
      status:
        counts.errors > 0 || producedNothing
          ? 'COMPLETED_WITH_ERRORS'
          : 'COMPLETED',
      activeKey: null,
      totalDocuments: counts.total,
      successCount: counts.success,
      errorCount: counts.errors,
      finishedAt: new Date(),
    },
  });
}

/**
 * Marca la solicitud como fallida y libera el lock (permite reintentar).
 * El mensaje se trunca — nunca volcar stacks ni payloads completos a BD/UI.
 */
export async function failGenerationRequest(
  id: string,
  error: unknown,
): Promise<void> {
  const message = (
    error instanceof Error ? error.message : 'Error desconocido'
  ).substring(0, 500);

  await prisma.documentGenerationRequest.update({
    where: { id },
    data: {
      status: 'FAILED',
      activeKey: null,
      error: message,
      finishedAt: new Date(),
    },
  });
}

/**
 * GD-A1 (issue #3) — lotes grandes troceados en tandas.
 *
 * Cada tanda es una invocación de servidor independiente (evita el techo de
 * `maxDuration` del plan Hobby), pero las tres comparten UNA sola fila de
 * `DocumentGenerationRequest` — el "estado agregado" que pide el diseño: no
 * se crea una fila nueva por tanda, y el lock (`activeKey`) sigue siendo el
 * mismo mecanismo anti-duplicados de siempre, solo que se mantiene tomado
 * ENTRE tandas en vez de liberarse al final de cada una.
 *
 * Tres piezas, cada una con su función:
 *  - `continueOrResumeGenerationRequest`: valida que la tanda puede seguir
 *    escribiendo en esta solicitud (ya la tiene tomada) o, si una tanda
 *    anterior falló, la vuelve a tomar para reintentar — sin crear una fila
 *    nueva ni perder los conteos ya acumulados.
 *  - `recordBatchTandaProgress`: ACUMULA (no sobrescribe) los conteos de la
 *    tanda que acaba de terminar. No toca `status` ni `activeKey`: el lock
 *    sigue tomado hasta la tanda final.
 *  - `finalizeBatchGenerationRequest`: la tanda final la llama para fijar el
 *    estado terminal (mismo criterio que `completeGenerationRequest`, pero
 *    sobre los conteos YA acumulados por todas las tandas) y liberar el lock.
 *
 * `completeGenerationRequest`/`claimGenerationRequest`/`failGenerationRequest`
 * no se tocan: siguen siendo el camino de una sola tanda (INITIAL/ADMISSION/
 * AGREEMENT/FAILURE, y BATCH cuando cabe en una sola invocación).
 */
export async function continueOrResumeGenerationRequest(params: {
  tenantId: string;
  caseId: string;
  kind: GenerationKind;
  requestId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenantId, caseId, kind, requestId } = params;

  const existing = await prisma.documentGenerationRequest.findUnique({
    where: { id: requestId },
  });

  if (
    !existing ||
    existing.tenantId !== tenantId ||
    existing.caseId !== caseId ||
    existing.kind !== kind
  ) {
    return { ok: false, error: 'Solicitud de generación no encontrada' };
  }

  const activeKey = activeKeyFor(caseId, kind);

  // Tanda normal: la anterior dejó el lock tomado, esta sigue sobre la
  // misma fila sin reclamar nada de nuevo.
  if (existing.status === 'PROCESSING' && existing.activeKey === activeKey) {
    return { ok: true };
  }

  // Reintento de una tanda que falló (o terminó con errores parciales):
  // se re-toma el lock condicionalmente — si otra operación ya lo tiene
  // (otra pestaña, otro operador), count=0 y se reporta el conflicto en vez
  // de pisarla.
  if (
    existing.status === 'FAILED' ||
    existing.status === 'COMPLETED_WITH_ERRORS'
  ) {
    const result = await prisma.documentGenerationRequest.updateMany({
      where: { id: existing.id, activeKey: null },
      data: { activeKey, status: 'PROCESSING', error: null },
    });
    if (result.count === 0) {
      return {
        ok: false,
        error: 'Ya hay otra generación en curso para este caso',
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error: `La solicitud ya terminó (estado: ${existing.status})`,
  };
}

/**
 * Acumula los conteos de una tanda en la solicitud compartida. No libera el
 * lock ni cambia `status` — eso es trabajo de `finalizeBatchGenerationRequest`,
 * que solo corre en la tanda final.
 */
export async function recordBatchTandaProgress(
  id: string,
  counts: { total: number; success: number; errors: number },
): Promise<void> {
  await prisma.documentGenerationRequest.update({
    where: { id },
    data: {
      totalDocuments: { increment: counts.total },
      successCount: { increment: counts.success },
      errorCount: { increment: counts.errors },
    },
  });
}

/**
 * Cierra la solicitud compartida al terminar la ÚLTIMA tanda, sobre los
 * conteos ya acumulados por `recordBatchTandaProgress` en todas las tandas
 * anteriores (no recibe conteos propios — lee los de la fila).
 * Mismo criterio de "no hubo ni un documento → no es COMPLETED limpio" que
 * `completeGenerationRequest`.
 */
export async function finalizeBatchGenerationRequest(
  id: string,
): Promise<void> {
  const row = await prisma.documentGenerationRequest.findUnique({
    where: { id },
  });
  if (!row) {
    throw new Error(`Solicitud de generación no encontrada: ${id}`);
  }

  const producedNothing = row.totalDocuments > 0 && row.successCount === 0;

  await prisma.documentGenerationRequest.update({
    where: { id },
    data: {
      status:
        row.errorCount > 0 || producedNothing
          ? 'COMPLETED_WITH_ERRORS'
          : 'COMPLETED',
      activeKey: null,
      finishedAt: new Date(),
    },
  });
}

/**
 * Ejecuta `produce` protegido por el lock anti-duplicados (P3): reclama la
 * solicitud (caseId, kind), la marca PROCESSING, registra los conteos al
 * terminar y libera el lock. Si ya hay una generación activa devuelve la
 * solicitud existente (equivalente al 409 + requestId del patrón REST).
 *
 * Compartido por la generación manual (actions-generation.ts) y por la
 * generación disparada por cambio de fase (features/case/actions.ts) — de
 * ahí que viva en este módulo sin 'use server' en vez de en uno de los dos.
 */
export async function runWithGenerationLock(
  params: {
    tenantId: string;
    caseId: string;
    kind: GenerationKind;
    userId: string;
  },
  produce: () => Promise<GeneratedDocument[]>,
): Promise<
  | { ok: true; requestId: string; documents: GeneratedDocument[] }
  | { ok: false; requestId: string; error: string }
> {
  const claim = await claimGenerationRequest({
    tenantId: params.tenantId,
    caseId: params.caseId,
    kind: params.kind,
    requestedById: params.userId,
  });

  if (!claim.claimed) {
    return {
      ok: false,
      requestId: claim.request.id,
      error: `Ya hay una generación de documentos en curso para este caso (estado: ${claim.request.status}). Espere a que termine o consulte su estado.`,
    };
  }

  const requestId = claim.request.id;
  try {
    await markGenerationProcessing(requestId);
    const documents = await produce();
    const success = documents.filter((d) => d.status === 'success').length;
    const errors = documents.filter((d) => d.status === 'error').length;
    await completeGenerationRequest(requestId, {
      total: documents.length,
      success,
      errors,
    });
    return { ok: true, requestId, documents };
  } catch (error) {
    // Liberar el lock para permitir reintento; el error sube al catch del llamador.
    await failGenerationRequest(requestId, error).catch(() => {});
    throw error;
  }
}

/** Últimas solicitudes de un caso (para el polling de la UI). */
export async function getGenerationRequests(
  tenantId: string,
  caseId: string,
  limit = 5,
): Promise<GenerationRequestSummary[]> {
  const rows = await prisma.documentGenerationRequest.findMany({
    where: { tenantId, caseId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toSummary);
}
