/**
 * Document Generation Service
 * Generates PDF documents from HTML templates and uploads to Google Drive
 */

import { promises as fs } from 'fs';
import path from 'path';
import { googleDriveService } from '@/lib/google-drive';
import { htmlToPdf } from '@/lib/html-to-pdf';
import { mapCaseToPlaceholders, replacePlaceholders } from './placeholder-mapper';
import {
  getTemplatesForCaseCreation,
  getTemplatesForAdmission,
  getTemplatesForAgreement,
  getTemplatePath,
  type DocumentTemplate,
} from './templates-config';
import type { CaseWithRelations } from '../case/schemas';

/**
 * Result of document generation
 */
export interface GeneratedDocument {
  templateId: string;
  templateName: string;
  fileName: string;
  googleDriveId: string;
  googleDriveUrl: string;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Options for document generation
 */
export interface GenerationOptions {
  generatePdf?: boolean; // If false, saves as HTML
  uploadToGoogleDrive?: boolean;
  caseFolderId?: string; // Google Drive folder ID for the case
}

const defaultOptions: GenerationOptions = {
  generatePdf: true,
  uploadToGoogleDrive: true,
};

/**
 * Read HTML template from file system
 */
async function readTemplate(templatePath: string): Promise<string> {
  try {
    // Try reading from project root (for local development)
    const projectRoot = process.cwd();
    const fullPath = path.join(projectRoot, templatePath);
    return await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading template ${templatePath}:`, error);
    throw new Error(`No se pudo leer la plantilla: ${templatePath}`);
  }
}

/**
 * Get or create case folder in Google Drive
 */
async function getOrCreateCaseFolder(
  caseNumber: string,
  debtorName: string
): Promise<string> {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID no esta configurado');
    }

    // Create folder name: "CASO-XXXX - Nombre Deudor"
    const folderName = `${caseNumber} - ${debtorName}`;

    // Find or create the case folder
    const folderId = await googleDriveService.findOrCreateCaseFolder(
      folderName,
      rootFolderId
    );

    return folderId;
  } catch (error) {
    console.error('Error creating case folder:', error);
    throw new Error('Error al crear carpeta del caso en Google Drive');
  }
}

/**
 * Create subfolder structure within case folder
 */
async function createDocumentSubfolder(
  caseFolderId: string,
  folderPath: string[]
): Promise<string> {
  if (folderPath.length === 0) {
    return caseFolderId;
  }

  try {
    return await googleDriveService.createFolderHierarchy(
      folderPath,
      caseFolderId
    );
  } catch (error) {
    console.error('Error creating subfolder:', error);
    return caseFolderId; // Fallback to case folder
  }
}

/**
 * Generate a single document from template
 */
async function generateDocument(
  template: DocumentTemplate,
  caseData: CaseWithRelations,
  placeholders: Record<string, string>,
  caseFolderId: string,
  options: GenerationOptions
): Promise<GeneratedDocument> {
  try {
    // Read template HTML
    const templatePath = getTemplatePath(template);
    const htmlContent = await readTemplate(templatePath);

    // Replace placeholders
    const filledHtml = replacePlaceholders(htmlContent, placeholders);

    // Generate file name
    const baseFileName = `${caseData.caseNumber}_${template.name.replace(/\s+/g, '_')}`;
    const fileName = options.generatePdf
      ? `${baseFileName}.pdf`
      : `${baseFileName}.html`;

    // Generate PDF or keep as HTML
    let fileBuffer: Buffer;
    let mimeType: string;

    if (options.generatePdf) {
      fileBuffer = await htmlToPdf(filledHtml);
      mimeType = 'application/pdf';
    } else {
      fileBuffer = Buffer.from(filledHtml, 'utf-8');
      mimeType = 'text/html';
    }

    // Upload to Google Drive if enabled
    let googleDriveId = '';
    let googleDriveUrl = '';

    if (options.uploadToGoogleDrive && caseFolderId) {
      // Create subfolder if template has folder path
      const targetFolderId = await createDocumentSubfolder(
        caseFolderId,
        template.folderPath
      );

      googleDriveId = await googleDriveService.uploadFile(
        fileName,
        fileBuffer,
        mimeType,
        targetFolderId
      );
      googleDriveUrl = googleDriveService.getFileUrl(googleDriveId);
    }

    return {
      templateId: template.id,
      templateName: template.name,
      fileName,
      googleDriveId,
      googleDriveUrl,
      status: 'success',
    };
  } catch (error) {
    console.error(`Error generating document ${template.name}:`, error);
    return {
      templateId: template.id,
      templateName: template.name,
      fileName: '',
      googleDriveId: '',
      googleDriveUrl: '',
      status: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Generate all documents for a new case (on case creation)
 */
export async function generateDocumentsForNewCase(
  caseData: CaseWithRelations,
  options: GenerationOptions = {}
): Promise<{
  caseFolderId: string;
  caseFolderUrl: string;
  documents: GeneratedDocument[];
}> {
  const mergedOptions = { ...defaultOptions, ...options };
  const templates = getTemplatesForCaseCreation();
  const documents: GeneratedDocument[] = [];

  // Create case folder in Google Drive
  let caseFolderId = mergedOptions.caseFolderId || '';
  let caseFolderUrl = '';

  if (mergedOptions.uploadToGoogleDrive && !caseFolderId) {
    caseFolderId = await getOrCreateCaseFolder(
      caseData.caseNumber,
      caseData.debtor.name
    );
    caseFolderUrl = googleDriveService.getFolderUrl(caseFolderId);
  }

  // Map case data to placeholders
  const placeholders = mapCaseToPlaceholders(caseData);

  // Generate each document
  for (const template of templates) {
    const result = await generateDocument(
      template,
      caseData,
      placeholders,
      caseFolderId,
      mergedOptions
    );
    documents.push(result);
  }

  return {
    caseFolderId,
    caseFolderUrl,
    documents,
  };
}

/**
 * Generate admission documents (when case is admitted)
 */
export async function generateDocumentsForAdmission(
  caseData: CaseWithRelations,
  caseFolderId: string,
  options: GenerationOptions = {}
): Promise<GeneratedDocument[]> {
  const mergedOptions = { ...defaultOptions, ...options, caseFolderId };
  const templates = getTemplatesForAdmission();
  const documents: GeneratedDocument[] = [];

  const placeholders = mapCaseToPlaceholders(caseData);

  for (const template of templates) {
    const result = await generateDocument(
      template,
      caseData,
      placeholders,
      caseFolderId,
      mergedOptions
    );
    documents.push(result);
  }

  return documents;
}

/**
 * Generate agreement documents (when agreement is reached)
 */
export async function generateDocumentsForAgreement(
  caseData: CaseWithRelations,
  caseFolderId: string,
  options: GenerationOptions = {}
): Promise<GeneratedDocument[]> {
  const mergedOptions = { ...defaultOptions, ...options, caseFolderId };
  const templates = getTemplatesForAgreement();
  const documents: GeneratedDocument[] = [];

  const placeholders = mapCaseToPlaceholders(caseData);

  for (const template of templates) {
    const result = await generateDocument(
      template,
      caseData,
      placeholders,
      caseFolderId,
      mergedOptions
    );
    documents.push(result);
  }

  return documents;
}

/**
 * Regenerate a specific document
 */
export async function regenerateDocument(
  caseData: CaseWithRelations,
  templateId: string,
  caseFolderId: string,
  options: GenerationOptions = {}
): Promise<GeneratedDocument> {
  const { getTemplateById } = await import('./templates-config');
  const template = getTemplateById(templateId);

  if (!template) {
    return {
      templateId,
      templateName: 'Unknown',
      fileName: '',
      googleDriveId: '',
      googleDriveUrl: '',
      status: 'error',
      error: `Plantilla no encontrada: ${templateId}`,
    };
  }

  const mergedOptions = { ...defaultOptions, ...options, caseFolderId };
  const placeholders = mapCaseToPlaceholders(caseData);

  return generateDocument(
    template,
    caseData,
    placeholders,
    caseFolderId,
    mergedOptions
  );
}

/**
 * Generate batch of specific documents
 */
export async function generateSpecificDocuments(
  caseData: CaseWithRelations,
  templateIds: string[],
  caseFolderId: string,
  options: GenerationOptions = {}
): Promise<GeneratedDocument[]> {
  const { getTemplateById } = await import('./templates-config');
  const mergedOptions = { ...defaultOptions, ...options, caseFolderId };
  const placeholders = mapCaseToPlaceholders(caseData);
  const documents: GeneratedDocument[] = [];

  for (const templateId of templateIds) {
    const template = getTemplateById(templateId);

    if (!template) {
      documents.push({
        templateId,
        templateName: 'Unknown',
        fileName: '',
        googleDriveId: '',
        googleDriveUrl: '',
        status: 'error',
        error: `Plantilla no encontrada: ${templateId}`,
      });
      continue;
    }

    const result = await generateDocument(
      template,
      caseData,
      placeholders,
      caseFolderId,
      mergedOptions
    );
    documents.push(result);
  }

  return documents;
}

/**
 * Preview document without uploading (returns HTML or PDF buffer)
 */
export async function previewDocument(
  caseData: CaseWithRelations,
  templateId: string,
  format: 'html' | 'pdf' = 'html'
): Promise<{ content: string | Buffer; mimeType: string }> {
  const { getTemplateById } = await import('./templates-config');
  const template = getTemplateById(templateId);

  if (!template) {
    throw new Error(`Plantilla no encontrada: ${templateId}`);
  }

  // Read and fill template
  const templatePath = getTemplatePath(template);
  const htmlContent = await readTemplate(templatePath);
  const placeholders = mapCaseToPlaceholders(caseData);
  const filledHtml = replacePlaceholders(htmlContent, placeholders);

  if (format === 'pdf') {
    const pdfBuffer = await htmlToPdf(filledHtml);
    return { content: pdfBuffer, mimeType: 'application/pdf' };
  }

  return { content: filledHtml, mimeType: 'text/html' };
}
