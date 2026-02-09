# SISTEMA DE VALIDACIONES Y GENERACIÓN DOCUMENTAL

---

# PARTE 1: LÓGICA DE VALIDACIÓN

## 1.1 Esquema Zod Completo (Frontend + Backend)

```typescript
// src/features/case/schemas/create-case-schema.ts

import { z } from 'zod';

// ============================================
// SCHEMAS AUXILIARES
// ============================================

const documentSchema = z.object({
  name: z.string(),
  type: z.string(),
  file: z.instanceof(File).optional(),
  url: z.string().optional(),
  required: z.boolean(),
  uploaded: z.boolean(),
});

const dependentSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  age: z.number().int().min(0).max(120),
  relationship: z.enum(['HIJO', 'CONYUGE', 'PADRE', 'MADRE', 'OTRO']),
});

const legalProcessSchema = z.object({
  processType: z.string().min(1, "Tipo de proceso requerido"),
  plaintiff: z.string().min(1, "Demandante requerido"),
  court: z.string().min(1, "Juzgado requerido"),
  fileNumber: z.string().min(1, "Expediente requerido"),
  precautionaryMeasure: z.string().optional(),
});

const libranzaSchema = z.object({
  payerName: z.string().min(1, "Nombre del pagador requerido"),
  payerAddress: z.string().min(1, "Dirección requerida"),
  payerEmail: z.string().email("Email inválido"),
  payerPhone: z.string().min(7, "Teléfono inválido"),
  deductedAmount: z.number().positive("Monto debe ser positivo"),
  productAndCreditor: z.string().min(1, "Producto y acreedor requerido"),
});

const suspendedServiceSchema = z.object({
  creditorName: z.string().min(1, "Nombre del acreedor requerido"),
  address: z.string().min(1, "Dirección requerida"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(7, "Teléfono inválido"),
  suspendedProduct: z.string().min(1, "Producto suspendido requerido"),
  amountOwed: z.number().nonnegative("Monto no puede ser negativo"),
});

const coDebtorSchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
}).optional();

const debtSchema = z.object({
  // Datos del acreedor
  creditorName: z.string().min(1, "Nombre del acreedor requerido"),
  creditorCity: z.string().min(1, "Domicilio requerido"),
  creditorAddress: z.string().min(1, "Dirección requerida"),
  creditorEmail: z.string().email("Email inválido"),

  // Datos de la deuda
  capitalAmount: z.number().positive("Capital debe ser mayor a 0"),
  interestAmount: z.number().nonnegative().optional().default(0),
  interestRate: z.number().min(0).max(100).optional(),
  isDeferred: z.boolean().optional().default(false),
  documentType: z.string().optional(),
  grantDate: z.date().optional(),
  dueDate: z.date().optional(),
  creditClassification: z.enum([
    'PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'
  ]),
  hasActiveLibranza: z.boolean().optional().default(false),
  creditorClass: z.enum(['GARANTIZADO', 'PRIVILEGIADO', 'QUIROGRAFARIO']),
  daysOverdue: z.number().int().nonnegative().optional(),

  // Codeudor
  coDebtor: coDebtorSchema,
});

const immovableAssetSchema = z.object({
  type: z.literal('INMUEBLE'),
  propertyType: z.enum([
    'CASA', 'APARTAMENTO', 'LOTE', 'LOCAL', 'BODEGA', 'OFICINA', 'FINCA', 'OTRO'
  ]),
  address: z.string().min(5, "Dirección requerida"),
  registrationNumber: z.string().min(1, "Matrícula requerida"),
  value: z.number().positive("Valor debe ser mayor a 0"),
  encumbrance: z.string().optional(),
  affectation: z.string().optional(),
  precautionaryMeasure: z.string().optional(),
  isFamilyHome: z.boolean().optional().default(false),
  isInalienablePatrimony: z.boolean().optional().default(false),
  proofDocument: z.string().min(1, "Documento de prueba requerido"),
});

const movableAssetSchema = z.object({
  type: z.literal('MUEBLE'),
  category: z.enum([
    'ELECTRONICO', 'ENSERES', 'VEHICULO', 'JOYAS', 'EFECTIVO', 'ACCIONES', 'CUENTAS'
  ]),
  description: z.string().min(1, "Descripción requerida"),
  value: z.number().positive("Valor debe ser mayor a 0"),

  // Campos adicionales para vehículos
  brand: z.string().optional(),
  model: z.string().optional(),
  licensePlate: z.string().optional(),
  transitAuthority: z.string().optional(),
  guaranteeInFavorOf: z.string().optional(),
  guaranteeAmount: z.number().optional(),
});

const assetSchema = z.discriminatedUnion('type', [
  immovableAssetSchema,
  movableAssetSchema,
]);

const paymentOrderSchema = z.object({
  primera: z.string().optional(),
  segunda: z.string().optional(),
  tercera: z.string().optional(),
  cuarta: z.string().optional(),
  quinta: z.string().optional(),
});

const spouseSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  idNumber: z.string().min(5, "Cédula requerida"),
  address: z.string().min(5, "Dirección requerida"),
  phone: z.string().min(7, "Teléfono requerido"),
  email: z.string().email("Email inválido"),
});

// ============================================
// SCHEMA PRINCIPAL DEL CASO
// ============================================

export const createCaseFormSchema = z.object({
  // TAB 1: DEUDOR
  debtorId: z.string().min(1, "Debe seleccionar un deudor"),
  causes: z.array(z.string()).min(1, "Debe seleccionar al menos una causa"),
  causesOtherDetail: z.string().optional(),
  applicantScope: z.enum([
    'PERSONA_NATURAL_NO_COMERCIANTE',
    'PERSONA_NATURAL_PEQUENA_COMERCIANTE'
  ]),

  // TAB 2: CASO (mayormente autogenerado)
  // Las fechas procesales NO se incluyen aquí - son manuales posteriores
  zoomMeetingId: z.string().optional(),
  zoomPassword: z.string().optional(),
  zoomLink: z.string().url().optional().or(z.literal('')),

  // TAB 3: ACREEDORES
  debts: z.array(debtSchema).min(1, "Debe agregar al menos un acreedor"),
  libranzas: z.array(libranzaSchema).optional().default([]),
  suspendedServices: z.array(suspendedServiceSchema).optional().default([]),

  // TAB 4: BIENES
  hasAssets: z.boolean(),
  assets: z.array(assetSchema).optional().default([]),

  // TAB 5: PROCESOS JUDICIALES
  hasLegalProcesses: z.boolean(),
  legalProcesses: z.array(legalProcessSchema).optional().default([]),

  // TAB 6: INGRESOS Y GASTOS
  monthlyIncome: z.number().nonnegative("Ingreso no puede ser negativo"),
  otherIncomeDescription: z.string().optional(),
  otherIncomeAmount: z.number().nonnegative().optional().default(0),
  hasEmployerCertification: z.boolean().optional().default(false),
  monthlyExpenses: z.number().nonnegative("Gastos no pueden ser negativos"),
  dependents: z.array(dependentSchema).optional().default([]),

  // TAB 7: PROPUESTA DE PAGO
  gracePeriodRequested: z.boolean().optional().default(false),
  gracePeriodMonths: z.number().int().min(0).max(24).optional(),
  paymentInKind: z.boolean().optional().default(false),
  paymentInKindDescription: z.string().optional(),
  assetSaleAuthorized: z.boolean().optional().default(false),
  assetSaleDescription: z.string().optional(),
  cashFlowPayment: z.boolean().optional().default(false),
  paymentTermMonths: z.number().int().min(1).max(120, "Máximo 120 meses"),
  monthlyPaymentAmount: z.number().nonnegative().optional(),
  variablePayment: z.number().nonnegative().optional(),
  extraordinaryPayment: z.boolean().optional().default(false),
  extraordinaryPaymentDate: z.string().optional(),
  capitalReduction: z.boolean().optional().default(false),
  capitalReductionPercent: z.number().min(0).max(100).optional(),
  insuranceOffering: z.array(z.string()).optional().default([]),
  forgiveAccruedInterest: z.boolean().optional().default(false),
  forgiveFutureInterest: z.boolean().optional().default(false),
  paymentOrder: paymentOrderSchema.optional(),
  hasClassPrivileges: z.boolean().optional().default(false),
  classPrivilegesDescription: z.string().optional(),
  thirdPartyPaymentAuth: z.boolean().optional().default(false),
  guaranteeSubstitution: z.boolean().optional().default(false),

  // TAB 8: SOCIEDAD CONYUGAL
  maritalStatus: z.enum([
    'SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO'
  ]),
  spouse: spouseSchema.optional(),

  // TAB 9: INFORMACIÓN LEGAL
  hasAttorney: z.boolean().optional().default(false),
  attorneyName: z.string().optional(),
  attorneyCedula: z.string().optional(),
  attorneyProfessionalCard: z.string().optional(),
  attorneyEmail: z.string().email().optional().or(z.literal('')),
  attorneyPhone: z.string().optional(),
  notificationAddress: z.string().min(5, "Dirección de notificación requerida"),
  notificationPhone: z.string().min(7, "Teléfono de notificación requerido"),
  notificationEmail: z.string().email("Email de notificación inválido"),
  applicantSignatureName: z.string().min(2, "Nombre del firmante requerido"),
  applicantSignatureId: z.string().min(5, "Cédula del firmante requerida"),

  // TAB 10: DOCUMENTOS
  documents: z.array(documentSchema).optional(),

}).superRefine((data, ctx) => {
  // ============================================
  // VALIDACIONES DE COHERENCIA
  // ============================================

  // 1. Si tiene bienes, debe tener al menos uno
  if (data.hasAssets && (!data.assets || data.assets.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Si declara tener bienes, debe agregar al menos uno",
      path: ['assets'],
    });
  }

  // 2. Si tiene procesos, debe tener al menos uno
  if (data.hasLegalProcesses && (!data.legalProcesses || data.legalProcesses.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Si declara tener procesos judiciales, debe agregar al menos uno",
      path: ['legalProcesses'],
    });
  }

  // 3. Si solicita período de gracia, debe especificar meses
  if (data.gracePeriodRequested && !data.gracePeriodMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar los meses de período de gracia",
      path: ['gracePeriodMonths'],
    });
  }

  // 4. Si ofrece dación en pago, debe describir el bien
  if (data.paymentInKind && !data.paymentInKindDescription) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe describir el bien para dación en pago",
      path: ['paymentInKindDescription'],
    });
  }

  // 5. Si autoriza venta, debe describir el bien
  if (data.assetSaleAuthorized && !data.assetSaleDescription) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe describir el bien autorizado para venta",
      path: ['assetSaleDescription'],
    });
  }

  // 6. Si solicita quitas, debe especificar porcentaje
  if (data.capitalReduction && !data.capitalReductionPercent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar el porcentaje de reducción",
      path: ['capitalReductionPercent'],
    });
  }

  // 7. Si es casado o unión libre, debe ingresar datos del cónyuge
  if (['CASADO', 'UNION_LIBRE'].includes(data.maritalStatus) && !data.spouse) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe ingresar los datos del cónyuge",
      path: ['spouse'],
    });
  }

  // 8. Si actúa con apoderado, debe ingresar datos del abogado
  if (data.hasAttorney) {
    if (!data.attorneyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nombre del apoderado requerido",
        path: ['attorneyName'],
      });
    }
    if (!data.attorneyCedula) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cédula del apoderado requerida",
        path: ['attorneyCedula'],
      });
    }
    if (!data.attorneyProfessionalCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tarjeta profesional requerida",
        path: ['attorneyProfessionalCard'],
      });
    }
  }

  // 9. Si causa incluye "OTROS", debe detallar
  if (data.causes.includes('OTROS') && !data.causesOtherDetail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe detallar la causa 'Otros'",
      path: ['causesOtherDetail'],
    });
  }

  // 10. Si algún acreedor tiene libranza, debe haber al menos una libranza
  const hasLibranzaDebt = data.debts.some(d => d.hasActiveLibranza);
  if (hasLibranzaDebt && (!data.libranzas || data.libranzas.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Hay acreedores con libranza activa, debe agregar información de libranzas",
      path: ['libranzas'],
    });
  }

  // 11. Validar que el plazo es coherente con la capacidad de pago
  const totalCapital = data.debts.reduce((sum, d) => sum + d.capitalAmount, 0);
  const availableMonthly = data.monthlyIncome + (data.otherIncomeAmount || 0) - data.monthlyExpenses;

  if (availableMonthly > 0 && data.paymentTermMonths) {
    const minMonths = Math.ceil(totalCapital / availableMonthly);
    if (data.paymentTermMonths < minMonths && !data.capitalReduction && !data.paymentInKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El plazo mínimo para pagar la deuda es ${minMonths} meses con el disponible actual`,
        path: ['paymentTermMonths'],
      });
    }
  }
});

