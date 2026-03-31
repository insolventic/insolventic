/**
 * Document Generation Service
 * Generates PDF documents from HTML templates and uploads to Google Drive
 */

import { promises as fs } from 'fs';
import path from 'path';
import { googleDriveService } from '@/lib/google-drive';
import { htmlToPdf } from '@/lib/html-to-pdf';
import {
  mapCaseToPlaceholders,
  replacePlaceholders,
  validatePlaceholderCoverage,
} from './placeholder-mapper';
import {
  getTemplatesForCaseCreation,
  getTemplatesForAdmission,
  getTemplatesForAgreement,
  getTemplatesForFailure,
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
  status: 'success' | 'error' | 'skipped';
  error?: string;
  /** Variables that were missing or empty */
  missingVariables?: string[];
  /** Coverage percentage */
  coveragePercentage?: number;
}

/**
 * Document requirements by category
 * Defines which data must exist for each document type to generate
 */
const DOCUMENT_REQUIREMENTS: Record<
  string,
  {
    requiresCreditors?: boolean;
    requiresAssets?: boolean;
    requiresLegalProcesses?: boolean;
    requiresPaymentProposal?: boolean;
    minCoveragePercentage?: number;
    criticalVariables?: string[];
  }
> = {
  // Solicitud documents
  'solicitud-insolvencia': {
    requiresCreditors: true,
    minCoveragePercentage: 70,
    criticalVariables: ['NOMBRE_DEUDOR', 'CEDULA_DEUDOR', 'TOTAL_ACREENCIAS'],
  },
  'check-list': {
    minCoveragePercentage: 50,
  },
  // Edicto
  'edicto-emplazatorio': {
    requiresCreditors: true,
    criticalVariables: ['NOMBRE_DEUDOR', 'LISTA_ACREEDORES'],
  },
  // Acuerdo documents
  'acuerdo-pago': {
    requiresCreditors: true,
    requiresPaymentProposal: true,
    minCoveragePercentage: 80,
    criticalVariables: [
      'NOMBRE_DEUDOR',
      'CUADRO_CALIFICACION_GRADUACION',
      'PROYECCION_PAGOS',
    ],
  },
  'acuerdo-bilateral': {
    requiresCreditors: true,
    criticalVariables: ['NOMBRE_DEUDOR', 'NOMBRE_ACREEDOR_BILATERAL'],
  },
  // Fracaso documents
  'fracaso-tramite': {
    requiresCreditors: true,
    criticalVariables: [
      'NOMBRE_DEUDOR',
      'ACREEDOR_MAYORITARIO',
      'TOTAL_CAPITAL_ADEUDADO',
    ],
  },
  // Suspensión documents
  'suspension-juzgados': {
    requiresLegalProcesses: true,
    criticalVariables: ['NOMBRE_DEUDOR', 'TIPO_PROCESO', 'NOMBRE_DEMANDANTE'],
  },
  'suspension-garantia': {
    requiresLegalProcesses: true,
    criticalVariables: ['NOMBRE_DEUDOR', 'NOMBRE_DEMANDANTE'],
  },
  // Remisión
  'remision-juzgado': {
    criticalVariables: ['NOMBRE_DEUDOR', 'CEDULA_DEUDOR'],
  },
  'remision-resultado': {
    requiresLegalProcesses: true,
  },
};

/**
 * Validates if a document can be generated based on case data
 */
function validateDocumentRequirements(
  template: DocumentTemplate,
  caseData: CaseWithRelations,
  placeholders: Record<string, string>,
): { canGenerate: boolean; reason?: string; missingVariables?: string[] } {
  // Get template ID without extension for matching
  const templateKey = template.id.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Find matching requirement
  const requirements = Object.entries(DOCUMENT_REQUIREMENTS).find(
    ([key]) =>
      templateKey.includes(key) ||
      template.name.toLowerCase().includes(key.replace(/-/g, ' ')),
  )?.[1];

  if (!requirements) {
    // No specific requirements, allow generation
    return { canGenerate: true };
  }

  const missingVariables: string[] = [];

  // Check creditor requirement
  if (requirements.requiresCreditors && caseData.debts.length === 0) {
    return {
      canGenerate: false,
      reason: 'Este documento requiere al menos un acreedor registrado',
      missingVariables: ['ACREEDORES'],
    };
  }

  // Check assets requirement
  if (requirements.requiresAssets && caseData.assets.length === 0) {
    return {
      canGenerate: false,
      reason: 'Este documento requiere al menos un bien registrado',
      missingVariables: ['BIENES'],
    };
  }

  // Check legal processes requirement
  if (
    requirements.requiresLegalProcesses &&
    (!caseData.legalProcesses || caseData.legalProcesses.length === 0)
  ) {
    return {
      canGenerate: false,
      reason: 'Este documento requiere al menos un proceso judicial registrado',
      missingVariables: ['PROCESOS_JUDICIALES'],
    };
  }

  // Check payment proposal requirement
  if (requirements.requiresPaymentProposal) {
    if (!caseData.paymentTermMonths || !caseData.monthlyPaymentAmount) {
      return {
        canGenerate: false,
        reason:
          'Este documento requiere una propuesta de pago definida (plazo y cuota mensual)',
        missingVariables: ['PROPUESTA_PAGO'],
      };
    }
  }

  // Check critical variables
  if (requirements.criticalVariables) {
    for (const variable of requirements.criticalVariables) {
      const value = placeholders[variable];
      if (
        !value ||
        value.trim() === '' ||
        value.includes('____') ||
        value === 'N/A'
      ) {
        missingVariables.push(variable);
      }
    }

    if (missingVariables.length > 0) {
      return {
        canGenerate: false,
        reason: `Faltan variables críticas: ${missingVariables.join(', ')}`,
        missingVariables,
      };
    }
  }

  return { canGenerate: true };
}

