import { z } from 'zod';

const mapDocumentTypeToSpanish = z.string().transform((type) => {
  const typeMap: Record<string, string> = {
    CEDULA: 'Cédula',
    RUT: 'RUT',
    ESTADOS_FINANCIEROS: 'Estados Financieros',
    CERTIFICADO_INGRESOS: 'Certificado de Ingresos',
    ESCRITURA_PUBLICA: 'Escritura Pública',
    AUTORIZACION: 'Autorización',
    DEMANDA: 'Demanda',
    RESPUESTA_DEMANDA: 'Respuesta a Demanda',
    ACUERDO: 'Acuerdo',
    SENTENCIA: 'Sentencia',
    OTRO: 'Otro',
  };
  return typeMap[type] || type;
});

const mapDocumentStatusToSpanish = z.string().transform((status) => {
  const statusMap: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    EN_REVISION: 'En Revisión',
  };
  return statusMap[status] || status;
});

const mapCaseTypeToSpanish = z.string().transform((type) => {
  const typeMap: Record<string, string> = {
    INSOLVENCY: 'Insolvencia',
    CONCILIATION: 'Conciliación',
    SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
  };
  return typeMap[type] || type;
});

const mapCaseStatusToSpanish = z.string().transform((status) => {
  const statusMap: Record<string, string> = {
    NEGOTIATION: 'En negociación',
    HEARING_SCHEDULED: 'Audiencia programada',
    PENDING_DOCUMENTS: 'Documentos pendientes',
    AGREEMENT_APPROVED: 'Acuerdo aprobado',
    CLOSED: 'Cerrado',
  };
  return statusMap[status] || status;
});

const caseForDocumentSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  debtorName: z.string(),
  type: mapCaseTypeToSpanish,
  status: mapCaseStatusToSpanish,
});

export const documentWithCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: mapDocumentTypeToSpanish,
  status: mapDocumentStatusToSpanish,
  url: z.string(),
  uploadDate: z.coerce.date(),
  caseId: z.string(),
  case: caseForDocumentSchema,
});

export type DocumentWithCase = z.infer<typeof documentWithCaseSchema>;

export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  url: z.string().optional(),
  uploadDate: z.coerce.date().optional(),
  caseId: z.string().optional(),
  case: caseForDocumentSchema.optional(),
  debtorName: z.string().optional(),
  createdDate: z.string().optional(),
  size: z.string().optional(),
  format: z.string().optional(),
  createdBy: z.string().optional(),
  downloadCount: z.coerce.number().optional(),
  lastAccessed: z.string().optional(),
  viewCount: z.coerce.number().optional(),
  shareCount: z.coerce.number().optional(),
  templateFolderPath: z.array(z.string()).default([]).optional(),
});

export type Document = z.infer<typeof documentSchema>;

export const documentTemplateSchema = z.object({
  id: z.string(),
  googleDriveId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  placeholders: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
    }),
  ),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  folderPath: z.array(z.string()).default([]),
  parentFolderId: z.string().optional(),
  isFolder: z.boolean().default(false),
});

export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;

export const debtorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    documentType: z.string().optional(),
    documentNumber: z.string().optional(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    birthDate: z.coerce.date().optional().nullable(),
    maritalStatus: z.string().optional().nullable(),
    occupation: z.string().optional().nullable(),
    monthlyIncome: z.number().optional().nullable(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    createdDate: z.coerce.date().optional(),
    lastUpdate: z.coerce.date().optional(),
  })
  .catchall(z.unknown());

export const operatorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string().optional(),
  })
  .catchall(z.unknown());

export const creditorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    documentType: z.string().optional(),
    documentNumber: z.string().optional(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
  })
  .catchall(z.unknown());

export const debtSchema = z
  .object({
    id: z.string(),
    amount: z.number().transform((val) => Number(val)),
    interestRate: z.number().optional(),
    type: z.string(),
    caseId: z.string().optional(),
    creditorId: z.string().optional(),
    debtorId: z.string().optional().nullable(),
    creditor: creditorSchema.optional().nullable(),
  })
  .catchall(z.unknown());

export const assetSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: z.string(),
    value: z.number().optional().nullable(),
    estimatedValue: z.number().optional().nullable(),
    caseId: z.string().optional(),
    debtorId: z.string().optional().nullable(),
  })
  .catchall(z.unknown());

export const caseWithRelationsSchema = z
  .object({
    id: z.string(),
    caseNumber: z.string(),
    type: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    createdDate: z.coerce.date().optional(),
    lastUpdate: z.coerce.date().optional(),
    debtor: debtorSchema.optional().nullable(),
    operator: operatorSchema.optional().nullable(),
    debts: z.array(debtSchema).optional(),
    assets: z.array(assetSchema).optional(),
  })
  .catchall(z.unknown());

export type CaseWithRelations = z.infer<typeof caseWithRelationsSchema>;

export const getTemplatesFromDatabaseInputSchema = z.object({}).optional();

export const getTemplatesFromDatabaseOutputSchema = z.array(
  documentTemplateSchema,
);

export const syncTemplatesWithGoogleDriveInputSchema = z.object({}).optional();

export const syncTemplatesWithGoogleDriveOutputSchema = z.object({
  synced: z.number(),
  updated: z.number(),
  created: z.number(),
  folders: z.number(),
});

export const documentFromDriveSchema = z.object({
  id: z.string(),
  googleDriveId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  folderPath: z.array(z.string()).default([]),
  parentFolderId: z.string().optional(),
  isFolder: z.boolean().default(false),
  size: z.string().optional(),
});

export type DocumentFromDrive = z.infer<typeof documentFromDriveSchema>;

export const syncDocumentsWithGoogleDriveInputSchema = z.object({}).optional();

export const syncDocumentsWithGoogleDriveOutputSchema = z.object({
  synced: z.number(),
  updated: z.number(),
  created: z.number(),
  folders: z.number(),
});

export const getDocumentsFromDriveInputSchema = z.object({}).optional();

export const getDocumentsFromDriveOutputSchema = z.array(
  documentFromDriveSchema,
);

export const batchGenerateDocumentsInputSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  templateIds: z.array(z.string()).optional(),
  packageNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  outputFormat: z.enum(['docx', 'pdf']).default('pdf'),
});

export const batchGenerateDocumentsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z
    .object({
      caseId: z.string(),
      caseNumber: z.string(),
      folderId: z.string(),
      folderUrl: z.string(),
      documents: z.array(
        z.object({
          templateId: z.string(),
          templateName: z.string(),
          documentId: z.string(),
          documentName: z.string(),
          documentUrl: z.string(),
          status: z.enum(['success', 'error']),
          error: z.string().optional(),
        }),
      ),
      generatedAt: z.coerce.date(),
      totalDocuments: z.number(),
      successfulDocuments: z.number(),
      failedDocuments: z.number(),
    })
    .nullable(),
});

// Upload user-provided documents for a case
export const uploadCaseDocumentsInputSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  personName: z.string().min(1, 'El nombre de la persona es requerido'),
  documents: z
    .array(
      z.object({
        docName: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        dataBase64: z.string().min(1),
      }),
    )
    .min(1, 'Debe adjuntar al menos un archivo'),
});

export const uploadCaseDocumentsOutputSchema = z.object({
  uploaded: z.number(),
});
