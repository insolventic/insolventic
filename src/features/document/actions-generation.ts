'use server';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { resolveCenterFolderName } from '@/lib/centro-conciliacion';
import {
  generateDocumentsForNewCase,
  generateDocumentsForAdmission,
  generateDocumentsForAgreement,
  generateDocumentsForFailure,
  regenerateDocument,
  type GeneratedDocument,
} from './generate-documents';
import { getAllTemplates } from './templates-config';
import {
  fetchCaseForGeneration,
  persistGeneratedDocuments,
  inferMimeType,
} from './persistence';
import type { CaseWithRelations } from '../case/schemas';
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

/**
 * Per-user rate limit shared by every generation action. Returns an error
 * string when the limit is exceeded, null otherwise.
 */
function checkGenerationRateLimit(userId: string): string | null {
  const rlKey = getRateLimitKey('documentGeneration', userId);
  const rl = checkRateLimit(rlKey, RATE_LIMIT_CONFIGS.documentGeneration);
  if (!rl.allowed) {
    return `Demasiadas solicitudes de generación. Intente en ${Math.ceil(rl.resetInMs / 60000)} minutos.`;
  }
  return null;
}

/**
 * Get all available document templates
 */
export async function getDocumentTemplates(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
  }>;
  error?: string;
}> {
  try {
    const { user } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver documentos',
      };
    }

    const templates = getAllTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
    }));

    return { success: true, data: templates };
  } catch (error) {
    console.error('Error getting document templates:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener plantillas',
    };
  }
}

/**
 * Regenerate a specific document for a case
 */
export async function regenerateCaseDocument(input: {
  caseId: string;
  templateId: string;
}): Promise<{
  success: boolean;
  data?: GeneratedDocument;
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para generar documentos',
      };
    }

    const rateLimitError = checkGenerationRateLimit(user.id);
    if (rateLimitError) {
      return { success: false, error: rateLimitError };
    }

    const { caseId, templateId } = input;

    // Fetch the case with all relations
    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    if (!caseData.driveFolderId) {
      return {
        success: false,
        error: 'El caso no tiene una carpeta de Google Drive asociada',
      };
    }

    const result = await regenerateDocument(
      caseData as unknown as CaseWithRelations,
      templateId,
      caseData.driveFolderId,
    );

    if (result.status === 'success' && result.googleDriveId) {
      // Update or create document record in database
      const existingDoc = await prisma.document.findFirst({
        where: {
          caseId,
          tenantId,
          name: result.templateName,
          isGenerated: true,
        },
      });

      if (existingDoc) {
        await prisma.document.update({
          where: { id: existingDoc.id, tenantId },
          data: {
            url: result.googleDriveUrl,
            googleDriveId: result.googleDriveId,
            fileName: result.fileName,
            mimeType: inferMimeType(result.fileName),
            uploadDate: new Date(),
          },
        });
      } else {
        await prisma.document.create({
          data: {
            name: result.templateName,
            type: 'generated',
            status: 'completed',
            url: result.googleDriveUrl,
            caseId,
            tenantId,
            googleDriveId: result.googleDriveId,
            fileName: result.fileName,
            mimeType: inferMimeType(result.fileName),
            isGenerated: true,
            section: 'GENERADO',
          },
        });
      }
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error regenerating document:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al regenerar documento',
    };
  }
}

/**
 * Generate all initial documents for a case
 */
export async function generateInitialDocuments(caseId: string): Promise<{
  success: boolean;
  data?: {
    caseFolderId: string;
    caseFolderUrl: string;
    documents: GeneratedDocument[];
  };
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para generar documentos',
      };
    }

    const rateLimitError = checkGenerationRateLimit(user.id);
    if (rateLimitError) {
      return { success: false, error: rateLimitError };
    }

    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const centerFolderName = resolveCenterFolderName(
      tenantId,
      caseData.centroConciliacionNombre,
    );
    const result = await generateDocumentsForNewCase(
      caseData as unknown as CaseWithRelations,
      {},
      centerFolderName,
    );

    // Update case with folder ID
    if (result.caseFolderId) {
      await prisma.case.update({
        where: { id: caseId, tenantId },
        data: { driveFolderId: result.caseFolderId },
      });
    }

    // Create document records
    await persistGeneratedDocuments(result.documents, caseId, tenantId);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating initial documents:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al generar documentos',
    };
  }
}

