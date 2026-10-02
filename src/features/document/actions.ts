'use server';

import { revalidatePath } from 'next/cache';
import type { PrismaClient } from '@prisma/client';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';
import { createAuditLog } from '@/features/audit-log/actions';
import { resolveCenterFolderName } from '@/lib/centro-conciliacion';
import { logger } from '@/lib/logger';
import { canGenerateDocument } from '../case/validation-rules';
import {
  claimGenerationRequest,
  markGenerationProcessing,
  completeGenerationRequest,
  failGenerationRequest,
} from './generation-request';
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import type { DocumentTemplate } from './templates-config';

import {
  getTemplatesFromDatabaseOutputSchema,
  syncTemplatesWithGoogleDriveOutputSchema,
  batchGenerateDocumentsInputSchema,
  getDocumentsFromDriveOutputSchema,
  syncDocumentsWithGoogleDriveOutputSchema,
  uploadCaseDocumentsInputSchema,
  uploadCaseDocumentsOutputSchema,
} from './schemas';
import { asCaseWithRelations, fetchCaseForGeneration } from './persistence';
import { templateVariants, jobKey } from './template-variants';
import { prepareTemplate, variantDisplayName } from './prepare-template';

export async function getTemplatesFromDatabase() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver documentos',
      };
    }

    const templates = await prisma.documentTemplate.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ isFolder: 'desc' }, { fileName: 'asc' }],
    });

    const data = getTemplatesFromDatabaseOutputSchema.parse(
      templates.map((template) => ({
        id: template.id,
        googleDriveId: template.googleDriveId,
        fileName: template.fileName,
        mimeType: template.mimeType,
        placeholders: template.placeholders as Array<{
          key: string;
          label: string;
        }>,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        folderPath: template.folderPath,
        isFolder: template.isFolder,
        parentFolderId: template.parentFolderId || undefined,
      })),
    );

    return { success: true, data };
  } catch (error) {
    console.error('Error getting templates from database:', error);
    return {
      success: false,
      error: 'Error al obtener plantillas de la base de datos',
    };
  }
}

export async function syncTemplatesWithGoogleDrive() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para sincronizar plantillas',
      };
    }

    console.log('Starting Google Drive sync process...');
    const { googleDriveService } = await import('@/lib/google-drive');

    // Primero, buscar la carpeta "archivos" y luego "plantillas" dentro de ella
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    console.log('Searching for archivos folder in root folder:', rootFolderId);

    const rootContents =
      await googleDriveService.listFoldersAndFiles(rootFolderId);
    console.log('Root folder contents:', {
      folders: rootContents.folders.map((f) => ({ id: f.id, name: f.name })),
      files: rootContents.files.map((f) => ({ id: f.id, name: f.name })),
    });

    // Buscar carpeta "archivos"
    const archivosFolder = rootContents.folders.find(
      (folder) => folder.name?.toLowerCase() === 'archivos',
    );

    let plantillasFolder;

    if (archivosFolder && archivosFolder.id) {
      console.log(
        'Found archivos folder, searching for plantillas inside it...',
      );
      const archivosContents = await googleDriveService.listFoldersAndFiles(
        archivosFolder.id,
      );
      plantillasFolder = archivosContents.folders.find(
        (folder) => folder.name?.toLowerCase() === 'plantillas',
      );
    } else {
      console.log(
        'No archivos folder found, searching for plantillas in root...',
      );
      plantillasFolder = rootContents.folders.find(
        (folder) => folder.name?.toLowerCase() === 'plantillas',
      );
    }

    if (!plantillasFolder || !plantillasFolder.id) {
      console.error('No se encontró la carpeta "plantillas" en Google Drive');
      console.log(
        'Available folders in root:',
        rootContents.folders.map((f) => f.name),
      );
      if (archivosFolder && archivosFolder.id) {
        const archivosContents = await googleDriveService.listFoldersAndFiles(
          archivosFolder.id,
        );
        console.log(
          'Available folders in archivos:',
          archivosContents.folders.map((f) => f.name),
        );
      }
      return {
        synced: 0,
        created: 0,
        updated: 0,
        folders: 0,
      };
    }

    console.log('Found plantillas folder with ID:', plantillasFolder.id);
    console.log('Fetching folders and files from plantillas folder...');

    // Ahora buscar recursivamente dentro de la carpeta plantillas
    const driveData =
      await googleDriveService.listAllFoldersAndFilesRecursively(
        plantillasFolder.id!,
      );

    let created = 0;
    let updated = 0;
    let folders = 0;

    for (const folder of driveData.folders) {
      const existingTemplate = await prisma.documentTemplate.findFirst({
        where: {
          googleDriveId: folder.id,
          tenantId,
        },
      });

      if (existingTemplate) {
        await prisma.documentTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            fileName: folder.name,
            folderPath: folder.path,
            parentFolderId: folder.parentId,
            isFolder: true,
            updatedAt: folder.modifiedTime
              ? new Date(folder.modifiedTime)
              : new Date(),
          },
        });
        updated++;
      } else {
        console.log(
          `Creating new folder template: ${folder.name} (${folder.id})`,
        );
        console.log('Folder details:', {
          name: folder.name,
          path: folder.path,
          parentId: folder.parentId,
        });
        await prisma.documentTemplate.create({
          data: {
            googleDriveId: folder.id,
            fileName: folder.name,
            mimeType: 'application/vnd.google-apps.folder',
            placeholders: [],
            folderPath: folder.path,
            parentFolderId: folder.parentId,
            isFolder: true,
            tenantId,
            createdAt: folder.createdTime
              ? new Date(folder.createdTime)
              : new Date(),
            updatedAt: folder.modifiedTime
              ? new Date(folder.modifiedTime)
              : new Date(),
          },
        });
        created++;
      }
      folders++;
    }

    const templateFiles = driveData.files.filter(
      (file) =>
        file.mimeType?.includes('word') ||
        file.mimeType?.includes('spreadsheet') ||
        file.mimeType?.includes('document') ||
        file.mimeType?.includes('officedocument') ||
        file.mimeType?.includes('ms-excel') ||
        file.name?.endsWith('.docx') ||
        file.name?.endsWith('.xlsx') ||
        file.name?.endsWith('.xls'),
    );

    console.log('Filtered template files:', templateFiles.length);
    console.log(
      'Sample files:',
      templateFiles.slice(0, 3).map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        path: f.path,
      })),
    );

    for (const file of templateFiles) {
      const existingTemplate = await prisma.documentTemplate.findFirst({
        where: {
          googleDriveId: file.id,
          tenantId,
        },
      });

      if (existingTemplate) {
        await prisma.documentTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            folderPath: file.path,
            parentFolderId: file.parentId,
            isFolder: false,
            updatedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : new Date(),
          },
        });
        updated++;
      } else {
        console.log(`Updating existing template: ${file.name} (${file.id})`);
        console.log('File details:', {
          name: file.name,
          mimeType: file.mimeType,
          path: file.path,
          parentId: file.parentId,
        });
        await prisma.documentTemplate.create({
          data: {
            googleDriveId: file.id,
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            placeholders: [],
            folderPath: file.path,
            parentFolderId: file.parentId,
            isFolder: false,
            tenantId,
            createdAt: file.createdTime
              ? new Date(file.createdTime)
              : new Date(),
            updatedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : new Date(),
          },
        });
        created++;
      }
    }

    console.log(
      `Sync completed: ${created} created, ${updated} updated, ${folders} folders`,
    );
    console.log(`Total files processed: ${templateFiles.length}`);
    console.log(`Total folders processed: ${driveData.folders.length}`);

    // Verificar que se guardaron en la base de datos
    const totalTemplates = await prisma.documentTemplate.count();
    const totalNonFolderTemplates = await prisma.documentTemplate.count({
      where: { isFolder: false },
    });
    const totalFolderTemplates = await prisma.documentTemplate.count({
      where: { isFolder: true },
    });

    console.log(`Total templates in database: ${totalTemplates}`);
    console.log(`  - Files: ${totalNonFolderTemplates}`);
    console.log(`  - Folders: ${totalFolderTemplates}`);

    // Verificar algunos ejemplos
    const sampleTemplates = await prisma.documentTemplate.findMany({
      where: { isFolder: false },
      take: 3,
    });
    if (sampleTemplates.length > 0) {
      console.log(
        'Sample templates in DB:',
        sampleTemplates.map((t) => ({
          fileName: t.fileName,
          folderPath: t.folderPath,
          googleDriveId: t.googleDriveId,
        })),
      );
    }

    const syncResult = syncTemplatesWithGoogleDriveOutputSchema.parse({
      synced: templateFiles.length + folders,
      created,
      updated,
      folders,
    });

    revalidatePath('/documents');
    return { success: true, data: syncResult };
  } catch (error) {
    console.error('Error syncing templates with Google Drive:', error);
    return {
      success: false,
      error: 'Error al sincronizar plantillas con Google Drive',
    };
  }
}

