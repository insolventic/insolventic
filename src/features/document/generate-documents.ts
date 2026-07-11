/**
 * Document Generation Service
 * Generates PDF documents from HTML templates and uploads to Google Drive
 */

import { promises as fs } from 'fs';
import path from 'path';
import { googleDriveService } from '@/lib/google-drive';
import { withRetry } from '@/lib/retry';
import { logger } from '@/lib/logger';
import { htmlToPdf } from '@/lib/html-to-pdf';
import {
  mapCaseToPlaceholders,
  replacePlaceholders,
  validatePlaceholderCoverage,
  buildConciliationContext,
} from './placeholder-mapper';
import {
  getTemplatesForCaseCreation,
  getTemplatesForAdmission,
  getTemplatesForAgreement,
  getTemplatesForFailure,
  getTemplatePath,
  getTemplateAssetsBaseDir,
  type DocumentTemplate,
} from './templates-config';
import { generateAndUploadExcel } from './generate-excel';
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
    logger.error('Error reading template', error, {
      action: 'generate-documents',
      templatePath,
    });
    throw new Error(`No se pudo leer la plantilla: ${templatePath}`);
  }
}

/**
 * Map case type code to human-readable folder label.
 */
function caseTypeFolderLabel(
  caseType: 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT',
): string {
  switch (caseType) {
    case 'CONCILIATION':
      return 'Conciliación';
    case 'SUPPORT_AGREEMENT':
      return 'Acuerdos de Apoyo';
    case 'INSOLVENCY':
    default:
      return 'Insolvencia';
  }
}

/**
 * Extracts surname from a debtor name (last token), sanitized for Drive.
 */
function extractSurname(debtorName: string): string {
  const cleaned = (debtorName || '').trim().replace(/[\\/\0]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  // Use last 2 tokens when available (likely both apellidos)
  const tail = parts.slice(-2).join(' ');
  return tail.substring(0, 40);
}

/**
 * Get or create case folder in Google Drive.
 *
 * Layout v1 (new cases):
 *   {root}/Insolventic/{Centro}/{TipoCaso}/{YYYY}/{caseNumber} - {Apellido}/
 *
 * Layout v0 (legacy — kept for back-compat with cases already on disk):
 *   {root}/documentos-generados/{Centro}/{caseNumber}/
 */
async function getOrCreateCaseFolder(
  caseNumber: string,
  debtorName: string,
  centerFolderName: string,
  caseType: 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT' = 'INSOLVENCY',
  layoutVersion: number = 1,
): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID no esta configurado');
  }

  if (layoutVersion >= 1) {
    // New sectioned layout
    const year = String(new Date().getFullYear());
    const surname = extractSurname(debtorName);
    const caseFolderName = surname ? `${caseNumber} - ${surname}` : caseNumber;

    // Reintento con backoff: la creación de la jerarquía es find-or-create
    // (idempotente), un fallo transitorio de la API de Drive no debe abortar
    // toda la generación del expediente.
    const hierarchyId = await withRetry(
      () =>
        googleDriveService.createFolderHierarchy(
          [
            'Insolventic',
            centerFolderName,
            caseTypeFolderLabel(caseType),
            year,
            caseFolderName,
          ],
          rootFolderId,
        ),
      { label: `case-folder:${caseNumber}` },
    );
    return hierarchyId;
  }

  // ----- Legacy layout (v0) -----
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
  const centerFolderId = await googleDriveService.createFolderHierarchy(
    [centerFolderName],
    docGenFolderId,
  );
  return await googleDriveService.findOrCreateCaseFolder(
    caseNumber,
    centerFolderId,
  );
}

/**
 * Create subfolder structure within case folder.
 * For layout v1, all generated documents are nested inside `01-Generados/`.
 */
