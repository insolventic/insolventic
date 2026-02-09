'use server';

import { revalidatePath } from 'next/cache';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import libre from 'libreoffice-convert';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import type { PrismaClient } from '@prisma/client';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';

const libreConvert = promisify(libre.convert);

import {
  getTemplatesFromDatabaseOutputSchema,
  syncTemplatesWithGoogleDriveOutputSchema,
  batchGenerateDocumentsInputSchema,
  caseWithRelationsSchema,
  getDocumentsFromDriveOutputSchema,
  syncDocumentsWithGoogleDriveOutputSchema,
  type CaseWithRelations,
  uploadCaseDocumentsInputSchema,
  uploadCaseDocumentsOutputSchema,
} from './schemas';

export async function getTemplatesFromDatabase() {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes('Ver documentos')) {
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

    if (!user.permissions.includes('Ver documentos')) {
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

    if (!user.permissions.includes('Ver documentos')) {
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

    const filteredDocuments = documents.filter((doc) => {
      if (doc.isFolder) {
        if (
          doc.folderPath.length === 0 &&
          caseNumberPattern.test(doc.fileName)
        ) {
          return true;
        }
        if (
          doc.folderPath.length > 0 &&
          caseNumberPattern.test(doc.folderPath[0])
        ) {
          return true;
        }
        return false;
      } else {
        return (
          doc.folderPath &&
          doc.folderPath.length > 0 &&
          caseNumberPattern.test(doc.folderPath[0])
        );
      }
    });

    // Check user permissions to determine case visibility scope
    const canViewAllCases = user.permissions.includes('Ver todos los casos');
    const canViewOwnCases = user.permissions.includes('Ver casos propios');
    const canViewAsClient = user.permissions.includes('Ver casos como cliente');

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
        let caseNumber: string | undefined;

        if (doc.isFolder) {
          if (
            doc.folderPath.length === 0 &&
            caseNumberPattern.test(doc.fileName)
          ) {
            caseNumber = doc.fileName;
          } else if (
            doc.folderPath.length > 0 &&
            caseNumberPattern.test(doc.folderPath[0])
          ) {
            caseNumber = doc.folderPath[0];
          }
        } else {
          if (
            doc.folderPath &&
            doc.folderPath.length > 0 &&
            caseNumberPattern.test(doc.folderPath[0])
          ) {
            caseNumber = doc.folderPath[0];
          }
        }

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

    if (!user.permissions.includes('Ver documentos')) {
      return {
        success: false,
        error: 'No tienes permisos para sincronizar documentos',
      };
    }

    console.log('Starting Google Drive documents sync process...');
    const { googleDriveService } = await import('@/lib/google-drive');

    // Primero, buscar la carpeta "archivos" y luego "documentos-generados" dentro de ella
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

    let documentsFolder;

    if (archivosFolder && archivosFolder.id) {
      console.log(
        'Found archivos folder, searching for documentos-generados inside it...',
      );
      const archivosContents = await googleDriveService.listFoldersAndFiles(
        archivosFolder.id,
      );
      documentsFolder = archivosContents.folders.find(
        (folder) => folder.name?.toLowerCase() === 'documentos-generados',
      );
    } else {
      console.log(
        'No archivos folder found, searching for documentos-generados in root...',
      );
      documentsFolder = rootContents.folders.find(
        (folder) => folder.name?.toLowerCase() === 'documentos-generados',
      );
    }

    if (!documentsFolder || !documentsFolder.id) {
      console.log('Carpeta "documentos-generados" no encontrada. Creando...');
      try {
        const newFolderId = await googleDriveService.createFolder(
          'documentos-generados',
          rootFolderId,
        );
        documentsFolder = { id: newFolderId, name: 'documentos-generados' };
        console.log(
          'Carpeta "documentos-generados" creada con ID:',
          newFolderId,
        );
      } catch (error) {
        console.error(
          'Error al crear la carpeta "documentos-generados":',
          error,
        );
        return {
          synced: 0,
          created: 0,
          updated: 0,
          folders: 0,
        };
      }
    }

    const casesFolderId = documentsFolder.id!;
    console.log('Found documentos-generados folder with ID:', casesFolderId);

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
        await prisma.documentFromDrive.create({
          data: {
            googleDriveId: folder.id,
            fileName: folder.name,
            mimeType: 'application/vnd.google-apps.folder',
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

    const documentFiles = driveData.files.filter(
      (file) => file.mimeType && !file.mimeType.includes('folder'),
    );

    for (const file of documentFiles) {
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
        const shouldUpdateFolderPath =
          existingDocument.folderPath.length === 0 ||
          !caseNumberPattern.test(existingDocument.folderPath[0]);

        await prisma.documentFromDrive.update({
          where: { id: existingDocument.id },
          data: {
            fileName: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            folderPath: shouldUpdateFolderPath
              ? file.path
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
            folderPath: file.path,
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

export async function batchGenerateDocuments(input: {
  caseId: string;
  templateIds?: string[];
  outputFormat: 'docx' | 'pdf';
}) {
  try {
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes('Generar documentos')) {
      return {
        success: false,
        message: 'No tienes permisos para generar documentos',
        data: null,
      };
    }

    const validatedInput = batchGenerateDocumentsInputSchema.parse(input);
    const { caseId, templateIds, outputFormat } = validatedInput;

    const caseData = await getCaseWithRelationsForGeneration(caseId, prisma);
    if (!caseData) {
      throw new Error('Caso no encontrado');
    }

    // Check user permissions to determine if they can generate documents for this case
    const canViewAllCases = user.permissions.includes('Ver todos los casos');
    const canViewOwnCases = user.permissions.includes('Ver casos propios');
    const canViewAsClient = user.permissions.includes('Ver casos como cliente');

    let hasAccessToCase = false;

    if (canViewAllCases) {
      hasAccessToCase = true;
    } else if (canViewOwnCases) {
      // Can only generate documents for cases they are working on
      hasAccessToCase = caseData.operatorId === user.id;
    } else if (canViewAsClient) {
      // Can only generate documents for cases where they are the debtor
      const userDebtor = await prisma.debtor.findFirst({
        where: {
          email: user.email,
          tenantId,
        },
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

    const templates = await getTemplatesToProcess(templateIds, prisma);
    if (templates.length === 0) {
      throw new Error('No se encontraron plantillas para procesar');
    }

    const caseFolder = await createCaseFolderInGoogleDrive(
      caseData.caseNumber,
      prisma,
      tenantId,
    );

    const transformedCaseData = {
      ...caseData,
      debts:
        caseData.debts?.map((debt) => ({
          id: debt.id,
          amount: Number(debt.amount),
          interestRate: debt.interestRate
            ? Number(debt.interestRate)
            : undefined,
          type: debt.type,
          caseId: debt.caseId,
          creditorId: debt.creditorId,
          debtorId: debt.debtorId,
          creditor: debt.creditor
            ? {
                ...debt.creditor,
              }
            : null,
        })) || [],
      assets:
        caseData.assets?.map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          value: asset.value ? Number(asset.value) : null,
          estimatedValue: asset.value ? Number(asset.value) : null,
          caseId: asset.caseId,
          debtorId: asset.debtorId,
        })) || [],
      debtor: caseData.debtor
        ? {
            ...caseData.debtor,
            monthlyIncome: caseData.debtor.monthlyIncome
              ? Number(caseData.debtor.monthlyIncome)
              : null,
          }
        : null,
    };

    const validatedCaseData =
      caseWithRelationsSchema.parse(transformedCaseData);

    const results = await Promise.allSettled(
      templates.map((template) =>
        processTemplateForCase(
          template,
          validatedCaseData,
          caseFolder,
          outputFormat,
          prisma,
          tenantId,
        ),
      ),
    );

    const documents = results.map((result, index) => {
      const template = templates[index];
      if (result.status === 'fulfilled') {
        return {
          templateId: template.id,
          templateName: template.fileName,
          documentId: result.value.documentId,
          documentName: result.value.documentName,
          documentUrl: result.value.documentUrl,
          status: 'success' as const,
        };
      } else {
        return {
          templateId: template.id,
          templateName: template.fileName,
          documentId: '',
          documentName: '',
          documentUrl: '',
          status: 'error' as const,
          error: result.reason?.message || 'Error desconocido',
        };
      }
    });

    const successfulDocuments = documents.filter(
      (doc) => doc.status === 'success',
    ).length;
    const failedDocuments = documents.length - successfulDocuments;

    try {
      console.log('Starting Google Drive documents sync process...');
      const { googleDriveService } = await import('@/lib/google-drive');

      // Buscar la carpeta "documentos-generados"
      const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
      const rootContents =
        await googleDriveService.listFoldersAndFiles(rootFolderId);
      const documentsFolder = rootContents.folders.find(
        (folder) => folder.name?.toLowerCase() === 'documentos-generados',
      );

      if (!documentsFolder || !documentsFolder.id) {
        console.error(
          'No se encontró la carpeta "documentos-generados" en Google Drive',
        );
        throw new Error(
          'No se encontró la carpeta "documentos-generados" en Google Drive',
        );
      }

      const casesFolderId = documentsFolder.id;

      console.log(
        'Fetching folders and files from documentos-generados folder in Google Drive...',
      );
      const driveData =
        await googleDriveService.listAllFoldersAndFilesRecursively(
          casesFolderId,
        );
      console.log(
        `Found ${driveData.folders.length} folders and ${driveData.files.length} files in Cases folder`,
      );

      let created = 0;
      let updated = 0;
      let folders = 0;

      for (const folder of driveData.folders) {
        const existingFolder = await prisma.documentFromDrive.findUnique({
          where: {
            googleDriveId_tenantId: {
              googleDriveId: folder.id,
              tenantId,
            },
          },
        });

        if (existingFolder) {
          const shouldUpdateFolderPath =
            JSON.stringify(existingFolder.folderPath) !==
            JSON.stringify(folder.path);

          if (shouldUpdateFolderPath) {
            await prisma.documentFromDrive.update({
              where: { id: existingFolder.id },
              data: {
                folderPath: folder.path,
              },
            });
            updated++;
          }
        } else {
          await prisma.documentFromDrive.create({
            data: {
              googleDriveId: folder.id,
              fileName: folder.name,
              mimeType: 'application/vnd.google-apps.folder',
              folderPath: folder.path,
              parentFolderId: folder.parentId,
              isFolder: true,
              size: null,
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

      const documentFiles = driveData.files;
      for (const file of documentFiles) {
        const existingDocument = await prisma.documentFromDrive.findUnique({
          where: {
            googleDriveId_tenantId: {
              googleDriveId: file.id,
              tenantId,
            },
          },
        });

        if (existingDocument) {
          const shouldUpdateFolderPath =
            JSON.stringify(existingDocument.folderPath) !==
            JSON.stringify(file.path);

          if (shouldUpdateFolderPath) {
            await prisma.documentFromDrive.update({
              where: { id: existingDocument.id },
              data: {
                folderPath: shouldUpdateFolderPath
                  ? file.path
                  : existingDocument.folderPath,
              },
            });
            updated++;
          }
        } else {
          await prisma.documentFromDrive.create({
            data: {
              googleDriveId: file.id,
              fileName: file.name,
              mimeType: file.mimeType || 'application/octet-stream',
              folderPath: file.path,
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

      console.log('Documents synced with Google Drive after generation:', {
        synced: documentFiles.length + folders,
        created,
        updated,
        folders,
      });
    } catch (syncError) {
      console.error('Error syncing documents after generation:', syncError);
    }

    revalidatePath('/documents');

    return {
      success: true,
      message: `Generación completada: ${successfulDocuments} exitosos, ${failedDocuments} fallidos`,
      data: {
        caseId: caseData.id,
        caseNumber: caseData.caseNumber,
        folderId: caseFolder.id,
        folderUrl: caseFolder.webViewLink,
        documents,
        generatedAt: new Date(),
        totalDocuments: documents.length,
        successfulDocuments,
        failedDocuments,
      },
    };
  } catch (error) {
    console.error('Error in batch document generation:', error);
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

    if (!user.permissions.includes('Generar documentos')) {
      return {
        success: false,
        error: 'No tienes permisos para subir documentos',
      };
    }

    const validatedInput = uploadCaseDocumentsInputSchema.parse(input);
    const { caseId, personName, documents } = validatedInput;

    const { googleDriveService } = await import('@/lib/google-drive');

    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      select: { caseNumber: true, id: true },
    });

    if (!caseData) {
      throw new Error('Caso no encontrado');
    }

    // Ensure case folder exists
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    const rootContents =
      await googleDriveService.listFoldersAndFiles(rootFolderId);
    let documentsFolder = rootContents.folders.find(
      (f) => f.name?.toLowerCase() === 'documentos-generados',
    );
    if (!documentsFolder || !documentsFolder.id) {
      const newId = await googleDriveService.createFolder(
        'documentos-generados',
        rootFolderId,
      );
      documentsFolder = { id: newId, name: 'documentos-generados' } as {
        id: string;
        name: string;
      };
    }

    const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
      caseData.caseNumber,
      documentsFolder.id!,
    );

    // Create subfolder per person inside case folder
    const personFolderId = await googleDriveService.createFolderHierarchy(
      ['Personas', personName],
      caseFolderId,
    );

    let uploaded = 0;

    for (const d of documents) {
      const buffer = Buffer.from(d.dataBase64, 'base64');
      const fileId = await googleDriveService.uploadFile(
        d.fileName,
        buffer,
        d.mimeType,
        personFolderId,
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
          fileName: d.fileName,
          mimeType: d.mimeType,
          isGenerated: false,
          templateFolderPath: ['Personas', personName],
          caseId: caseId,
          tenantId,
        },
      });

      await prisma.documentFromDrive.upsert({
        where: {
          googleDriveId_tenantId: { googleDriveId: fileId, tenantId },
        },
        update: {
          fileName: d.fileName,
          mimeType: d.mimeType,
          folderPath: [caseData.caseNumber, 'Personas', personName],
          parentFolderId: personFolderId,
          updatedAt: new Date(),
        },
        create: {
          googleDriveId: fileId,
          fileName: d.fileName,
          mimeType: d.mimeType,
          folderPath: [caseData.caseNumber, 'Personas', personName],
          parentFolderId: personFolderId,
          isFolder: false,
          tenantId,
        },
      });

      uploaded++;
    }

    const result = uploadCaseDocumentsOutputSchema.parse({ uploaded });
    return { success: true, data: result };
  } catch (error) {
    console.error('Error uploading case documents:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al subir documentos del caso',
    };
  }
}

async function getCaseWithRelationsForGeneration(
  caseId: string,
  prisma: PrismaClient,
) {
  return await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      debtor: true,
      operator: true,
      debts: {
        include: {
          creditor: true,
        },
      },
      assets: true,
      documents: true,
    },
  });
}

async function getTemplatesToProcess(
  templateIds: string[] | undefined,
  prisma: PrismaClient,
) {
  if (templateIds && templateIds.length > 0) {
    return await prisma.documentTemplate.findMany({
      where: {
        id: { in: templateIds },
        isFolder: false,
      },
      select: {
        id: true,
        googleDriveId: true,
        fileName: true,
        folderPath: true,
      },
    });
  } else {
    return await prisma.documentTemplate.findMany({
      where: {
        isFolder: false,
      },
      select: {
        id: true,
        googleDriveId: true,
        fileName: true,
        folderPath: true,
      },
    });
  }
}

async function ensureFolderHierarchyInDatabase(
  folderPath: string[],
  caseNumber: string,
  caseFolderId: string,
  prisma: PrismaClient,
  tenantId: string,
) {
  const { googleDriveService } = await import('@/lib/google-drive');

  let currentParentId = caseFolderId;
  const currentPath: string[] = [caseNumber];

  for (const folderName of folderPath) {
    currentPath.push(folderName);

    const existingFolders =
      await googleDriveService.listFoldersAndFiles(currentParentId);
    const folder = existingFolders.folders.find((f) => f.name === folderName);

    if (folder && folder.id) {
      await prisma.documentFromDrive.upsert({
        where: {
          googleDriveId_tenantId: {
            googleDriveId: folder.id,
            tenantId,
          },
        },
        update: {
          fileName: folderName,
          folderPath: [...currentPath.slice(0, -1)],
          parentFolderId: currentParentId,
          updatedAt: new Date(),
        },
        create: {
          googleDriveId: folder.id,
          fileName: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          folderPath: [...currentPath.slice(0, -1)],
          parentFolderId: currentParentId,
          isFolder: true,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      currentParentId = folder.id;
    }
  }
}

async function createCaseFolderInGoogleDrive(
  caseNumber: string,
  prisma: PrismaClient,
  tenantId: string,
) {
  const { googleDriveService } = await import('@/lib/google-drive');

  // Buscar la carpeta "documentos-generados" primero
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const rootContents =
    await googleDriveService.listFoldersAndFiles(rootFolderId);
  let documentsFolder = rootContents.folders.find(
    (folder) => folder.name?.toLowerCase() === 'documentos-generados',
  );

  if (!documentsFolder || !documentsFolder.id) {
    console.log('Carpeta "documentos-generados" no encontrada. Creando...');
    const newFolderId = await googleDriveService.createFolder(
      'documentos-generados',
      rootFolderId,
    );
    documentsFolder = { id: newFolderId, name: 'documentos-generados' };
    console.log('Carpeta "documentos-generados" creada con ID:', newFolderId);
  }

  const casesFolderId = documentsFolder.id!;

  const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
    caseNumber,
    casesFolderId,
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
      folderPath: [],
      parentFolderId: casesFolderId,
      updatedAt: new Date(),
    },
    create: {
      googleDriveId: caseFolderId,
      fileName: caseNumber,
      mimeType: 'application/vnd.google-apps.folder',
      folderPath: [],
      parentFolderId: casesFolderId,
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

async function processTemplateForCase(
  template: {
    id: string;
    googleDriveId: string;
    fileName: string;
    folderPath?: string[];
  },
  caseData: CaseWithRelations,
  caseFolder: { id: string; name: string; webViewLink: string },
  outputFormat: 'docx' | 'pdf',
  prisma: PrismaClient,
  tenantId: string,
) {
  try {
    const { googleDriveService } = await import('@/lib/google-drive');

    const templateBuffer = await googleDriveService.downloadFile(
      template.googleDriveId,
    );

    const generatedBuffer = await generateDocumentWithPlaceholdersInternal(
      templateBuffer,
      caseData,
      outputFormat,
      template.fileName,
    );

    const isExcelTemplate =
      template.fileName.toLowerCase().endsWith('.xlsx') ||
      template.fileName.toLowerCase().endsWith('.xls');
    const fileExtension = isExcelTemplate ? 'xlsx' : outputFormat;
    const documentName = `${template.fileName.replace(/\.[^/.]+$/, '')}_${caseData.caseNumber}.${fileExtension}`;

    let targetFolderId = caseFolder.id;

    if (!caseFolder.id) {
      throw new Error(
        `No se pudo obtener el ID de la carpeta del caso ${caseData.caseNumber}`,
      );
    }

    if (template.folderPath && template.folderPath.length > 0) {
      targetFolderId = await googleDriveService.createFolderHierarchy(
        template.folderPath,
        caseFolder.id,
      );

      await ensureFolderHierarchyInDatabase(
        template.folderPath,
        caseData.caseNumber,
        caseFolder.id,
        prisma,
        tenantId,
      );
    }

    if (!targetFolderId) {
      throw new Error(
        `No se pudo determinar la carpeta de destino para ${template.fileName}`,
      );
    }
    const { fileId, fileUrl } = await googleDriveService.uploadDocumentToCase(
      documentName,
      generatedBuffer,
      targetFolderId,
    );

    const document = await prisma.document.create({
      data: {
        name: documentName,
        type: getDocumentTypeFromTemplate(template.fileName),
        status: 'Generado',
        uploadDate: new Date(),
        url: fileUrl,
        googleDriveId: fileId,
        caseId: caseData.id,
        templateId: template.id,
        templateFolderPath: template.folderPath || [],
        tenantId,
      },
    });

    const isExcelFile =
      template.fileName.toLowerCase().endsWith('.xlsx') ||
      template.fileName.toLowerCase().endsWith('.xls');
    const mimeType = isExcelFile
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const folderPath = [caseData.caseNumber, ...(template.folderPath || [])];
    await prisma.documentFromDrive.upsert({
      where: {
        googleDriveId_tenantId: {
          googleDriveId: fileId,
          tenantId,
        },
      },
      update: {
        fileName: documentName,
        folderPath: folderPath,
        parentFolderId: targetFolderId,
        updatedAt: new Date(),
      },
      create: {
        googleDriveId: fileId,
        fileName: documentName,
        mimeType: mimeType,
        folderPath: folderPath,
        parentFolderId: targetFolderId,
        isFolder: false,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      documentId: document.id,
      documentName,
      documentUrl: fileUrl,
    };
  } catch (error) {
    console.error(`Error processing template ${template.fileName}:`, error);
    throw error;
  }
}

async function generateDocumentWithPlaceholdersInternal(
  templateBuffer: Buffer,
  caseData: CaseWithRelations,
  outputFormat: 'docx' | 'pdf',
  templateFileName?: string,
): Promise<Buffer> {
  try {
    const isExcelFile =
      templateFileName?.toLowerCase().endsWith('.xlsx') ||
      templateFileName?.toLowerCase().endsWith('.xls');

    if (isExcelFile) {
      return await generateExcelDocument(templateBuffer, caseData);
    } else {
      return await generateWordDocument(templateBuffer, caseData, outputFormat);
    }
  } catch (error) {
    console.error('Error generating document with placeholders:', error);
    throw new Error('Error al generar documento con placeholders');
  }
}

async function generateWordDocument(
  templateBuffer: Buffer,
  caseData: CaseWithRelations,
  outputFormat: 'docx' | 'pdf',
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const placeholderData = createPlaceholderData(caseData);
  doc.render(placeholderData);

  const generatedBuffer = doc.getZip().generate({ type: 'nodebuffer' });

  if (outputFormat === 'pdf') {
    return await libreConvert(generatedBuffer, '.pdf', undefined);
  }

  return generatedBuffer;
}

async function generateExcelDocument(
  templateBuffer: Buffer,
  caseData: CaseWithRelations,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

  const placeholderData = createPlaceholderData(caseData);

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value && typeof cell.value === 'string') {
          let cellValue = cell.value;

          Object.entries(placeholderData).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              Object.entries(value).forEach(([subKey, subValue]) => {
                const placeholder = `{{${key}.${subKey}}}`;
                const stringValue = subValue?.toString() || '';
                cellValue = cellValue.replace(
                  new RegExp(placeholder, 'g'),
                  stringValue,
                );
              });
            } else {
              const placeholder = `{{${key}}}`;
              const stringValue = value?.toString() || '';
              cellValue = cellValue.replace(
                new RegExp(placeholder, 'g'),
                stringValue,
              );
            }
          });

          cell.value = cellValue;
        }
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function createPlaceholderData(caseData: CaseWithRelations) {
  return {
    case: {
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      type: caseData.type,
      status: caseData.status,
      createdAt: caseData.createdAt,
      updatedAt: caseData.updatedAt,
    },

    debtor: caseData.debtor
      ? {
          id: caseData.debtor.id,
          name: caseData.debtor.name,
          documentType: caseData.debtor.documentType,
          documentNumber: caseData.debtor.documentNumber,
          email: caseData.debtor.email,
          phone: caseData.debtor.phone,
          address: caseData.debtor.address,
          city: caseData.debtor.city,
          department: caseData.debtor.department,
          country: caseData.debtor.country,
          birthDate: caseData.debtor.birthDate,
          maritalStatus: caseData.debtor.maritalStatus,
          occupation: caseData.debtor.occupation,
          monthlyIncome: caseData.debtor.monthlyIncome,
          createdAt: caseData.debtor.createdAt,
          updatedAt: caseData.debtor.updatedAt,
        }
      : null,

    operator: caseData.operator
      ? {
          id: caseData.operator.id,
          name: caseData.operator.name,
          email: caseData.operator.email,
          role: caseData.operator.role,
        }
      : null,

    debts: caseData.debts
      ? caseData.debts.map((debt) => ({
          id: debt.id,
          amount: debt.amount,
          interestRate: debt.interestRate,
          type: debt.type,
          caseId: debt.caseId,
          creditorId: debt.creditorId,
          debtorId: debt.debtorId,
          creditor: debt.creditor
            ? {
                id: debt.creditor.id,
                name: debt.creditor.name,
                documentType: debt.creditor.documentType,
                documentNumber: debt.creditor.documentNumber,
                email: debt.creditor.email,
                phone: debt.creditor.phone,
                address: debt.creditor.address,
              }
            : null,
        }))
      : [],

    assets: caseData.assets
      ? caseData.assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          value: asset.value,
          estimatedValue: asset.estimatedValue || asset.value,
          caseId: asset.caseId,
          debtorId: asset.debtorId,
        }))
      : [],

    currentDate: new Date().toLocaleDateString('es-CO'),
    currentDateTime: new Date().toLocaleString('es-CO'),

    totalDebts: caseData.debts
      ? caseData.debts.reduce(
          (sum: number, debt) => sum + (Number(debt.amount) || 0),
          0,
        )
      : 0,
    totalAssets: caseData.assets
      ? caseData.assets.reduce(
          (sum: number, asset) => sum + (Number(asset.value) || 0),
          0,
        )
      : 0,
    debtCount: caseData.debts ? caseData.debts.length : 0,
    assetCount: caseData.assets ? caseData.assets.length : 0,
  };
}

function getDocumentTypeFromTemplate(fileName: string): string {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.includes('solicitud')) return 'Solicitud';
  if (lowerFileName.includes('declaracion')) return 'Declaración';
  if (lowerFileName.includes('certificado')) return 'Certificado';
  if (lowerFileName.includes('check') || lowerFileName.includes('lista'))
    return 'Lista de Verificación';
  if (lowerFileName.includes('designacion')) return 'Designación';
  if (lowerFileName.includes('auto')) return 'Auto';
  if (lowerFileName.includes('inadmision')) return 'Inadmisión';
  if (lowerFileName.includes('notificacion')) return 'Notificación';
  if (lowerFileName.includes('edicto')) return 'Edicto';
  if (lowerFileName.includes('suspension')) return 'Suspensión';
  if (lowerFileName.includes('formato')) return 'Formato';
  if (lowerFileName.includes('remision')) return 'Remisión';
  if (lowerFileName.includes('guia')) return 'Guía';
  if (lowerFileName.includes('hoja')) return 'Hoja de Trabajo';

  return 'Documento';
}