export async function getDocumentsFromDrive() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para ver documentos',
      };
    }

    const documents = await prisma.documentFromDrive.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ isFolder: 'desc' }, { fileName: 'asc' }],
    });

    const caseNumberPattern = /(CON|INS|ACU)-\d{4}-\d{3}/;

    /**
     * Extract case number from a document's folderPath.
     * Handles both new format [centerName, caseNumber, ...] and legacy [caseNumber, ...].
     */
    function extractCaseNumber(doc: {
      folderPath: string[];
      fileName: string;
      isFolder: boolean;
    }): string | undefined {
      // New format: folderPath[0] = center name, folderPath[1] = case number
      if (
        doc.folderPath.length > 1 &&
        caseNumberPattern.test(doc.folderPath[1])
      ) {
        return doc.folderPath[1];
      }
      // Legacy format: folderPath[0] = case number
      if (
        doc.folderPath.length > 0 &&
        caseNumberPattern.test(doc.folderPath[0])
      ) {
        return doc.folderPath[0];
      }
      // Folder with no path but name is case number
      if (
        doc.isFolder &&
        doc.folderPath.length === 0 &&
        caseNumberPattern.test(doc.fileName)
      ) {
        return doc.fileName;
      }
      // Case folder with center prefix
      if (
        doc.isFolder &&
        doc.folderPath.length === 1 &&
        caseNumberPattern.test(doc.fileName)
      ) {
        return doc.fileName;
      }
      return undefined;
    }

    const filteredDocuments = documents.filter((doc) => {
      return extractCaseNumber(doc) !== undefined;
    });

    // Check user permissions to determine case visibility scope
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    if (canViewAllCases) {
      // Can see all documents
      const data = getDocumentsFromDriveOutputSchema.parse(
        filteredDocuments.map((doc) => ({
          id: doc.id,
          googleDriveId: doc.googleDriveId,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          folderPath: doc.folderPath,
          isFolder: doc.isFolder,
          parentFolderId: doc.parentFolderId || undefined,
          size: doc.size || undefined,
        })),
      );
      return { success: true, data };
    } else {
      // Get accessible case numbers based on permissions
      let accessibleCaseNumbers: string[] = [];

      if (canViewOwnCases) {
        // Abogado, Asistente Legal: only documents from cases they are working on
        const accessibleCases = await prisma.case.findMany({
          where: {
            operatorId: user.id,
            tenantId,
          },
          select: {
            caseNumber: true,
          },
        });
        accessibleCaseNumbers = accessibleCases.map((c) => c.caseNumber);
      } else if (canViewAsClient) {
        // Usuario: only documents from cases where they are the debtor
        const userDebtor = await prisma.debtor.findFirst({
          where: {
            email: user.email,
            tenantId,
          },
          select: {
            id: true,
          },
        });

        if (userDebtor) {
          const accessibleCases = await prisma.case.findMany({
            where: {
              debtorId: userDebtor.id,
              tenantId,
            },
            select: {
              caseNumber: true,
            },
          });
          accessibleCaseNumbers = accessibleCases.map((c) => c.caseNumber);
        }
      }

      // Filter documents by accessible case numbers
      const userFilteredDocuments = filteredDocuments.filter((doc) => {
        const caseNumber = extractCaseNumber(doc);
        return caseNumber && accessibleCaseNumbers.includes(caseNumber);
      });

      const data = getDocumentsFromDriveOutputSchema.parse(
        userFilteredDocuments.map((doc) => ({
          id: doc.id,
          googleDriveId: doc.googleDriveId,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          folderPath: doc.folderPath,
          isFolder: doc.isFolder,
          parentFolderId: doc.parentFolderId || undefined,
          size: doc.size || undefined,
        })),
      );
      return { success: true, data };
    }
  } catch (error) {
    console.error('Error getting documents from Drive:', error);
    return {
      success: false,
      error: 'Error al obtener documentos de Google Drive',
    };
  }
}