/**
 * Options for document generation
 */
export interface GenerationOptions {
  generatePdf?: boolean; // If false, saves as HTML
  generateDocx?: boolean; // If true, also generates DOCX
  uploadToGoogleDrive?: boolean;
  caseFolderId?: string; // Google Drive folder ID for the case
}

const defaultOptions: GenerationOptions = {
  generatePdf: true,
  generateDocx: false,
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
  debtorName: string,
  centerFolderName: string,
): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID no esta configurado');
  }

  // 1. Find or create "documentos-generados" folder
  const rootContents =
    await googleDriveService.listFoldersAndFiles(rootFolderId);
  let docGenFolderId = rootContents.folders.find(
    (f) => f.name?.toLowerCase() === 'documentos-generados',
  )?.id;
  if (!docGenFolderId) {
    docGenFolderId = await googleDriveService.createFolder(
      'documentos-generados',
      rootFolderId,
    );
  }

  // 2. Find or create center subfolder
  const centerFolderId = await googleDriveService.createFolderHierarchy(
    [centerFolderName],
    docGenFolderId,
  );

  // 3. Find or create case folder inside center
  const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
    caseNumber,
    centerFolderId,
  );

  return caseFolderId;
}

/**
 * Create subfolder structure within case folder
 */
async function createDocumentSubfolder(
  caseFolderId: string,
  folderPath: string[],
): Promise<string> {
  if (folderPath.length === 0) {
    return caseFolderId;
  }

  try {
    return await googleDriveService.createFolderHierarchy(
      folderPath,
      caseFolderId,
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
  options: GenerationOptions & { skipValidation?: boolean },
): Promise<GeneratedDocument> {
  try {
    // Validate document requirements before generation
    if (!options.skipValidation) {
      const validation = validateDocumentRequirements(
        template,
        caseData,
        placeholders,
      );
      if (!validation.canGenerate) {
        return {
          templateId: template.id,
          templateName: template.name,
          fileName: '',
          googleDriveId: '',
          googleDriveUrl: '',
          status: 'skipped',
          error: validation.reason,
          missingVariables: validation.missingVariables,
        };
      }
    }

    // Read template HTML
    const templatePath = getTemplatePath(template);
    const htmlContent = await readTemplate(templatePath);

    // Validate placeholder coverage
    const coverage = validatePlaceholderCoverage(htmlContent, placeholders);

    // Replace placeholders
    const filledHtml = replacePlaceholders(htmlContent, placeholders);

    // Log coverage for debugging (in development)
    if (
      process.env.NODE_ENV === 'development' &&
      coverage.coveragePercentage < 80
    ) {
      console.warn(
        `[${template.name}] Low coverage: ${coverage.coveragePercentage}%`,
      );
      if (coverage.missing.length > 0) {
        console.warn(`  Missing variables: ${coverage.missing.join(', ')}`);
      }
    }

    // Generate file name
    const baseFileName = `${caseData.caseNumber}_${template.name.replace(/\s+/g, '_')}`;
    const fileName = options.generatePdf
      ? `${baseFileName}.pdf`
      : `${baseFileName}.html`;

    // Generate PDF or keep as HTML
    let fileBuffer: Buffer;
    let mimeType: string;

    if (options.generatePdf) {
      const projectRoot = process.cwd();
      const assetsBaseDir = path.join(projectRoot, 'templates/insolvency');
      fileBuffer = await htmlToPdf(filledHtml, {}, assetsBaseDir);
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
        template.folderPath,
      );

      googleDriveId = await googleDriveService.uploadFile(
        fileName,
        fileBuffer,
        mimeType,
        targetFolderId,
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
      coveragePercentage: coverage.coveragePercentage,
      missingVariables:
        coverage.missing.length > 0 ? coverage.missing : undefined,
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
  options: GenerationOptions = {},
  centerFolderName?: string,
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
      caseData.debtor.name,
      centerFolderName || 'General',
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
      mergedOptions,
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
  options: GenerationOptions = {},
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
      mergedOptions,
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
  options: GenerationOptions = {},
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
      mergedOptions,
    );
    documents.push(result);
  }

  return documents;
}

/**
 * Generate failure (fracaso) documents based on failure type
 */
export async function generateDocumentsForFailure(
  caseData: CaseWithRelations,
  caseFolderId: string,
  failureType: string,
  options: GenerationOptions = {},
): Promise<GeneratedDocument[]> {
  const mergedOptions = { ...defaultOptions, ...options, caseFolderId };
  const templates = getTemplatesForFailure(failureType);
  const documents: GeneratedDocument[] = [];

  if (templates.length === 0) {
    console.warn(`No templates found for failure type: ${failureType}`);
    return documents;
  }

  const placeholders = mapCaseToPlaceholders(caseData);

  for (const template of templates) {
    const result = await generateDocument(
      template,
      caseData,
      placeholders,
      caseFolderId,
      mergedOptions,
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
  options: GenerationOptions = {},
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
    mergedOptions,
  );
}

/**
 * Generate batch of specific documents
 */
export async function generateSpecificDocuments(
  caseData: CaseWithRelations,
  templateIds: string[],
  caseFolderId: string,
  options: GenerationOptions = {},
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
      mergedOptions,
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
  format: 'html' | 'pdf' = 'html',
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
    const projectRoot = process.cwd();
    const assetsBaseDir = path.join(projectRoot, 'templates/insolvency');
    const pdfBuffer = await htmlToPdf(filledHtml, {}, assetsBaseDir);
    return { content: pdfBuffer, mimeType: 'application/pdf' };
  }

  return { content: filledHtml, mimeType: 'text/html' };
}