/**
 * Generate admission documents for a case
 */
export async function generateAdmissionDocuments(caseId: string): Promise<{
  success: boolean;
  data?: GeneratedDocument[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para generar documentos',
      };
    }

    const rateLimitError = checkGenerationRateLimit(user.id);
    if (rateLimitError) {
      return { success: false, error: rateLimitError };
    }

    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    if (!caseData.driveFolderId) {
      return {
        success: false,
        error: 'El caso no tiene una carpeta de Google Drive asociada',
      };
    }

    const result = await generateDocumentsForAdmission(
      caseData as unknown as CaseWithRelations,
      caseData.driveFolderId,
    );

    // Create document records
    await persistGeneratedDocuments(result, caseId, tenantId);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating admission documents:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al generar documentos de admisión',
    };
  }
}

/**
 * Generate agreement documents for a case
 */
export async function generateAgreementDocuments(caseId: string): Promise<{
  success: boolean;
  data?: GeneratedDocument[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para generar documentos',
      };
    }

    const rateLimitError = checkGenerationRateLimit(user.id);
    if (rateLimitError) {
      return { success: false, error: rateLimitError };
    }

    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    if (!caseData.driveFolderId) {
      return {
        success: false,
        error: 'El caso no tiene una carpeta de Google Drive asociada',
      };
    }

    const result = await generateDocumentsForAgreement(
      caseData as unknown as CaseWithRelations,
      caseData.driveFolderId,
    );

    // Create document records
    await persistGeneratedDocuments(result, caseId, tenantId);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating agreement documents:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al generar documentos de acuerdo',
    };
  }
}

/**
 * Generate failure (fracaso) documents for a case
 */
export async function generateFailureDocuments(
  caseId: string,
  failureType: string,
): Promise<{
  success: boolean;
  data?: GeneratedDocument[];
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para generar documentos',
      };
    }

    const rateLimitError = checkGenerationRateLimit(user.id);
    if (rateLimitError) {
      return { success: false, error: rateLimitError };
    }

    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    if (!caseData.driveFolderId) {
      return {
        success: false,
        error: 'El caso no tiene una carpeta de Google Drive asociada',
      };
    }

    const result = await generateDocumentsForFailure(
      caseData as unknown as CaseWithRelations,
      caseData.driveFolderId,
      failureType,
    );

    // Create document records
    await persistGeneratedDocuments(result, caseId, tenantId);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating failure documents:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al generar documentos de fracaso',
    };
  }
}

/**
 * Get available failure types for document generation
 */
export async function getFailureTypes(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string; description: string }>;
  error?: string;
}> {
  try {
    const { user } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver documentos',
      };
    }

    const { getFailureTypes: getTypes } = await import('./templates-config');
    return { success: true, data: getTypes() };
  } catch (error) {
    console.error('Error getting failure types:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener tipos de fracaso',
    };
  }
}

/**
 * Get document generation status for a case
 */
export async function getCaseDocumentStatus(caseId: string): Promise<{
  success: boolean;
  data?: {
    hasFolder: boolean;
    folderUrl?: string;
    generatedDocuments: number;
    lastGeneratedAt?: Date;
  };
  error?: string;
}> {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver documentos',
      };
    }

    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: {
        driveFolderId: true,
        documents: {
          where: { isGenerated: true },
          orderBy: { uploadDate: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            documents: {
              where: { isGenerated: true },
            },
          },
        },
      },
    });

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    const { googleDriveService } = await import('@/lib/google-drive');

    return {
      success: true,
      data: {
        hasFolder: !!caseData.driveFolderId,
        folderUrl: caseData.driveFolderId
          ? googleDriveService.getFolderUrl(caseData.driveFolderId)
          : undefined,
        generatedDocuments: caseData._count.documents,
        lastGeneratedAt: caseData.documents[0]?.uploadDate,
      },
    };
  } catch (error) {
    console.error('Error getting document status:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al obtener estado de documentos',
    };
  }
}