export async function syncDocumentsWithGoogleDrive() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.VER_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para sincronizar documentos',
      };
    }

    console.log('Starting Google Drive documents sync process...');
    const { googleDriveService } = await import('@/lib/google-drive');

    // Resolve the center folder for this tenant
    const centerFolderName = resolveCenterFolderName(tenantId);

    // Find or create the documentos-generados root folder
    let docGenFolderId: string;
    try {
      docGenFolderId = await findOrCreateDocumentosGeneradosFolder();
    } catch (error) {
      console.error('Error finding/creating documentos-generados:', error);
      return { synced: 0, created: 0, updated: 0, folders: 0 };
    }

    // Find or create the center subfolder: documentos-generados/{centerFolderName}/
    const centerFolderId = await googleDriveService.createFolderHierarchy(
      [centerFolderName],
      docGenFolderId,
    );

    const casesFolderId = centerFolderId;
    console.log(
      `Found center folder "${centerFolderName}" with ID:`,
      casesFolderId,
    );

    console.log(
      'Fetching folders and files from documentos-generados folder in Google Drive...',
    );
    const driveData =
      await googleDriveService.listAllFoldersAndFilesRecursively(casesFolderId);
    console.log(
      `Found ${driveData.folders.length} folders and ${driveData.files.length} files in documentos-generados folder`,
    );

    let created = 0;
    let updated = 0;
    let folders = 0;

    for (const folder of driveData.folders) {
      // Prefix all paths with the center folder name for consistency
      const prefixedPath = [centerFolderName, ...folder.path];

      const existingDocument = await prisma.documentFromDrive.findUnique({
        where: {
          googleDriveId_tenantId: {
            googleDriveId: folder.id,
            tenantId,
          },
        },
      });

      if (existingDocument) {
        await prisma.documentFromDrive.update({
          where: { id: existingDocument.id },
          data: {
            fileName: folder.name,
            folderPath: prefixedPath,
            parentFolderId: folder.parentId,
            isFolder: true,
            updatedAt: folder.modifiedTime
              ? new Date(folder.modifiedTime)
              : new Date(),
          },
        });
        updated++;
      } else {
        await prisma.documentFromDrive.create({
          data: {
            googleDriveId: folder.id,
            fileName: folder.name,
            mimeType: 'application/vnd.google-apps.folder',
            folderPath: prefixedPath,
            parentFolderId: folder.parentId,
            isFolder: true,
            tenantId,
            createdAt: folder.createdTime
              ? new Date(folder.createdTime)
              : new Date(),
            updatedAt: folder.modifiedTime
              ? new Date(folder.modifiedTime)
              : new Date(),
          },
        });
        created++;
      }
      folders++;
    }

    const documentFiles = driveData.files.filter(
      (file) => file.mimeType && !file.mimeType.includes('folder'),
    );

    for (const file of documentFiles) {
      // Prefix all paths with the center folder name for consistency
      const prefixedPath = [centerFolderName, ...file.path];

      const existingDocument = await prisma.documentFromDrive.findUnique({
        where: {
          googleDriveId_tenantId: {
            googleDriveId: file.id,
            tenantId,
          },
        },
      });

      if (existingDocument) {
        const caseNumberPattern = /(CON|INS|ACU)-\d{4}-\d{3}/;
        // Check if folderPath[0] is a center name or folderPath[1] is a case number
        const hasCenterPrefix =
          existingDocument.folderPath.length > 1 &&
          caseNumberPattern.test(existingDocument.folderPath[1]);
        const hasLegacyPath =
          existingDocument.folderPath.length > 0 &&
          caseNumberPattern.test(existingDocument.folderPath[0]);
        const shouldUpdateFolderPath =
          existingDocument.folderPath.length === 0 ||
          (!hasCenterPrefix && !hasLegacyPath);

        await prisma.documentFromDrive.update({
          where: { id: existingDocument.id },
          data: {
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            folderPath: shouldUpdateFolderPath
              ? prefixedPath
              : existingDocument.folderPath,
            parentFolderId: file.parentId,
            isFolder: false,
            size: file.size,
            updatedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : new Date(),
          },
        });
        updated++;
      } else {
        await prisma.documentFromDrive.create({
          data: {
            googleDriveId: file.id,
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            folderPath: prefixedPath,
            parentFolderId: file.parentId,
            isFolder: false,
            size: file.size,
            tenantId,
            createdAt: file.createdTime
              ? new Date(file.createdTime)
              : new Date(),
            updatedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : new Date(),
          },
        });
        created++;
      }
    }

    const syncResult = syncDocumentsWithGoogleDriveOutputSchema.parse({
      synced: documentFiles.length + folders,
      created,
      updated,
      folders,
    });

    console.log('Documents sync completed:', syncResult);
    revalidatePath('/documents');
    return { success: true, data: syncResult };
  } catch (error) {
    console.error('Error syncing documents with Google Drive:', error);
    return {
      success: false,
      error: 'Error al sincronizar documentos con Google Drive',
    };
  }
}

/**
 * Reúne los campos obligatorios que faltan para una plantilla (C-3).
 *
 * Dos fuentes, deliberadamente distintas:
 *  1. `unresolved` — placeholders que la plantilla referencia y el mapper no
 *     produce en absoluto. Es un desajuste plantilla↔mapper: hueco garantizado.
 *  2. `DOCUMENT_REQUIRED_FIELDS` (vía `canGenerateDocument`) — campos que el
 *     mapper sí conoce pero que vienen vacíos o con relleno manual (`____`,
 *     `N/A`) y que ese tipo de documento no admite en blanco.
 *
 * Un placeholder conocido y vacío que NO esté en la lista de obligatorios se
 * considera opcional y no bloquea: así se respeta el render de las plantillas
 * que dejan campos en blanco a propósito.
 */