export type CreateCaseFormData = z.infer<typeof createCaseFormSchema>;
```

---

## 1.2 Validación de Documentos Obligatorios

```typescript
// src/features/case/utils/document-validation.ts

interface RequiredDocument {
  id: string;
  name: string;
  condition: (data: CreateCaseFormData) => boolean;
}

export const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    id: 'cedula',
    name: 'Cédula de ciudadanía',
    condition: () => true, // Siempre obligatorio
  },
  {
    id: 'redam',
    name: 'REDAM',
    condition: () => true, // Siempre obligatorio
  },
  {
    id: 'certificado_ingresos',
    name: 'Certificado de ingresos',
    condition: () => true, // Siempre obligatorio
  },
  {
    id: 'certificado_tradicion',
    name: 'Certificado de tradición y libertad',
    condition: (data) => data.assets?.some(a => a.type === 'INMUEBLE') ?? false,
  },
  {
    id: 'matricula_mercantil',
    name: 'Matrícula mercantil',
    condition: (data) => data.applicantScope === 'PERSONA_NATURAL_PEQUENA_COMERCIANTE',
  },
  {
    id: 'poder',
    name: 'Poder (notariado o correo)',
    condition: (data) => data.hasAttorney === true,
  },
];

export function validateRequiredDocuments(
  data: CreateCaseFormData,
  uploadedDocuments: string[]
): { valid: boolean; missing: string[] } {
  const applicableDocuments = REQUIRED_DOCUMENTS.filter(doc => doc.condition(data));
  const missing = applicableDocuments
    .filter(doc => !uploadedDocuments.includes(doc.id))
    .map(doc => doc.name);

  return {
    valid: missing.length === 0,
    missing,
  };
}
```

---

## 1.3 Validación Backend (Server Action)

```typescript
// src/features/case/actions/create-case.ts

