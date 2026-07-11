/**
 * Job de generación inicial de documentos (P4).
 *
 * Se ejecuta post-response vía `after()` de Next (creación de casos) o
 * inline desde la server action manual. En ambos casos la fila de
 * DocumentGenerationRequest es la fuente de verdad del estado, y al
 * terminar se notifica in-app al usuario solicitante.
 *
 * Sin Redis/colas externas a propósito: en Vercel serverless no hay
 * workers persistentes; `after()` mantiene viva la función tras responder.
 */

import * as Sentry from '@sentry/nextjs';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { resolveCenterFolderName } from '@/lib/centro-conciliacion';
import { generateDocumentsForNewCase } from './generate-documents';
import {
  fetchCaseForGeneration,
  persistGeneratedDocuments,
  asCaseWithRelations,
} from './persistence';
import {
  markGenerationProcessing,
  completeGenerationRequest,
  failGenerationRequest,
} from './generation-request';

export interface InitialGenerationResult {
  total: number;
  success: number;
  errors: number;
  caseFolderId: string;
}

/**
 * Notificación in-app best-effort — nunca debe tumbar el job.
 */
async function notifyRequester(params: {
  tenantId: string;
  caseId: string;
  userId: string | null;
  requestId: string;
  ok: boolean;
  detail: string;
}): Promise<void> {
  if (!params.userId) return;
  try {
    await prisma.notification.create({
      data: {
        type: params.ok ? 'document_generation' : 'document_generation_failed',
        title: params.ok
          ? 'Documentos generados'
          : 'Falló la generación de documentos',
        message: params.detail,
        userId: params.userId,
        caseId: params.caseId,
        relatedId: params.requestId,
        tenantId: params.tenantId,
      },
    });
  } catch (error) {
    logger.warn('No se pudo crear la notificación de generación', {
      action: 'generation-job',
      requestId: params.requestId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Ejecuta la generación inicial completa de un caso, actualizando la fila
 * de solicitud (PROCESSING → COMPLETED/COMPLETED_WITH_ERRORS/FAILED) y
 * notificando al solicitante. No lanza: todo error termina en la fila.
 */
export async function runInitialGenerationJob(params: {
  requestId: string;
  caseId: string;
  tenantId: string;
  requestedById?: string;
}): Promise<InitialGenerationResult | null> {
  const { requestId, caseId, tenantId } = params;
  const requestedById = params.requestedById ?? null;

  const startedAt = Date.now();
  logger.info('Generation job started', {
    action: 'generation-job',
    requestId,
    caseId,
    tenantId,
  });

  try {
    await markGenerationProcessing(requestId);

    const caseData = await fetchCaseForGeneration(caseId, tenantId);
    if (!caseData) {
      throw new Error('Caso no encontrado para generación');
    }

    const centerFolderName = resolveCenterFolderName(
      tenantId,
      caseData.centroConciliacionNombre,
    );

    const result = await generateDocumentsForNewCase(
      asCaseWithRelations(caseData),
      {},
      centerFolderName,
    );

    if (result.caseFolderId) {
      await prisma.case.update({
        where: { id: caseId, tenantId },
        data: { driveFolderId: result.caseFolderId, layoutVersion: 1 },
      });
    }

    await persistGeneratedDocuments(result.documents, caseId, tenantId);

    const success = result.documents.filter(
      (d) => d.status === 'success',
    ).length;
    const errors = result.documents.filter((d) => d.status === 'error').length;
    const total = result.documents.length;

    await completeGenerationRequest(requestId, { total, success, errors });

    await notifyRequester({
      tenantId,
      caseId,
      userId: requestedById,
      requestId,
      ok: true,
      detail:
        errors === 0
          ? `Se generaron ${success} de ${total} documentos del expediente.`
          : `Generación finalizada con errores: ${success} correctos, ${errors} fallidos de ${total}.`,
    });

    logger.info('Generation job completed', {
      action: 'generation-job',
      requestId,
      caseId,
      total,
      successCount: success,
      errorCount: errors,
      duration: Date.now() - startedAt,
    });

    return { total, success, errors, caseFolderId: result.caseFolderId };
  } catch (error) {
    logger.error('Generation job failed', error, {
      action: 'generation-job',
      requestId,
      caseId,
      duration: Date.now() - startedAt,
    });
    Sentry.captureException(error, {
      tags: { job: 'document-generation', requestId, caseId },
    });

    await failGenerationRequest(requestId, error).catch(() => {
      /* la fila queda huérfana; el timeout de claim la recupera */
    });

    await notifyRequester({
      tenantId,
      caseId,
      userId: requestedById,
      requestId,
      ok: false,
      detail:
        'La generación automática de documentos falló. Puede reintentarla desde la sección Documentos del caso.',
    });

    return null;
  }
}