function collectMissingData(
  template: DocumentTemplate,
  unresolved: string[],
  placeholders: Record<string, string>,
  htmlContent: string,
): string[] {
  const missing = new Set(unresolved);

  const { missingFields } = canGenerateDocument(template.id, placeholders);
  missingFields.forEach((f) => missing.add(f));

  // Solo se exigen los obligatorios que la plantilla realmente usa.
  const usedInTemplate = new Set(
    [...htmlContent.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)].map((m) => m[1]),
  );

  return [...missing].filter(
    (field) => usedInTemplate.has(field) || unresolved.includes(field),
  );
}

export async function batchGenerateDocuments(input: {
  caseId: string;
  templateIds?: string[];
  packageNumber?: 1 | 2 | 3 | 4 | 5;
  outputFormat?: 'pdf' | 'docx' | 'both';
}) {
  // Fuera del try: el catch necesita poder liberar el lock (C-4).
  let generationRequestId: string | null = null;

  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        message: 'No tienes permisos para generar documentos',
        data: null,
      };
    }

    // Rate limit batch generation per user (expensive operation)
    const rlKey = getRateLimitKey('batchDocumentGeneration', user.id);
    const rl = await checkRateLimit(
      rlKey,
      RATE_LIMIT_CONFIGS.batchDocumentGeneration,
    );
    if (!rl.allowed) {
      return {
        success: false,
        message: `Demasiadas solicitudes de generación masiva. Intente en ${Math.ceil(rl.resetInMs / 60000)} minutos.`,
        data: null,
      };
    }

    const validatedInput = batchGenerateDocumentsInputSchema.parse(input);
    const { caseId, templateIds, packageNumber } = validatedInput;
    const outputFormat = validatedInput.outputFormat || 'pdf';

    // Load case with ALL relations needed for placeholder mapping. Misma
    // fuente que actions-generation.ts y case/actions.ts: antes esta función
    // tenía su propia copia del include, sin `professionalCard` en `operator`
    // (hallazgo A6 — TP_CONCILIADORA salía vacío) y con `creditor: true`
    // completo en vez del `select` acotado.
    const caseData = await fetchCaseForGeneration(caseId, tenantId);

    if (!caseData) {
      throw new Error('Caso no encontrado');
    }

    // Check user permissions
    const canViewAllCases = user.permissions.includes(P.VER_TODOS_CASOS);
    const canViewOwnCases = user.permissions.includes(P.VER_CASOS_PROPIOS);
    const canViewAsClient = user.permissions.includes(P.VER_CASOS_CLIENTE);

    let hasAccessToCase = false;

    if (canViewAllCases) {
      hasAccessToCase = true;
    } else if (canViewOwnCases) {
      hasAccessToCase = caseData.operatorId === user.id;
    } else if (canViewAsClient) {
      const userDebtor = await prisma.debtor.findFirst({
        where: { email: user.email, tenantId },
        select: { id: true },
      });
      if (userDebtor) {
        hasAccessToCase = caseData.debtorId === userDebtor.id;
      }
    }

    if (!hasAccessToCase) {
      throw new Error(
        'No tienes permisos para generar documentos para este caso',
      );
    }

    // C-4: esta era la única ruta de generación sin el lock anti-duplicados
    // (solo tenía rate limit). Dos operadores generando el mismo paquete a la
    // vez —o un doble click— duplicaban archivos en Drive y filas en BD.
    // Se reclama DESPUÉS del control de acceso para no crear filas de lock a
    // nombre de quien no puede generar.
    const claim = await claimGenerationRequest({
      tenantId,
      caseId,
      kind: 'BATCH',
      requestedById: user.id,
    });

    if (!claim.claimed) {
      return {
        success: false,
        message: `Ya hay una generación en curso para este caso (estado: ${claim.request.status}). Espere a que termine antes de volver a generar.`,
        data: null,
        requestId: claim.request.id,
      };
    }

    generationRequestId = claim.request.id;
    await markGenerationProcessing(generationRequestId);

    // Get HTML templates to process
    const {
      ALL_TEMPLATES,
      getTemplatesByPackage,
      getTemplatePath,
      getTemplateAssetsBaseDir,
    } = await import('./templates-config');

    let templatesToProcess: DocumentTemplate[];

    if (templateIds && templateIds.length > 0) {
      templatesToProcess = ALL_TEMPLATES.filter((t) =>
        templateIds.includes(t.id),
      );
    } else if (packageNumber) {
      templatesToProcess = getTemplatesByPackage(packageNumber);
    } else {
      templatesToProcess = ALL_TEMPLATES;
    }

    if (templatesToProcess.length === 0) {
      throw new Error('No se encontraron plantillas para procesar');
    }

    // Map case data to placeholders
    const { mapCaseToPlaceholders, buildTemplateContext } = await import(
      './placeholder-mapper'
    );

    // Transform ALL Decimal fields to numbers for the mapper
    // Prisma Decimal.valueOf() returns a string, causing reduce() string concatenation bugs
    const toNum = (v: unknown): number | null =>
      v != null ? Number(v) || 0 : null;
    const transformedCaseData = {
      ...caseData,
      // Case-level Decimal fields
      monthlyIncome: toNum(caseData.monthlyIncome),
      monthlyExpenses: toNum(caseData.monthlyExpenses),
      monthlyPaymentAmount: toNum(caseData.monthlyPaymentAmount),
      variablePayment: toNum(caseData.variablePayment),
      otherIncomeAmount: toNum(caseData.otherIncomeAmount),
      approvalPercentage: toNum(caseData.approvalPercentage),
      capitalReductionPercent: toNum(caseData.capitalReductionPercent),
      ingresoPrincipalMensual: toNum(caseData.ingresoPrincipalMensual),
      otrosIngresosMensuales: toNum(caseData.otrosIngresosMensuales),
      totalIngresosMensuales: toNum(caseData.totalIngresosMensuales),
      ingresosVariablesPromedio: toNum(caseData.ingresosVariablesPromedio),
      ingresosNoOperacionales: toNum(caseData.ingresosNoOperacionales),
      gastosVivienda: toNum(caseData.gastosVivienda),
      gastosAlimentacion: toNum(caseData.gastosAlimentacion),
      gastosServiciosPublicos: toNum(caseData.gastosServiciosPublicos),
      gastosTransporte: toNum(caseData.gastosTransporte),
      gastosEducacion: toNum(caseData.gastosEducacion),
      gastosSalud: toNum(caseData.gastosSalud),
      otrosGastos: toNum(caseData.otrosGastos),
      totalGastosMensuales: toNum(caseData.totalGastosMensuales),
      capacidadPagoEstimada: toNum(caseData.capacidadPagoEstimada),
      patrimonioTotalEstimado: toNum(caseData.patrimonioTotalEstimado),
      pasivoTotalEstimado: toNum(caseData.pasivoTotalEstimado),
      // Debt Decimal fields
      debts:
        caseData.debts?.map((debt) => ({
          ...debt,
          amount: Number(debt.amount) || 0,
          capitalAmount: toNum(debt.capitalAmount),
          interestAmount: toNum(debt.interestAmount),
          interestRate: debt.interestRate
            ? Number(debt.interestRate)
            : undefined,
        })) || [],
      // Asset Decimal fields
      assets:
        caseData.assets?.map((asset) => ({
          ...asset,
          value: asset.value ? Number(asset.value) : null,
          estimatedValue: asset.value ? Number(asset.value) : null,
        })) || [],
      // Debtor Decimal fields
      // Case.debtor es una relación obligatoria (FK requerida): nunca es null.
      debtor: {
        ...caseData.debtor,
        monthlyIncome: toNum(caseData.debtor.monthlyIncome),
        monthlyExpenses: toNum(caseData.debtor.monthlyExpenses),
        otherIncomeAmount: toNum(caseData.debtor.otherIncomeAmount),
      },
    };

    const placeholders = mapCaseToPlaceholders(
      asCaseWithRelations(transformedCaseData),
    );

    // Read HTML templates, replace placeholders, generate PDFs
    // (la lectura la hace ahora `prepareTemplate`; acá solo quedan las
    // rutas de assets que la Fase 2 necesita).
    const path = await import('path');
    const { batchHtmlToPdf } = await import('@/lib/html-to-pdf');

    const projectRoot = process.cwd();
    const assetsBaseDir = path.join(projectRoot, 'templates/insolvency');

    // Resolve center folder name from case data or tenant
    const centerFolderName = resolveCenterFolderName(
      tenantId,
      caseData.centroConciliacionNombre,
    );

    // Note: Cross-center security is enforced by Prisma's tenantId filter
    // on the case query above. The resolveCenterFolderName function uses the
    // authoritative tenant→center mapping, so the folder is always correct.

    // Create case folder in Google Drive for storage
    let caseFolderId = '';
    let caseFolderUrl = '';

    try {
      const caseFolder = await createCaseFolderInGoogleDrive(
        caseData.caseNumber,
        centerFolderName,
        prisma,
        tenantId,
      );
      caseFolderId = caseFolder.id;
      caseFolderUrl = caseFolder.webViewLink;

      // Persist folder ID on the case so subsequent operations find it
      if (caseFolderId && !caseData.driveFolderId) {
        await prisma.case.update({
          where: { id: caseData.id, tenantId },
          data: { driveFolderId: caseFolderId },
        });
      }
    } catch (driveError) {
      console.warn(
        'Google Drive folder creation failed, continuing without upload:',
        driveError,
      );
    }

    const documents: Array<{
      templateId: string;
      templateName: string;
      documentId: string;
      documentName: string;
      documentUrl: string;
      status: 'success' | 'error' | 'skipped';
      error?: string;
      /** Campos obligatorios faltantes que bloquearon la generación (C-3). */
      missingFields?: string[];
    }> = [];

    // Phase 1: Read all templates and replace placeholders
    const htmlDocuments: Array<{
      html: string;
      uniqueKey: string;
      template: (typeof templatesToProcess)[number];
      documentName: string;
      /** Nombre a mostrar cuando la plantilla produjo varios documentos. */
      displayName: string;
    }> = [];

    console.log(
      `[batchGenerateDocuments] Processing ${templatesToProcess.length} templates for package ${packageNumber || 'all'}`,
    );

    // Contexto de bloques ({{#each}} / {{#if}}), calculado una sola vez para
    // todo el lote.
    const batchExtraCtx = buildTemplateContext(
      asCaseWithRelations(transformedCaseData),
    );

    // Una plantilla puede producir MAS de un documento: el oficio de
    // suspension va dirigido a un juzgado, y un caso con procesos en tres
    // juzgados necesita tres oficios. Ver `template-variants.ts`.
    const jobs = templatesToProcess.flatMap((template) =>
      templateVariants(template, asCaseWithRelations(transformedCaseData)).map(
        (variant) => ({ template, variant }),
      ),
    );

    for (const { template, variant } of jobs) {
      const displayName = variantDisplayName(template, variant);
      try {
        // Fase 1 compartida con la ruta automatica: leer, aplicar el overlay
        // de la variante, renderizar y medir. La validacion de abajo NO se
        // comparte: esta ruta corta por `collectMissingData` y la otra por el
        // gate de placeholders sin resolver.
        const {
          htmlContent,
          html: filledHtml,
          placeholders: variantPlaceholders,
          unresolved,
        } = await prepareTemplate(
          template,
          placeholders,
          batchExtraCtx,
          variant,
        );

        // C-3: esta ruta —la que más usan los operadores desde /documents— no
        // validaba absolutamente nada. Un documento con campos obligatorios
        // vacíos se subía a Drive indistinguible de uno correcto.
        const missing = collectMissingData(
          template,
          unresolved,
          variantPlaceholders,
          htmlContent,
        );
        if (missing.length > 0) {
          logger.warn('Documento bloqueado por datos incompletos', {
            action: 'batch-generate-documents',
            caseId: caseData.id,
            template: template.name,
            templateId: template.id,
            missing,
          });
          documents.push({
            templateId: template.id,
            templateName: displayName,
            documentId: '',
            documentName: '',
            documentUrl: '',
            status: 'skipped',
            error: `No se generó por datos incompletos. Falta: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` y ${missing.length - 6} más` : ''}.`,
            missingFields: missing,
          });
          continue;
        }

        // El sufijo evita que los N documentos de una misma plantilla se
        // sobreescriban entre si en Drive. Con una sola variante es vacio, asi
        // que el nombre no cambia para ninguna plantilla existente.
        const documentName = `${template.name.replace(/\s+/g, '_')}_${caseData.caseNumber}${variant.suffix}.pdf`;

        htmlDocuments.push({
          html: filledHtml,
          // NO `template.id`: la Fase 2 indexa los buffers por esta clave y
          // con el id de la plantilla el segundo oficio habria subido el PDF
          // del primero.
          uniqueKey: jobKey(template, variant),
          template,
          documentName,
          displayName,
        });
      } catch (readError) {
        console.error(
          `[batchGenerateDocuments] FAILED to read template ${template.name} from ${getTemplatePath(template)}:`,
          readError,
        );
        documents.push({
          templateId: template.id,
          templateName: displayName,
          documentId: '',
          documentName: '',
          documentUrl: '',
          status: 'error',
          error:
            readError instanceof Error
              ? readError.message
              : 'Error leyendo plantilla',
        });
      }
    }

    console.log(
      `[batchGenerateDocuments] Phase 1 complete: ${htmlDocuments.length} templates read successfully, ${documents.length} failed`,
    );

    // Phase 2: Generate documents (PDF, DOCX, or both)
    const generatePdf = outputFormat === 'pdf' || outputFormat === 'both';
    const generateDocx = outputFormat === 'docx' || outputFormat === 'both';

    // Use template.id as unique filename key to avoid collisions
    // (multiple templates share the same fileName, e.g. "Remision Juzgado F.html" x12)
    const htmlInputs = htmlDocuments.map((d) => ({
      html: d.html,
      filename: `${d.uniqueKey}.html`,
      // Per-document asset resolution: conciliation / support-agreement
      // templates keep their CSS next to the template, not under insolvency.
      assetsBaseDir: path.join(
        projectRoot,
        getTemplateAssetsBaseDir(d.template),
      ),
      docDir: path.dirname(path.join(projectRoot, getTemplatePath(d.template))),
    }));

    // Generate PDFs if requested
    let pdfResults: Array<{ filename: string; buffer: Buffer }> = [];
    if (generatePdf) {
      console.log(
        `[batchGenerateDocuments] Phase 2a: Generating ${htmlDocuments.length} PDFs via batchHtmlToPdf...`,
      );
      pdfResults = await batchHtmlToPdf(htmlInputs, {}, assetsBaseDir);
      console.log(
        `[batchGenerateDocuments] Phase 2a complete: ${pdfResults.length} PDFs generated`,
      );
    }

    // Generate DOCX if requested
    let docxResults: Array<{ filename: string; buffer: Buffer }> = [];
    if (generateDocx) {
      console.log(
        `[batchGenerateDocuments] Phase 2b: Generating ${htmlDocuments.length} DOCX files...`,
      );
      const { batchHtmlToDocx } = await import('@/lib/html-to-docx');
      docxResults = await batchHtmlToDocx(htmlInputs, {}, assetsBaseDir);
      console.log(
        `[batchGenerateDocuments] Phase 2b complete: ${docxResults.length} DOCX files generated`,
      );
    }

    // Log which files were generated vs missing
    const generatedPdfKeys = new Set(pdfResults.map((r) => r.filename));
    const generatedDocxKeys = new Set(docxResults.map((r) => r.filename));
    for (const htmlDoc of htmlDocuments) {
      if (generatePdf && !generatedPdfKeys.has(`${htmlDoc.uniqueKey}.pdf`)) {
        console.error(
          `[batchGenerateDocuments] PDF MISSING for template: ${htmlDoc.template.name} (key: ${htmlDoc.uniqueKey})`,
        );
      }
      if (generateDocx && !generatedDocxKeys.has(`${htmlDoc.uniqueKey}.docx`)) {
        console.error(
          `[batchGenerateDocuments] DOCX MISSING for template: ${htmlDoc.template.name} (key: ${htmlDoc.uniqueKey})`,
        );
      }
    }

    // Phase 3: Upload to Google Drive and save to DB
    for (const htmlDoc of htmlDocuments) {
      // Gather generated file variants for this template
      const variants: Array<{ ext: string; buffer: Buffer; mimeType: string }> =
        [];

      if (generatePdf) {
        const pdfResult = pdfResults.find(
          (r) => r.filename === `${htmlDoc.uniqueKey}.pdf`,
        );
        if (pdfResult) {
          variants.push({
            ext: 'pdf',
            buffer: pdfResult.buffer,
            mimeType: 'application/pdf',
          });
        }
      }
      if (generateDocx) {
        const docxResult = docxResults.find(
          (r) => r.filename === `${htmlDoc.uniqueKey}.docx`,
        );
        if (docxResult) {
          variants.push({
            ext: 'docx',
            buffer: docxResult.buffer,
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        }
      }

      if (variants.length === 0) {
        documents.push({
          templateId: htmlDoc.template.id,
          templateName: htmlDoc.displayName,
          documentId: '',
          documentName: htmlDoc.documentName,
          documentUrl: '',
          status: 'error',
          error: `Error generando ${outputFormat === 'both' ? 'PDF/DOCX' : outputFormat.toUpperCase()}`,
        });
        continue;
      }

      // Upload and save each variant (PDF, DOCX, or both)
      for (const variant of variants) {
        const variantDocName = htmlDoc.documentName.replace(
          /\.pdf$/,
          `.${variant.ext}`,
        );
        try {
          let fileId = '';
          let fileUrl = '';

          if (caseFolderId) {
            try {
              const { googleDriveService } = await import('@/lib/google-drive');

              let targetFolderId = caseFolderId;
              if (htmlDoc.template.folderPath.length > 0) {
                targetFolderId = await googleDriveService.createFolderHierarchy(
                  htmlDoc.template.folderPath,
                  caseFolderId,
                );
              }

              const uploadResult =
                await googleDriveService.uploadDocumentToCase(
                  variantDocName,
                  variant.buffer,
                  targetFolderId,
                );
              fileId = uploadResult.fileId;
              fileUrl = uploadResult.fileUrl;
            } catch (uploadError) {
              console.warn(
                `Drive upload failed for ${htmlDoc.template.name} (${variant.ext}):`,
                uploadError,
              );
            }
          }

          const document = await prisma.document.create({
            data: {
              name: variantDocName,
              type: 'generated',
              status: 'Generado',
              uploadDate: new Date(),
              url: fileUrl || '',
              googleDriveId: fileId || undefined,
              caseId: caseData.id,
              tenantId,
              fileName: variantDocName,
              mimeType: variant.mimeType,
              isGenerated: true,
            },
          });

          documents.push({
            templateId: htmlDoc.template.id,
            templateName: htmlDoc.displayName,
            documentId: document.id,
            documentName: variantDocName,
            documentUrl: fileUrl,
            status: 'success',
          });
        } catch (saveError) {
          console.error(
            `Error saving document ${htmlDoc.template.name} (${variant.ext}):`,
            saveError,
          );
          documents.push({
            templateId: htmlDoc.template.id,
            templateName: htmlDoc.displayName,
            documentId: '',
            documentName: variantDocName,
            documentUrl: '',
            status: 'error',
            error:
              saveError instanceof Error
                ? saveError.message
                : 'Error guardando documento',
          });
        }
      }
    }

    const successfulDocuments = documents.filter(
      (d) => d.status === 'success',
    ).length;
    // C-3: los bloqueados por datos incompletos no son fallos técnicos; se
    // cuentan aparte para que el usuario sepa que la acción es completar el
    // expediente, no reintentar.
    const skippedDocuments = documents.filter(
      (d) => d.status === 'skipped',
    ).length;
    const failedDocuments = documents.filter(
      (d) => d.status === 'error',
    ).length;

    revalidatePath('/documents');

    if (successfulDocuments > 0) {
      createAuditLog({
        action: 'created',
        entityType: 'document',
        entityId: caseData.id,
        entityName: `${successfulDocuments} documentos para caso ${caseData.caseNumber}`,
        actor: {
          userId: user.id,
          userName: user.name,
          userCedula: user.professionalCard,
        },
        tenantId,
      });
    }

    // C-4: libera el lock y deja el resultado consultable por el polling.
    await completeGenerationRequest(generationRequestId, {
      total: documents.length,
      success: successfulDocuments,
      errors: failedDocuments,
    });
    generationRequestId = null;

    return {
      success: true,
      message: `Generación completada: ${successfulDocuments} exitosos, ${failedDocuments} fallidos${skippedDocuments > 0 ? `, ${skippedDocuments} no generados por datos incompletos` : ''}`,
      data: {
        caseId: caseData.id,
        caseNumber: caseData.caseNumber,
        folderId: caseFolderId,
        folderUrl: caseFolderUrl,
        documents,
        generatedAt: new Date(),
        totalDocuments: documents.length,
        successfulDocuments,
        failedDocuments,
        skippedDocuments,
      },
    };
  } catch (error) {
    logger.error('Error in batch document generation', error, {
      action: 'batch-generate-documents',
    });

    // C-4: liberar el lock para que el usuario pueda reintentar; si esto
    // fallara, el recuperador de huérfanos lo libera a los 10 min.
    if (generationRequestId) {
      await failGenerationRequest(generationRequestId, error).catch(() => {});
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Error en la generación por lotes',
      data: null,
    };
  }
}