'use server';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { createCaseFormSchema } from '../schemas/create-case-schema';
import { validateRequiredDocuments } from '../utils/document-validation';
import { generateInitialDocuments } from '@/features/document/generate-documents';

export async function createCase(input: unknown) {
  try {
    // 1. Autenticación
    const { user, tenantId } = await authenticateUser();

    if (!user.permissions.includes('Crear casos')) {
      return { success: false, error: 'Sin permisos para crear casos' };
    }

    // 2. Validación de schema
    const validatedData = createCaseFormSchema.parse(input);

    // 3. Verificar que el deudor existe
    const debtor = await prisma.debtor.findFirst({
      where: { id: validatedData.debtorId, tenantId },
    });

    if (!debtor) {
      return { success: false, error: 'Deudor no encontrado' };
    }

    // 4. Verificar documentos obligatorios
    const uploadedDocs = validatedData.documents
      ?.filter(d => d.uploaded)
      .map(d => d.id) ?? [];

    const docValidation = validateRequiredDocuments(validatedData, uploadedDocs);
    if (!docValidation.valid) {
      return {
        success: false,
        error: `Faltan documentos obligatorios: ${docValidation.missing.join(', ')}`,
      };
    }

    // 5. Generar número de radicado
    const year = new Date().getFullYear();
    const lastCase = await prisma.case.findFirst({
      where: {
        tenantId,
        caseNumber: { startsWith: `INS-${year}` },
      },
      orderBy: { caseNumber: 'desc' },
    });

    const sequence = lastCase
      ? parseInt(lastCase.caseNumber.split('-')[2]) + 1
      : 1;
    const caseNumber = `INS-${year}-${sequence.toString().padStart(3, '0')}`;

    // 6. Verificar unicidad
    const existing = await prisma.case.findFirst({
      where: { caseNumber, tenantId },
    });

    if (existing) {
      return { success: false, error: 'Número de radicado ya existe' };
    }

    // 7. Crear caso en transacción
    const newCase = await prisma.$transaction(async (tx) => {
      // 7.1 Crear caso principal
      const caseRecord = await tx.case.create({
        data: {
          caseNumber,
          type: 'INSOLVENCY',
          status: 'SOLICITUD',
          phase: 'INICIAL',
          tenantId,
          operatorId: user.id,
          debtorId: validatedData.debtorId,

          // Campos del formulario
          causes: validatedData.causes,
          applicantScope: [validatedData.applicantScope],
          monthlyIncome: validatedData.monthlyIncome,
          monthlyExpenses: validatedData.monthlyExpenses,
          otherIncomeDescription: validatedData.otherIncomeDescription,
          otherIncomeAmount: validatedData.otherIncomeAmount,
          hasEmployerCertification: validatedData.hasEmployerCertification,
          hasLegalProcesses: validatedData.hasLegalProcesses,

          // Propuesta de pago
          gracePeriodRequested: validatedData.gracePeriodRequested,
          gracePeriodMonths: validatedData.gracePeriodMonths,
          paymentInKind: validatedData.paymentInKind,
          paymentInKindDescription: validatedData.paymentInKindDescription,
          assetSaleAuthorized: validatedData.assetSaleAuthorized,
          assetSaleDescription: validatedData.assetSaleDescription,
          cashFlowPayment: validatedData.cashFlowPayment,
          paymentTermMonths: validatedData.paymentTermMonths,
          monthlyPaymentAmount: validatedData.monthlyPaymentAmount,
          variablePayment: validatedData.variablePayment,
          extraordinaryPayment: validatedData.extraordinaryPayment,
          extraordinaryPaymentDate: validatedData.extraordinaryPaymentDate,
          capitalReduction: validatedData.capitalReduction,
          capitalReductionPercent: validatedData.capitalReductionPercent,
          insuranceOffering: validatedData.insuranceOffering,
          forgiveAccruedInterest: validatedData.forgiveAccruedInterest,
          forgiveFutureInterest: validatedData.forgiveFutureInterest,
          paymentOrder: validatedData.paymentOrder,
          hasClassPrivileges: validatedData.hasClassPrivileges,
          classPrivilegesDescription: validatedData.classPrivilegesDescription,
          thirdPartyPaymentAuth: validatedData.thirdPartyPaymentAuth,
          guaranteeSubstitution: validatedData.guaranteeSubstitution,

          // Cónyuge
          spouseName: validatedData.spouse?.name,
          spouseIdNumber: validatedData.spouse?.idNumber,
          spouseAddress: validatedData.spouse?.address,
          spousePhone: validatedData.spouse?.phone,
          spouseEmail: validatedData.spouse?.email,

          // Notificaciones
          notificationAddress: validatedData.notificationAddress,
          notificationPhone: validatedData.notificationPhone,
          notificationEmail: validatedData.notificationEmail,

          // Firma
          applicantSignatureName: validatedData.applicantSignatureName,
          applicantSignatureId: validatedData.applicantSignatureId,

          // Zoom
          zoomMeetingId: validatedData.zoomMeetingId,
          zoomPassword: validatedData.zoomPassword,
          zoomLink: validatedData.zoomLink,

          // Calcular deuda total
          totalDebt: validatedData.debts.reduce(
            (sum, d) => sum + d.capitalAmount + (d.interestAmount || 0), 0
          ),
          creditors: validatedData.debts.length,
        },
      });

      // 7.2 Crear deudas
      for (const debt of validatedData.debts) {
        // Buscar o crear acreedor
        let creditor = await tx.creditor.findFirst({
          where: { name: debt.creditorName, tenantId },
        });

        if (!creditor) {
          creditor = await tx.creditor.create({
            data: {
              name: debt.creditorName,
              email: debt.creditorEmail,
              address: debt.creditorAddress,
              city: debt.creditorCity,
              tenantId,
            },
          });
        }

        await tx.debt.create({
          data: {
            caseId: caseRecord.id,
            creditorId: creditor.id,
            debtorId: validatedData.debtorId,
            tenantId,
            amount: debt.capitalAmount + (debt.interestAmount || 0),
            capitalAmount: debt.capitalAmount,
            interestAmount: debt.interestAmount,
            interestRate: debt.interestRate,
            isDeferred: debt.isDeferred,
            documentType: debt.documentType,
            grantDate: debt.grantDate,
            dueDate: debt.dueDate,
            creditClassification: debt.creditClassification,
            hasActiveLibranza: debt.hasActiveLibranza,
            creditorClass: debt.creditorClass,
            daysOverdue: debt.daysOverdue,
            creditorCity: debt.creditorCity,
            creditorAddress: debt.creditorAddress,
            creditorEmail: debt.creditorEmail,
            coDebtorName: debt.coDebtor?.name,
            coDebtorCity: debt.coDebtor?.city,
            coDebtorAddress: debt.coDebtor?.address,
          },
        });
      }

      // 7.3 Crear bienes
      for (const asset of validatedData.assets || []) {
        await tx.asset.create({
          data: {
            caseId: caseRecord.id,
            debtorId: validatedData.debtorId,
            tenantId,
            type: asset.type,
            name: asset.type === 'INMUEBLE'
              ? `${asset.propertyType} - ${asset.address}`
              : asset.description,
            value: asset.value,
            ...(asset.type === 'INMUEBLE' && {
              propertyType: asset.propertyType,
              address: asset.address,
              registrationNumber: asset.registrationNumber,
              encumbrance: asset.encumbrance,
              affectation: asset.affectation,
              precautionaryMeasure: asset.precautionaryMeasure,
              isFamilyHome: asset.isFamilyHome,
              isInalienablePatrimony: asset.isInalienablePatrimony,
              proofDocument: asset.proofDocument,
            }),
            ...(asset.type === 'MUEBLE' && {
              description: asset.description,
              brand: asset.brand,
              model: asset.model,
              licensePlate: asset.licensePlate,
              transitAuthority: asset.transitAuthority,
              guaranteeInFavorOf: asset.guaranteeInFavorOf,
              guaranteeAmount: asset.guaranteeAmount,
            }),
          },
        });
      }

      // 7.4 Crear procesos legales
      for (const process of validatedData.legalProcesses || []) {
        await tx.legalProcess.create({
          data: {
            caseId: caseRecord.id,
            tenantId,
            processType: process.processType,
            plaintiff: process.plaintiff,
            court: process.court,
            fileNumber: process.fileNumber,
            precautionaryMeasure: process.precautionaryMeasure,
          },
        });
      }

      // 7.5 Crear libranzas
      for (const libranza of validatedData.libranzas || []) {
        await tx.libranza.create({
          data: {
            caseId: caseRecord.id,
            tenantId,
            ...libranza,
          },
        });
      }

      // 7.6 Crear servicios suspendidos
      for (const service of validatedData.suspendedServices || []) {
        await tx.suspendedService.create({
          data: {
            caseId: caseRecord.id,
            tenantId,
            ...service,
          },
        });
      }

      // 7.7 Crear dependientes
      for (const dep of validatedData.dependents || []) {
        await tx.dependent.create({
          data: {
            caseId: caseRecord.id,
            tenantId,
            ...dep,
          },
        });
      }

      return caseRecord;
    });

    // 8. Generar documentos de ETAPA 1
    const generationResult = await generateInitialDocuments(newCase.id, tenantId);

    // 9. Retornar éxito
    return {
      success: true,
      data: {
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        documentsGenerated: generationResult.generated,
        documentsFailed: generationResult.failed,
      },
    };

  } catch (error) {
    console.error('Error creating case:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Datos inválidos',
        validationErrors: error.errors,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
```

---

# PARTE 2: FLUJO DE GENERACIÓN DOCUMENTAL

## 2.1 Arquitectura de Generación por Etapas

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE GENERACIÓN DOCUMENTAL                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ETAPA 1: SOLICITUD (Automático al crear caso)                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Solicitud de Insolvencia                                     │   │
│  │  ✅ Check List                                                   │   │
│  │  ✅ Certificado de Ingresos                                      │   │
│  │  ✅ Declaración Juramentada Domicilio                            │   │
│  │  ✅ Hoja Guía                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│                     [Operador diligencia fechas]                       │
│                              ↓                                          │
│  ETAPA 2: ADMISIÓN (Al establecer fecha de admisión)                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⏳ Auto Admisión del Trámite         (requiere FECHA_ADMISION) │   │
│  │  ⏳ Designación del Conciliador       (requiere FECHA_DESIGNACION)│  │
│  │  ⏳ Aceptación del Cargo              (requiere FECHA_ACEPTACION)│   │
│  │  ⏳ Notificación a Acreedores         (requiere lista validada)  │   │
│  │  ⏳ Edicto Emplazatorio               (requiere acreedores)      │   │
│  │  ⏳ Suspensión Juzgados               (si tiene procesos)        │   │
│  │  ⏳ Suspensión Garantía Mobiliaria    (si aplica)                │   │
│  │  ⏳ Envío Pagador Suspensión          (si tiene libranzas)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ETAPA 3: AUDIENCIA (Manual durante audiencia)                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔵 Trámite Audiencia                 (diligenciamiento manual)  │   │
│  │  🔵 CYG Trámite                       (calificación créditos)    │   │
│  │  🔵 Sentido del Voto                  (por cada acreedor)        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ETAPA 4: RESULTADO (Al cerrar trámite)                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Si hay acuerdo:                                                 │   │
│  │    ⏳ Acuerdo de Pago                                            │   │
│  │    ⏳ Acuerdo Bilateral (si aplica)                              │   │
│  │  Si fracasa:                                                     │   │
│  │    ⏳ Fracaso Trámite                                            │   │
│  │    ⏳ Remisión Juzgado                                           │   │
│  │  Si desiste:                                                     │   │
│  │    ⏳ Auto Desistimiento                                         │   │
│  │  Siempre:                                                        │   │
│  │    ⏳ Remisión Resultado                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Leyenda:
  ✅ = Generación automática inmediata
  ⏳ = Generación automática cuando se cumplen condiciones
  🔵 = Diligenciamiento manual (no se autogenera)
```

---

## 2.2 Implementación del Generador por Etapas

```typescript
// src/features/document/generate-documents.ts

import { getCaseWithRelations } from '@/features/case/queries';
import { mapCaseToPlaceholders, replacePlaceholders } from './placeholder-mapper';
import { generatePdfFromHtml } from '@/lib/html-to-pdf';
import { googleDriveService } from '@/lib/google-drive';
import { getTemplateHtml } from './template-loader';
import prisma from '@/lib/prisma';

// ============================================
// CONFIGURACIÓN DE DOCUMENTOS POR ETAPA
// ============================================

interface DocumentConfig {
  id: string;
  templateFile: string;
  outputName: string;
  requiredFields: string[];
  condition?: (caseData: any) => boolean;
}

const ETAPA_1_DOCUMENTS: DocumentConfig[] = [
  {
    id: 'solicitud-insolvencia',
    templateFile: 'Solicitud de Insolvencia.html',
    outputName: 'Solicitud de Insolvencia.pdf',
    requiredFields: ['DEUDOR_NOMBRE', 'DEUDOR_CEDULA', 'TOTAL_ACREENCIAS'],
  },
  {
    id: 'check-list',
    templateFile: 'Check List.html',
    outputName: 'Check List.pdf',
    requiredFields: ['DEUDOR_NOMBRE'],
  },
  {
    id: 'certificado-ingresos',
    templateFile: 'Certificado de Ingresos.html',
    outputName: 'Certificado de Ingresos.pdf',
    requiredFields: ['DEUDOR_NOMBRE', 'INGRESO_PRINCIPAL'],
  },
  {
    id: 'declaracion-domicilio',
    templateFile: 'Declaracion Juramentada Domicilio.html',
    outputName: 'Declaracion Juramentada Domicilio.pdf',
    requiredFields: ['DEUDOR_NOMBRE', 'DEUDOR_DIRECCION'],
  },
  {
    id: 'hoja-guia',
    templateFile: 'Hoja Guia con el final.html',
    outputName: 'Hoja Guia.pdf',
    requiredFields: ['CASO_RADICADO', 'DEUDOR_NOMBRE'],
  },
];

const ETAPA_2_DOCUMENTS: DocumentConfig[] = [
  {
    id: 'auto-admision',
    templateFile: 'Auto admision del tramite.html',
    outputName: 'Auto Admision del Tramite.pdf',
    requiredFields: ['FECHA_ADMISION', 'FECHA_AUDIENCIA', 'HORA_AUDIENCIA', 'ZOOM_ID'],
  },
  {
    id: 'designacion-conciliador',
    templateFile: 'Designacion del Conciliador.html',
    outputName: 'Designacion del Conciliador.pdf',
    requiredFields: ['FECHA_RADICACION', 'FECHA_DESIGNACION'],
  },
  {
    id: 'aceptacion-cargo',
    templateFile: 'Aceptacion del Cargo del Conciliador.html',
    outputName: 'Aceptacion del Cargo del Conciliador.pdf',
    requiredFields: ['FECHA_RADICACION', 'FECHA_DESIGNACION', 'FECHA_ACEPTACION'],
  },
  {
    id: 'notificacion-acreedores',
    templateFile: 'Notificacion a los Acreedores.html',
    outputName: 'Notificacion a los Acreedores.pdf',
    requiredFields: ['DEUDOR_NOMBRE', 'FECHA_AUDIENCIA'],
  },
  {
    id: 'edicto-emplazatorio',
    templateFile: 'Edicto Emplazatorio Publicacion en periodico.html',
    outputName: 'Edicto Emplazatorio.pdf',
    requiredFields: ['DEUDOR_NOMBRE', 'LISTA_ACREEDORES_EDICTO'],
  },
  {
    id: 'suspension-juzgados',
    templateFile: 'Suspension Juzgados Procesos Judiciales.html',
    outputName: 'Suspension Juzgados.pdf',
    requiredFields: ['PROCESO_1_JUZGADO'],
    condition: (caseData) => caseData.hasLegalProcesses && caseData.legalProcesses?.length > 0,
  },
  {
    id: 'envio-pagador',
    templateFile: 'Formato Envio Pagador Para Suspension de Pagos.html',
    outputName: 'Envio Pagador Suspension.pdf',
    requiredFields: ['LIBRANZA_PAGADOR'],
    condition: (caseData) => caseData.libranzas?.length > 0,
  },
];

// ============================================
// VALIDADOR DE CAMPOS REQUERIDOS
// ============================================

function validateRequiredFields(
  placeholders: Record<string, string>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => {
    const value = placeholders[field];
    return !value || value === '' || value === 'N/A' || value === 'undefined';
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ============================================
// GENERADOR PRINCIPAL
// ============================================

export async function generateDocumentsForStage(
  caseId: string,
  stage: 'ETAPA_1' | 'ETAPA_2' | 'ETAPA_4',
  tenantId: string
): Promise<{
  generated: string[];
  failed: { document: string; reason: string }[];
}> {
  const caseData = await getCaseWithRelations(caseId);

  if (!caseData) {
    throw new Error('Caso no encontrado');
  }

  // Mapear todos los placeholders
  const placeholders = mapCaseToPlaceholders(caseData);

  // Seleccionar documentos según etapa
  const documents = stage === 'ETAPA_1' ? ETAPA_1_DOCUMENTS :
                    stage === 'ETAPA_2' ? ETAPA_2_DOCUMENTS :
                    []; // ETAPA_4 se maneja aparte

  const generated: string[] = [];
  const failed: { document: string; reason: string }[] = [];

  // Crear carpeta del caso en Drive si no existe
  const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
    caseData.caseNumber,
    process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID!
  );

  // Procesar cada documento
  for (const doc of documents) {
    try {
      // Verificar condición
      if (doc.condition && !doc.condition(caseData)) {
        console.log(`Skipping ${doc.id}: condition not met`);
        continue;
      }

      // Validar campos requeridos
      const validation = validateRequiredFields(placeholders, doc.requiredFields);

      if (!validation.valid) {
        failed.push({
          document: doc.outputName,
          reason: `Campos faltantes: ${validation.missing.join(', ')}`,
        });
        continue;
      }

      // Cargar template HTML
      const templateHtml = await getTemplateHtml(doc.templateFile);

      // Reemplazar placeholders
      const processedHtml = replacePlaceholders(templateHtml, placeholders);

      // Generar PDF
      const pdfBuffer = await generatePdfFromHtml(processedHtml);

      // Subir a Drive
      const { fileId, fileUrl } = await googleDriveService.uploadDocumentToCase(
        doc.outputName,
        pdfBuffer,
        caseFolderId
      );

      // Registrar en BD
      await prisma.document.create({
        data: {
          name: doc.outputName,
          type: doc.id,
          status: 'GENERADO',
          uploadDate: new Date(),
          url: fileUrl,
          googleDriveId: fileId,
          caseId,
          isGenerated: true,
          tenantId,
        },
      });

      generated.push(doc.outputName);

    } catch (error) {
      console.error(`Error generating ${doc.id}:`, error);
      failed.push({
        document: doc.outputName,
        reason: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return { generated, failed };
}

// ============================================
// FUNCIONES ESPECÍFICAS POR ETAPA
// ============================================

export async function generateInitialDocuments(
  caseId: string,
  tenantId: string
) {
  return generateDocumentsForStage(caseId, 'ETAPA_1', tenantId);
}

export async function generateAdmissionDocuments(
  caseId: string,
  tenantId: string
) {
  // Verificar que las fechas procesales existan
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      filingDate: true,
      designationDate: true,
      positionAcceptanceDate: true,
      admissionDate: true,
      firstHearingDate: true,
      firstHearingTime: true,
    },
  });

  if (!caseData?.admissionDate) {
    throw new Error('Fecha de admisión no establecida');
  }

  if (!caseData?.firstHearingDate || !caseData?.firstHearingTime) {
    throw new Error('Fecha y hora de primera audiencia no establecidas');
  }

  return generateDocumentsForStage(caseId, 'ETAPA_2', tenantId);
}

// ============================================
// REGENERACIÓN DE DOCUMENTOS
// ============================================

export async function regenerateDocument(
  caseId: string,
  documentType: string,
  tenantId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const caseData = await getCaseWithRelations(caseId);

    if (!caseData) {
      return { success: false, error: 'Caso no encontrado' };
    }

    // Buscar configuración del documento
    const allDocs = [...ETAPA_1_DOCUMENTS, ...ETAPA_2_DOCUMENTS];
    const docConfig = allDocs.find(d => d.id === documentType);

    if (!docConfig) {
      return { success: false, error: 'Tipo de documento no encontrado' };
    }

    const placeholders = mapCaseToPlaceholders(caseData);
    const validation = validateRequiredFields(placeholders, docConfig.requiredFields);

    if (!validation.valid) {
      return {
        success: false,
        error: `Campos faltantes: ${validation.missing.join(', ')}`,
      };
    }

    // Generar documento
    const templateHtml = await getTemplateHtml(docConfig.templateFile);
    const processedHtml = replacePlaceholders(templateHtml, placeholders);
    const pdfBuffer = await generatePdfFromHtml(processedHtml);

    // Buscar documento existente
    const existingDoc = await prisma.document.findFirst({
      where: { caseId, type: documentType, tenantId },
    });

    // Obtener carpeta del caso
    const caseFolderId = await googleDriveService.findOrCreateCaseFolder(
      caseData.caseNumber,
      process.env.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID!
    );

    // Subir nueva versión
    const { fileId, fileUrl } = await googleDriveService.uploadDocumentToCase(
      docConfig.outputName,
      pdfBuffer,
      caseFolderId
    );

    // Actualizar o crear registro
    if (existingDoc) {
      // Eliminar archivo anterior de Drive
      if (existingDoc.googleDriveId) {
        await googleDriveService.deleteFile(existingDoc.googleDriveId).catch(() => {});
      }

      await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          url: fileUrl,
          googleDriveId: fileId,
          uploadDate: new Date(),
          status: 'REGENERADO',
        },
      });
    } else {
      await prisma.document.create({
        data: {
          name: docConfig.outputName,
          type: documentType,
          status: 'GENERADO',
          uploadDate: new Date(),
          url: fileUrl,
          googleDriveId: fileId,
          caseId,
          isGenerated: true,
          tenantId,
        },
      });
    }

    return { success: true, url: fileUrl };

  } catch (error) {
    console.error('Error regenerating document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
```

---

## 2.3 Trigger de Generación en Actualización de Fechas

```typescript
// src/features/case/actions/update-case-dates.ts

'use server';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { generateAdmissionDocuments } from '@/features/document/generate-documents';
import { z } from 'zod';

const updateDatesSchema = z.object({
  caseId: z.string(),
  filingDate: z.string().optional(),
  designationDate: z.string().optional(),
  positionAcceptanceDate: z.string().optional(),
  admissionDate: z.string().optional(),
  firstHearingDate: z.string().optional(),
  firstHearingTime: z.string().optional(),
});

export async function updateCaseDates(input: unknown) {
  const { user, tenantId } = await authenticateUser();

  if (!user.permissions.includes('Editar casos')) {
    return { success: false, error: 'Sin permisos' };
  }

  const data = updateDatesSchema.parse(input);

  // Obtener caso actual
  const currentCase = await prisma.case.findUnique({
    where: { id: data.caseId, tenantId },
  });

  if (!currentCase) {
    return { success: false, error: 'Caso no encontrado' };
  }

  // Actualizar fechas
  const updatedCase = await prisma.case.update({
    where: { id: data.caseId },
    data: {
      filingDate: data.filingDate ? new Date(data.filingDate) : undefined,
      designationDate: data.designationDate ? new Date(data.designationDate) : undefined,
      positionAcceptanceDate: data.positionAcceptanceDate ? new Date(data.positionAcceptanceDate) : undefined,
      admissionDate: data.admissionDate ? new Date(data.admissionDate) : undefined,
      firstHearingDate: data.firstHearingDate ? new Date(data.firstHearingDate) : undefined,
      firstHearingTime: data.firstHearingTime,
    },
  });

  // Verificar si debemos generar documentos de ETAPA 2
  const wasNotAdmitted = !currentCase.admissionDate;
  const isNowAdmitted = !!updatedCase.admissionDate;
  const hasAllDates = updatedCase.filingDate &&
                      updatedCase.designationDate &&
                      updatedCase.positionAcceptanceDate &&
                      updatedCase.admissionDate &&
                      updatedCase.firstHearingDate &&
                      updatedCase.firstHearingTime;

  let documentsGenerated = null;

  if (wasNotAdmitted && isNowAdmitted && hasAllDates) {
    // Generar documentos de admisión
    try {
      documentsGenerated = await generateAdmissionDocuments(data.caseId, tenantId);

      // Actualizar estado del caso
      await prisma.case.update({
        where: { id: data.caseId },
        data: { status: 'ADMITIDO', phase: 'NOTIFICACION' },
      });
    } catch (error) {
      console.error('Error generating admission documents:', error);
    }
  }

  return {
    success: true,
    data: {
      case: updatedCase,
      documentsGenerated,
    },
  };
}
```

---

## 2.4 Resumen de Comandos de Generación

| Momento | Función | Trigger |
|---------|---------|---------|
| Al crear caso | `generateInitialDocuments()` | Automático |
| Al establecer fechas procesales | `generateAdmissionDocuments()` | Automático cuando todas las fechas están |
| Regenerar un documento | `regenerateDocument()` | Manual desde UI |
| Descargar documento | Drive URL | Manual |

---

## 2.5 Interfaz de Usuario para Estados de Documentos

```typescript
// src/app/cases/[id]/documents/page.tsx

// Mostrar estado de cada documento
interface DocumentStatus {
  id: string;
  name: string;
  status: 'PENDING' | 'GENERATED' | 'MANUAL' | 'MISSING_DATA';
  missingFields?: string[];
  url?: string;
  generatedAt?: Date;
}

// Colores por estado
const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-600',     // Gris - Pendiente
  GENERATED: 'bg-green-100 text-green-700', // Verde - Generado
  MANUAL: 'bg-blue-100 text-blue-700',      // Azul - Diligenciamiento manual
  MISSING_DATA: 'bg-red-100 text-red-700',  // Rojo - Faltan datos
};

// Acciones por estado
const ACTIONS_BY_STATUS = {
  PENDING: ['Generar'],
  GENERATED: ['Ver', 'Descargar', 'Regenerar'],
  MANUAL: ['Diligenciar'],
  MISSING_DATA: ['Ver campos faltantes'],
};
```
