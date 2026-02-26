'use server';

import { revalidatePath } from 'next/cache';
import type { PrismaClient } from '@prisma/client';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
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
import type { CaseWithRelations } from '../case/schemas';

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
  packageNumber?: 1 | 2 | 3 | 4 | 5;
  outputFormat?: 'docx' | 'pdf';
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
    const { caseId, templateIds, packageNumber } = validatedInput;

    // Load case with ALL relations needed for placeholder mapping
    const caseData = await prisma.case.findUnique({
      where: { id: caseId, tenantId },
      include: {
        debtor: true,
        operator: true,
        debts: { include: { creditor: true } },
        assets: true,
        documents: true,
        libranzas: true,
        suspendedServices: true,
        dependents: true,
        legalProcesses: true,
        acreedores: true,
        bienes: true,
        procesosJudiciales: true,
      },
    });

    if (!caseData) {
      throw new Error('Caso no encontrado');
    }

    // Check user permissions
    const canViewAllCases = user.permissions.includes('Ver todos los casos');
    const canViewOwnCases = user.permissions.includes('Ver casos propios');
    const canViewAsClient = user.permissions.includes('Ver casos como cliente');

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

    // Get HTML templates to process
    const {
      ALL_TEMPLATES,
      getTemplatesByPackage,
      getTemplatePath,
    } = await import('./templates-config');

    let templatesToProcess: DocumentTemplate[];

    if (templateIds && templateIds.length > 0) {
      templatesToProcess = ALL_TEMPLATES.filter(t => templateIds.includes(t.id));
    } else if (packageNumber) {
      templatesToProcess = getTemplatesByPackage(packageNumber);
    } else {
      templatesToProcess = ALL_TEMPLATES;
    }

    if (templatesToProcess.length === 0) {
      throw new Error('No se encontraron plantillas para procesar');
    }

    // Map case data to placeholders
    const { mapCaseToPlaceholders, replacePlaceholders } = await import('./placeholder-mapper');

    // Transform Decimal fields to numbers for the mapper
    const transformedCaseData = {
      ...caseData,
      debts: caseData.debts?.map((debt) => ({
        ...debt,
        amount: Number(debt.amount),
        interestRate: debt.interestRate ? Number(debt.interestRate) : undefined,
      })) || [],
      assets: caseData.assets?.map((asset) => ({
        ...asset,
        value: asset.value ? Number(asset.value) : null,
        estimatedValue: asset.value ? Number(asset.value) : null,
      })) || [],
      debtor: caseData.debtor ? {
        ...caseData.debtor,
        monthlyIncome: caseData.debtor.monthlyIncome
          ? Number(caseData.debtor.monthlyIncome)
          : null,
      } : null,
    };

    const placeholders = mapCaseToPlaceholders(transformedCaseData as unknown as CaseWithRelations);

    // Read HTML templates, replace placeholders, generate PDFs
    const { promises: fsPromises } = await import('fs');
    const path = await import('path');
    const { batchHtmlToPdf } = await import('@/lib/html-to-pdf');

    const projectRoot = process.cwd();
    const assetsBaseDir = path.join(projectRoot, 'Documentos HTML');

    // Create case folder in Google Drive for storage
    let caseFolderId = '';
    let caseFolderUrl = '';

    try {
      const caseFolder = await createCaseFolderInGoogleDrive(
        caseData.caseNumber,
        prisma,
        tenantId,
      );
      caseFolderId = caseFolder.id;
      caseFolderUrl = caseFolder.webViewLink;
    } catch (driveError) {
      console.warn('Google Drive folder creation failed, continuing without upload:', driveError);
    }

    const documents: Array<{
      templateId: string;
      templateName: string;
      documentId: string;
      documentName: string;
      documentUrl: string;
      status: 'success' | 'error';
      error?: string;
    }> = [];

    // Phase 1: Read all templates and replace placeholders
    const htmlDocuments: Array<{
      html: string;
      uniqueKey: string;
      template: typeof templatesToProcess[number];
      documentName: string;
    }> = [];

    for (const template of templatesToProcess) {
      try {
        const templatePath = getTemplatePath(template);
        const fullPath = path.join(projectRoot, templatePath);
        const htmlContent = await fsPromises.readFile(fullPath, 'utf-8');
        const filledHtml = replacePlaceholders(htmlContent, placeholders);
        const documentName = `${template.name.replace(/\s+/g, '_')}_${caseData.caseNumber}.pdf`;

        htmlDocuments.push({
          html: filledHtml,
          uniqueKey: template.id,
          template,
          documentName,
        });
      } catch (readError) {
        console.error(`Error reading template ${template.name} from ${getTemplatePath(template)}:`, readError);
        documents.push({
          templateId: template.id,
          templateName: template.name,
          documentId: '',
          documentName: '',
          documentUrl: '',
          status: 'error',
          error: readError instanceof Error ? readError.message : 'Error leyendo plantilla',
        });
      }
    }

    // Phase 2: Generate all PDFs in a single Chromium instance
    // Use template.id as unique filename key to avoid collisions
    // (multiple templates share the same fileName, e.g. "Remision Juzgado F.html" x12)
    const pdfResults = await batchHtmlToPdf(
      htmlDocuments.map(d => ({ html: d.html, filename: `${d.uniqueKey}.html` })),
      {},
      assetsBaseDir,
    );

    // Phase 3: Upload to Google Drive and save to DB
    for (const htmlDoc of htmlDocuments) {
      const pdfResult = pdfResults.find(r => r.filename === `${htmlDoc.uniqueKey}.pdf`);

      if (!pdfResult) {
        documents.push({
          templateId: htmlDoc.template.id,
          templateName: htmlDoc.template.name,
          documentId: '',
          documentName: htmlDoc.documentName,
          documentUrl: '',
          status: 'error',
          error: 'Error generando PDF',
        });
        continue;
      }

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

            const uploadResult = await googleDriveService.uploadDocumentToCase(
              htmlDoc.documentName,
              pdfResult.buffer,
              targetFolderId,
            );
            fileId = uploadResult.fileId;
            fileUrl = uploadResult.fileUrl;
          } catch (uploadError) {
            console.warn(`Drive upload failed for ${htmlDoc.template.name}:`, uploadError);
          }
        }

        const document = await prisma.document.create({
          data: {
            name: htmlDoc.documentName,
            type: 'generated',
            status: 'Generado',
            uploadDate: new Date(),
            url: fileUrl || '',
            googleDriveId: fileId || undefined,
            caseId: caseData.id,
            tenantId,
            fileName: htmlDoc.documentName,
            mimeType: 'application/pdf',
            isGenerated: true,
          },
        });

        documents.push({
          templateId: htmlDoc.template.id,
          templateName: htmlDoc.template.name,
          documentId: document.id,
          documentName: htmlDoc.documentName,
          documentUrl: fileUrl,
          status: 'success',
        });
      } catch (saveError) {
        console.error(`Error saving document ${htmlDoc.template.name}:`, saveError);
        documents.push({
          templateId: htmlDoc.template.id,
          templateName: htmlDoc.template.name,
          documentId: '',
          documentName: htmlDoc.documentName,
          documentUrl: '',
          status: 'error',
          error: saveError instanceof Error ? saveError.message : 'Error guardando documento',
        });
      }
    }

    const successfulDocuments = documents.filter(d => d.status === 'success').length;
    const failedDocuments = documents.length - successfulDocuments;

    revalidatePath('/documents');

    return {
      success: true,
      message: `Generación completada: ${successfulDocuments} exitosos, ${failedDocuments} fallidos`,
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

// Old DOCX/Google Drive pipeline functions removed (processTemplateForCase,
// generateWordDocument, generateExcelDocument, createPlaceholderData).
// Now using the HTML local pipeline via placeholder-mapper + html-to-pdf.