// ============================================
// FILE UPLOAD SECURITY
// ============================================

const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

/**
 * Sanitizes a filename to prevent path traversal and script execution.
 * Removes special characters, limits length, preserves extension.
 */
function sanitizeFileName(fileName: string): string {
  // Remove path separators and null bytes
  let sanitized = fileName.replace(/[\\/\0]/g, '');
  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '');
  // Only allow alphanumeric, hyphens, underscores, dots, spaces
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.\sáéíóúñÁÉÍÓÚÑ()]/g, '_');
  // Collapse multiple underscores/spaces
  sanitized = sanitized.replace(/[_\s]+/g, '_');
  // Limit length (keep extension)
  const ext =
    sanitized.lastIndexOf('.') > 0
      ? sanitized.substring(sanitized.lastIndexOf('.'))
      : '';
  const name = sanitized.substring(
    0,
    sanitized.lastIndexOf('.') > 0
      ? sanitized.lastIndexOf('.')
      : sanitized.length,
  );
  const maxNameLen = 200 - ext.length;
  sanitized = name.substring(0, maxNameLen) + ext;
  // Fallback
  if (!sanitized || sanitized === ext) {
    sanitized = `documento_${Date.now()}${ext || '.pdf'}`;
  }
  return sanitized;
}

/**
 * Validates that a MIME type is in the allowed list and matches the file extension.
 */
