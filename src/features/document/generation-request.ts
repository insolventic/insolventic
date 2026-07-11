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

/** Tipo de generación — una por caso puede estar activa a la vez. */
export type GenerationKind = 'INITIAL' | 'ADMISSION' | 'AGREEMENT' | 'FAILURE';

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
  await prisma.documentGenerationRequest.update({
    where: { id },
    data: {
      status: counts.errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
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
