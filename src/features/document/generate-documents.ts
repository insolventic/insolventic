/**
 * Document Generation Service
 * Generates PDF documents from HTML templates and uploads to Google Drive
 */

import { promises as fs } from 'fs';
import path from 'path';
import { googleDriveService } from '@/lib/google-drive';
import { withRetry } from '@/lib/retry';
import { logger } from '@/lib/logger';
import { htmlToPdf, batchHtmlToPdf } from '@/lib/html-to-pdf';
import {
  mapCaseToPlaceholders,
  renderDocumentHtml,
  validatePlaceholderCoverage,
  buildTemplateContext,
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

    // Contexto de bloques ({{#each}} / {{#if}}) segun el tipo de caso.
    const extraContext = buildTemplateContext(caseData);
    const { html: filledHtml, unresolved } = renderDocumentHtml(
      htmlContent,
      placeholders,
      extraContext,
    );

    // C-3: un placeholder que el mapper no produce es un hueco silencioso en un
    // documento legal. Se bloquea la generación en vez de subir el PDF a Drive
    // con el campo en blanco.
    if (!options.skipValidation && unresolved.length > 0) {
      logger.error(
        'Generación bloqueada: la plantilla referencia variables que el mapper no produce',
        new Error('unresolved-placeholders'),
        {
          action: 'generate-documents',
          template: template.name,
          templateId: template.id,
          unresolved,
        },
      );
      return {
        templateId: template.id,
        templateName: template.name,
        fileName: '',
        googleDriveId: '',
        googleDriveUrl: '',
        status: 'error',
        error: `No se generó: faltan datos para ${unresolved.length} campo(s) de la plantilla (${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '…' : ''}). Complete la información del expediente y reintente.`,
        missingVariables: unresolved,
        coveragePercentage: coverage.coveragePercentage,
      };
    }

    if (coverage.coveragePercentage < 80) {
      logger.warn('Cobertura de placeholders baja', {
        action: 'generate-documents',
        template: template.name,
        coveragePercentage: coverage.coveragePercentage,
        missingVariables: coverage.missing,
        emptyVariables: coverage.empty,
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

/** Resultado de la Fase 1 para una plantilla que sí llega a renderizarse. */
interface PreparedDocument {
  template: DocumentTemplate;
  html: string;
  fileName: string;
  coveragePercentage: number;
  missingVariables?: string[];
}

function isPreparedDocument(
  outcome: PreparedDocument | GeneratedDocument,
): outcome is PreparedDocument {
  return 'html' in outcome;
}

/**
 * Fase 1: validar requisitos, leer la plantilla y rellenar los placeholders.
 * No toca Chromium ni Drive — así una plantilla que falla acá (datos
 * incompletos, placeholder sin resolver) nunca llega a ocupar un navegador ni
 * una subida.
 */
async function prepareDocument(
  template: DocumentTemplate,
  caseData: CaseWithRelations,
  placeholders: Record<string, string>,
  extraContext: Record<string, unknown> | undefined,
  options: GenerationOptions & { skipValidation?: boolean },
): Promise<PreparedDocument | GeneratedDocument> {
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

  let htmlContent: string;
  try {
    htmlContent = await readTemplate(getTemplatePath(template));
  } catch (error) {
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

  const coverage = validatePlaceholderCoverage(htmlContent, placeholders);
  const { html: filledHtml, unresolved } = renderDocumentHtml(
    htmlContent,
    placeholders,
    extraContext,
  );

  // C-3: un placeholder que el mapper no produce es un hueco silencioso en un
  // documento legal. Se bloquea la generación en vez de subir el PDF a Drive
  // con el campo en blanco.
  if (!options.skipValidation && unresolved.length > 0) {
    logger.error(
      'Generación bloqueada: la plantilla referencia variables que el mapper no produce',
      new Error('unresolved-placeholders'),
      {
        action: 'generate-documents',
        template: template.name,
        templateId: template.id,
        unresolved,
      },
    );
    return {
      templateId: template.id,
      templateName: template.name,
      fileName: '',
      googleDriveId: '',
      googleDriveUrl: '',
      status: 'error',
      error: `No se generó: faltan datos para ${unresolved.length} campo(s) de la plantilla (${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '…' : ''}). Complete la información del expediente y reintente.`,
      missingVariables: unresolved,
      coveragePercentage: coverage.coveragePercentage,
    };
  }

  if (coverage.coveragePercentage < 80) {
    logger.warn('Cobertura de placeholders baja', {
      action: 'generate-documents',
      template: template.name,
      coveragePercentage: coverage.coveragePercentage,
      missingVariables: coverage.missing,
      emptyVariables: coverage.empty,
    });
  }

  const baseFileName = `${caseData.caseNumber}_${template.name.replace(/\s+/g, '_')}`;
  const fileName = options.generatePdf
    ? `${baseFileName}.pdf`
    : `${baseFileName}.html`;

  return {
    template,
    html: filledHtml,
    fileName,
    coveragePercentage: coverage.coveragePercentage,
    missingVariables:
      coverage.missing.length > 0 ? coverage.missing : undefined,
  };
}

/**
 * Fase 3: sube a Drive el buffer que produjo la Fase 2 (o el HTML plano si
 * `generatePdf` es falso) y arma el resultado final. Comparte
 * `subfolderCache` con el resto del lote para no repetir la resolución de
 * carpetas cuando varias plantillas comparten `folderPath`.
 */
async function uploadGeneratedDocument(
  prepared: PreparedDocument,
  fileBuffer: Buffer,
  mimeType: string,
  caseFolderId: string,
  layoutVersion: number,
  options: GenerationOptions,
  subfolderCache: Map<string, string>,
): Promise<GeneratedDocument> {
  try {
    let googleDriveId = '';
    let googleDriveUrl = '';

    if (options.uploadToGoogleDrive && caseFolderId) {
      const targetFolderId = await createDocumentSubfolder(
        caseFolderId,
        prepared.template.folderPath,
        layoutVersion,
        subfolderCache,
      );

      googleDriveId = await withRetry(
        () =>
          googleDriveService.uploadFile(
            prepared.fileName,
            fileBuffer,
            mimeType,
            targetFolderId,
          ),
        { label: `upload:${prepared.fileName}` },
      );
      googleDriveUrl = googleDriveService.getFileUrl(googleDriveId);
    }

    return {
      templateId: prepared.template.id,
      templateName: prepared.template.name,
      fileName: prepared.fileName,
      googleDriveId,
      googleDriveUrl,
      status: 'success',
      coveragePercentage: prepared.coveragePercentage,
      missingVariables: prepared.missingVariables,
    };
  } catch (error) {
    logger.error('Error generating document', error, {
      action: 'generate-documents',
      template: prepared.template.name,
      templateId: prepared.template.id,
    });
    return {
      templateId: prepared.template.id,
      templateName: prepared.template.name,
      fileName: '',
      googleDriveId: '',
      googleDriveUrl: '',
      status: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Corre un lote de plantillas en 3 fases (P1 de la auditoría de documentos,
 * docs/AUDITORIA_MODULO_GENERACION_2026-07.md): 1) validar + rellenar HTML,
 * 2) convertir a PDF con `batchHtmlToPdf` (un solo Chromium para todo el
 * lote), 3) subir a Drive. Antes, cada documento lanzaba y cerraba su propio
 * navegador (`generateDocument` → `htmlToPdf`) — el mismo patrón que
 * `batchGenerateDocuments` (features/document/actions.ts) ya usa para la
 * ruta manual de /documents.
 *
 * El orden del array de salida coincide con `templates` de entrada (cada
 * plantilla llena su propia posición, sin importar en qué fase termine).
 */
async function generateFromTemplates(
  templates: DocumentTemplate[],
  caseData: CaseWithRelations,
  caseFolderId: string,
  options: GenerationOptions,
): Promise<GeneratedDocument[]> {
  const placeholders = mapCaseToPlaceholders(caseData);
  const extraContext =
    caseData.type === 'CONCILIATION'
      ? buildConciliationContext(caseData)
      : undefined;
  const subfolderCache = new Map<string, string>();
  const layoutVersion =
    (caseData as { layoutVersion?: number }).layoutVersion ?? 0;

  const results: GeneratedDocument[] = new Array(templates.length);
  const prepared: Array<PreparedDocument & { index: number }> = [];

  // Fase 1
  for (let i = 0; i < templates.length; i++) {
    const outcome = await prepareDocument(
      templates[i],
      caseData,
      placeholders,
      extraContext,
      options,
    );
    if (isPreparedDocument(outcome)) {
      prepared.push({ ...outcome, index: i });
    } else {
      results[i] = outcome;
    }
  }

  // Fase 2: un solo navegador para todo el lote que pasó la Fase 1.
  const projectRoot = process.cwd();
  const buffers = new Map<string, { buffer: Buffer; mimeType: string }>();

  if (options.generatePdf) {
    if (prepared.length > 0) {
      const htmlInputs = prepared.map((p) => ({
        html: p.html,
        filename: `${p.template.id}.html`,
        assetsBaseDir: path.join(
          projectRoot,
          getTemplateAssetsBaseDir(p.template),
        ),
        docDir: path.dirname(
          path.join(projectRoot, getTemplatePath(p.template)),
        ),
      }));
      const pdfResults = await batchHtmlToPdf(htmlInputs);
      for (const r of pdfResults) {
        buffers.set(r.filename.replace(/\.pdf$/, ''), {
          buffer: r.buffer,
          mimeType: 'application/pdf',
        });
      }
    }
  } else {
    for (const p of prepared) {
      buffers.set(p.template.id, {
        buffer: Buffer.from(p.html, 'utf-8'),
        mimeType: 'text/html',
      });
    }
  }

  // Fase 3
  for (const p of prepared) {
    const generated = buffers.get(p.template.id);
    if (!generated) {
      // batchHtmlToPdf ya logueó el fallo puntual de esta plantilla y siguió
      // con el resto del lote (ver src/lib/html-to-pdf.ts).
      results[p.index] = {
        templateId: p.template.id,
        templateName: p.template.name,
        fileName: p.fileName,
        googleDriveId: '',
        googleDriveUrl: '',
        status: 'error',
        error: 'Error al generar el PDF',
        coveragePercentage: p.coveragePercentage,
        missingVariables: p.missingVariables,
      };
      continue;
    }

    results[p.index] = await uploadGeneratedDocument(
      p,
      generated.buffer,
      generated.mimeType,
      caseFolderId,
      layoutVersion,
      options,
      subfolderCache,
    );
  }

  return results;
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
  return generateFromTemplates(
    templates,
    caseData,
    caseFolderId,
    mergedOptions,
  );
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
  return generateFromTemplates(
    templates,
    caseData,
    caseFolderId,
    mergedOptions,
  );
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

  return generateFromTemplates(
    templates,
    caseData,
    caseFolderId,
    mergedOptions,
  );
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
  const extraContext = buildTemplateContext(caseData);
  const { html: filledHtml, unresolved } = renderDocumentHtml(
    htmlContent,
    placeholders,
    extraContext,
  );

  // C-3: mismo bloqueo que en la generación por lotes — regenerar no puede
  // ser la puerta por la que sale un documento con huecos.
  if (unresolved.length > 0) {
    throw new Error(
      `No se puede regenerar "${template.name}": faltan datos para ${unresolved.length} campo(s) (${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? '…' : ''}).`,
    );
  }

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