function validateFileType(
  fileName: string,
  mimeType: string,
): { valid: boolean; error?: string } {
  if (
    !ALLOWED_UPLOAD_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${mimeType}. Solo se aceptan PDF, JPG y PNG.`,
    };
  }

  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  const allowedExtensions = MIME_TO_EXTENSIONS[mimeType];
  if (allowedExtensions && !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `La extensión ${ext} no coincide con el tipo ${mimeType}.`,
    };
  }

  return { valid: true };
}

// Upload user-provided documents (e.g., cédula, REDAM) to the case folder in Drive
export async function uploadCaseDocuments(input: {
  caseId: string;
  personName: string;
  documents: Array<{
    docName: string;
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }>;
}) {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes(P.GENERAR_DOCUMENTOS)) {
      return {
        success: false,
        error: 'No tienes permisos para subir documentos',
      };
    }

    const validatedInput = uploadCaseDocumentsInputSchema.parse(input);
    const { caseId, documents } = validatedInput;

    // Validate each file type before any upload
    for (const d of documents) {
      const typeCheck = validateFileType(d.fileName, d.mimeType);
      if (!typeCheck.valid) {
        return { success: false, error: typeCheck.error };
      }
    }

    const { googleDriveService } = await import('@/lib/google-drive');

    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: {
        caseNumber: true,
        id: true,
        centroConciliacionNombre: true,
        driveFolderId: true,
        layoutVersion: true,
      },
    });

    if (!caseData) {
      throw new Error('Caso no encontrado');
    }

    // Resolve center folder name from case data or tenant
    const centerFolderName = resolveCenterFolderName(
      tenantId,
      caseData.centroConciliacionNombre,
    );

    // Note: Cross-center security is enforced by Prisma's tenantId filter
    // on the case query above. The resolveCenterFolderName function uses the
    // authoritative tenant→center mapping, so the folder is always correct.

    let caseFolderId: string;

    if (caseData.layoutVersion >= 1 && caseData.driveFolderId) {
      // Layout v1: use the persisted case folder (sectioned hierarchy already exists)
      caseFolderId = caseData.driveFolderId;
    } else {
      // Legacy v0: ensure documentos-generados/{center}/{caseNumber}/
      const docGenFolderId = await findOrCreateDocumentosGeneradosFolder();
      const centerFolderId = await googleDriveService.createFolderHierarchy(
        [centerFolderName],
        docGenFolderId,
      );
      caseFolderId = await googleDriveService.findOrCreateCaseFolder(
        caseData.caseNumber,
        centerFolderId,
      );
      if (!caseData.driveFolderId) {
        await prisma.case.update({
          where: { id: caseId, tenantId },
          data: { driveFolderId: caseFolderId },
        });
      }
    }

    // Adjuntos subfolder name depends on layout version
    const adjuntosFolderName =
      caseData.layoutVersion >= 1 ? '02-Adjuntos' : 'Adjuntos';
    const adjuntosFolderId = await googleDriveService.createFolderHierarchy(
      [adjuntosFolderName],
      caseFolderId,
    );

    let uploaded = 0;

    for (const d of documents) {
      const safeFileName = sanitizeFileName(d.fileName);
      const buffer = Buffer.from(d.dataBase64, 'base64');
      const fileId = await googleDriveService.uploadFile(
        safeFileName,
        buffer,
        d.mimeType,
        adjuntosFolderId,
      );

      const fileUrl = googleDriveService.getFileUrl(fileId);

      await prisma.document.create({
        data: {
          name: d.docName,
          type: d.docName,
          status: 'Cargado',
          uploadDate: new Date(),
          url: fileUrl,
          googleDriveId: fileId,
          fileName: safeFileName,
          mimeType: d.mimeType,
          isGenerated: false,
          section: 'ADJUNTO',
          templateFolderPath: [adjuntosFolderName],
          caseId: caseId,
          tenantId,
        },
      });

      await prisma.documentFromDrive.upsert({
        where: {
          googleDriveId_tenantId: { googleDriveId: fileId, tenantId },
        },
        update: {
          fileName: safeFileName,
          mimeType: d.mimeType,
          folderPath: [
            centerFolderName,
            caseData.caseNumber,
            adjuntosFolderName,
          ],
          parentFolderId: adjuntosFolderId,
          updatedAt: new Date(),
        },
        create: {
          googleDriveId: fileId,
          fileName: safeFileName,
          mimeType: d.mimeType,
          folderPath: [
            centerFolderName,
            caseData.caseNumber,
            adjuntosFolderName,
          ],
          parentFolderId: adjuntosFolderId,
          isFolder: false,
          tenantId,
        },
      });

      uploaded++;
    }

    if (uploaded > 0) {
      createAuditLog({
        action: 'created',
        entityType: 'document',
        entityId: caseId,
        entityName: `${uploaded} documentos adjuntos para caso ${caseData.caseNumber}`,
        actor: {
          userId: user.id,
          userName: user.name,
          userCedula: user.professionalCard,
        },
        tenantId,
      });
    }

    const result = uploadCaseDocumentsOutputSchema.parse({ uploaded });
    return { success: true, data: result };
  } catch (error) {
    console.error(
      'Error uploading case documents:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al subir documentos del caso',
    };
  }
}

/**
 * Finds or creates the "documentos-generados" root folder in Google Drive.
 * Reusable helper to avoid duplicating this logic across functions.
 */
async function findOrCreateDocumentosGeneradosFolder(): Promise<string> {
  const { googleDriveService } = await import('@/lib/google-drive');
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const rootContents =
    await googleDriveService.listFoldersAndFiles(rootFolderId);
  const documentsFolder = rootContents.folders.find(
    (folder) => folder.name?.toLowerCase() === 'documentos-generados',
  );

  if (documentsFolder?.id) {
    return documentsFolder.id;
  }

  console.log('Carpeta "documentos-generados" no encontrada. Creando...');
  const newFolderId = await googleDriveService.createFolder(
    'documentos-generados',
    rootFolderId,
  );
  console.log('Carpeta "documentos-generados" creada con ID:', newFolderId);
  return newFolderId;
}

/**
 * Creates (or finds) the case folder inside the center's subfolder.
 * Structure: documentos-generados/{centerFolderName}/{caseNumber}/
 *
 * @param caseNumber - The case number (e.g., "CON-2024-001")
 * @param centerFolderName - The center folder name (e.g., "Armonia", "Construpaz")
 * @param prisma - Prisma client
 * @param tenantId - Tenant ID for DB records
 */
async function createCaseFolderInGoogleDrive(
  caseNumber: string,
  centerFolderName: string,
  prisma: PrismaClient,
  tenantId: string,
) {
  const { googleDriveService } = await import('@/lib/google-drive');

  // 1. Get or create "documentos-generados"
  const docGenFolderId = await findOrCreateDocumentosGeneradosFolder();

  // 2. Get or create center subfolder: documentos-generados/{centerFolderName}/
  const centerFolderId = await googleDriveService.createFolderHierarchy(
    [centerFolderName],
    docGenFolderId,
  );

  // 3. Get or create case folder: documentos-generados/{centerFolderName}/{caseNumber}/
  const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
    caseNumber,
    centerFolderId,
  );

  await prisma.documentFromDrive.upsert({
    where: {
      googleDriveId_tenantId: {
        googleDriveId: caseFolderId,
        tenantId,
      },
    },
    update: {
      fileName: caseNumber,
      folderPath: [centerFolderName],
      parentFolderId: centerFolderId,
      updatedAt: new Date(),
    },
    create: {
      googleDriveId: caseFolderId,
      fileName: caseNumber,
      mimeType: 'application/vnd.google-apps.folder',
      folderPath: [centerFolderName],
      parentFolderId: centerFolderId,
      isFolder: true,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return {
    id: caseFolderId,
    name: caseNumber,
    webViewLink: googleDriveService.getFolderUrl(caseFolderId),
  };
}

// Old DOCX/Google Drive pipeline functions removed (processTemplateForCase,
// generateWordDocument, generateExcelDocument, createPlaceholderData).
// Now using the HTML local pipeline via placeholder-mapper + html-to-pdf.