async function createDocumentSubfolder(
  caseFolderId: string,
  folderPath: string[],
  layoutVersion: number = 0,
  cache?: Map<string, string>,
): Promise<string> {
  const effectivePath =
    layoutVersion >= 1 ? ['01-Generados', ...folderPath] : folderPath;

  if (effectivePath.length === 0) {
    return caseFolderId;
  }

  // Many templates share the same folderPath within a run; resolving the
  // hierarchy once per unique path avoids N redundant Drive round-trips.
  const cacheKey = `${caseFolderId}::${effectivePath.join('/')}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;

  try {
    const folderId = await googleDriveService.createFolderHierarchy(
      effectivePath,
      caseFolderId,
    );
    cache?.set(cacheKey, folderId);
    return folderId;
  } catch (error) {
    logger.warn('Error creating Drive subfolder, falling back to case folder', {
      action: 'generate-documents',
      folderPath: effectivePath.join('/'),
      reason: error instanceof Error ? error.message : String(error),
    });
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
  subfolderCache?: Map<string, string>,
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

    // Replace placeholders (conciliation adds flags + arrays for handlebars-lite)
    const extraContext =
      caseData.type === 'CONCILIATION'
        ? buildConciliationContext(caseData)
        : undefined;
    const filledHtml = replacePlaceholders(
      htmlContent,
      placeholders,
      extraContext,
    );

    // Log coverage for debugging (in development)
    if (
      process.env.NODE_ENV === 'development' &&
      coverage.coveragePercentage < 80
    ) {
      logger.debug('Low placeholder coverage', {
        action: 'generate-documents',
        template: template.name,
        coveragePercentage: coverage.coveragePercentage,
        missingVariables: coverage.missing,
      });
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
      // Root-relative asset refs ("/CSS/...") resolve against the case-type
      // base dir; relative refs ("./", "../") against the template's own dir.
      const assetsBaseDir = path.join(
        projectRoot,
        getTemplateAssetsBaseDir(template),
      );
      const docDir = path.dirname(path.join(projectRoot, templatePath));
      fileBuffer = await htmlToPdf(filledHtml, {}, assetsBaseDir, docDir);
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
        (caseData as { layoutVersion?: number }).layoutVersion ?? 0,
        subfolderCache,
      );

      googleDriveId = await withRetry(
        () =>
          googleDriveService.uploadFile(
            fileName,
            fileBuffer,
            mimeType,
            targetFolderId,
          ),
        { label: `upload:${fileName}` },
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
    logger.error('Error generating document', error, {
      action: 'generate-documents',
      template: template.name,
      templateId: template.id,
    });
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
 * Run a list of templates through generateDocument sequentially, sharing a
 * placeholder map and a Drive-subfolder cache across the whole batch.
 * Sequential on purpose: Puppeteer + Drive quotas punish concurrency here.
 */
async function generateFromTemplates(
  templates: DocumentTemplate[],
  caseData: CaseWithRelations,
  caseFolderId: string,
  options: GenerationOptions,
): Promise<GeneratedDocument[]> {
  const placeholders = mapCaseToPlaceholders(caseData);
  const subfolderCache = new Map<string, string>();
  const documents: GeneratedDocument[] = [];

  for (const template of templates) {
    documents.push(
      await generateDocument(
        template,
        caseData,
        placeholders,
        caseFolderId,
        options,
        subfolderCache,
      ),
    );
  }

  return documents;
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
  const caseType =
    (caseData.type as 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT') ||
    'INSOLVENCY';
  const templates = getTemplatesForCaseCreation(caseType);

  // Create case folder in Google Drive
  let caseFolderId = mergedOptions.caseFolderId || '';
  let caseFolderUrl = '';

  if (mergedOptions.uploadToGoogleDrive && !caseFolderId) {
    caseFolderId = await getOrCreateCaseFolder(
      caseData.caseNumber,
      caseData.debtor.name,
      centerFolderName || 'General',
      caseType,
      1, // new cases always use sectioned layout v1
    );
    caseFolderUrl = googleDriveService.getFolderUrl(caseFolderId);
    // Mark in-memory so createDocumentSubfolder nests templates inside 01-Generados
    (caseData as { layoutVersion?: number }).layoutVersion = 1;
  }

  const documents = await generateFromTemplates(
    templates,
    caseData,
    caseFolderId,
    mergedOptions,
  );

  // Generate consolidated Excel and upload
  if (mergedOptions.uploadToGoogleDrive && caseFolderId) {
    try {
      const excelResult = await generateAndUploadExcel(caseData, caseFolderId);
      documents.push({
        templateId: 'consolidado-excel',
        templateName: 'Consolidado Excel',
        fileName: excelResult.fileName,
        googleDriveId: excelResult.googleDriveId,
        googleDriveUrl: excelResult.googleDriveUrl,
        status: 'success',
      });
    } catch (error) {
      logger.error('Error generating consolidated Excel', error, {
        action: 'generate-documents',
      });
      documents.push({
        templateId: 'consolidado-excel',
        templateName: 'Consolidado Excel',
        fileName: 'Consolidado.xlsx',
        googleDriveId: '',
        googleDriveUrl: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Error generando Excel',
      });
    }
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
  const caseType =
    (caseData.type as 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT') ||
    'INSOLVENCY';
  const templates = getTemplatesForAdmission(caseType);
  return generateFromTemplates(templates, caseData, caseFolderId, mergedOptions);
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
  const caseType =
    (caseData.type as 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT') ||
    'INSOLVENCY';
  const templates = getTemplatesForAgreement(caseType);
  return generateFromTemplates(templates, caseData, caseFolderId, mergedOptions);
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
  const caseType =
    (caseData.type as 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT') ||
    'INSOLVENCY';
  const templates = getTemplatesForFailure(failureType, caseType);

  if (templates.length === 0) {
    logger.warn('No templates found for failure type', {
      action: 'generate-documents',
      failureType,
    });
    return [];
  }

  return generateFromTemplates(templates, caseData, caseFolderId, mergedOptions);
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
  const subfolderCache = new Map<string, string>();
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
      subfolderCache,
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
  const extraContext =
    caseData.type === 'CONCILIATION'
      ? buildConciliationContext(caseData)
      : undefined;
  const filledHtml = replacePlaceholders(
    htmlContent,
    placeholders,
    extraContext,
  );

  if (format === 'pdf') {
    const projectRoot = process.cwd();
    const assetsBaseDir = path.join(
      projectRoot,
      getTemplateAssetsBaseDir(template),
    );
    const docDir = path.dirname(path.join(projectRoot, templatePath));
    const pdfBuffer = await htmlToPdf(filledHtml, {}, assetsBaseDir, docDir);
    return { content: pdfBuffer, mimeType: 'application/pdf' };
  }

  return { content: filledHtml, mimeType: 'text/html' };
}
