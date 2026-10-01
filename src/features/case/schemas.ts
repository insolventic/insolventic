import { z } from 'zod';

import { CASE_PHASE_VALUES } from '@/lib/case-phases';
import { requiresOtherDetail } from '@/features/case/proceso-judicial-tipos';

/**
 * Fase del expediente restringida a las fases conocidas (C-1).
 *
 * Antes era `z.string()`: cualquier cadena entraba a la BD y rompía filtros,
 * dashboard y PACKAGE_PHASE_MAP. La validación de *transición* (qué fase puede
 * seguir a cuál) vive aparte, en `validatePhaseTransition`, y la aplican
 * `createCase` / `updateCase` / `updateCasePhase` contra la fase persistida.
 */
const casePhaseEnum = z.enum(CASE_PHASE_VALUES as [string, ...string[]], {
  message: 'Fase de expediente desconocida',
});

const decimalToNumber = z.any().transform((val) => {
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return val.toNumber();
  }
  return Number(val);
});

// ---------------------------------------------------------------------------
// Conciliation repeatable-row sub-schemas (JSON arrays stored in Prisma Json?)
// ---------------------------------------------------------------------------
const concMenorSchema = z.object({
  NOMBRE_MENOR: z.string().min(1, 'Nombre requerido'),
});

const concMenorUnionSchema = z.object({
  NOMBRE_MENOR_UNION: z.string().min(1, 'Nombre requerido'),
});

const concClausulaSchema = z.object({
  NUMERO_CLAUSULA: z.string().min(1, 'Número requerido'),
  TEXTO_CLAUSULA: z.string().min(1, 'Texto requerido'),
});

/**
 * Una fila del desglose de servicios de manutención (columna Json? de Case).
 *
 * `nombre` es obligatorio porque una fila sin nombre no se puede mostrar; en los
 * tres tipos fijos lo pone el catálogo, en "Otros" lo escribe el operador.
 * `descripcion` es libre y opcional.
 */
export const servicioManutencionSchema = z.object({
  tipo: z.string().min(1),
  nombre: z.string().min(1, 'Nombre del servicio requerido'),
  descripcion: z.string().optional(),
});

const concClausulaAdicionalSchema = z.object({
  NUMERO_CLAUSULA_ADICIONAL: z.string().min(1, 'Número requerido'),
  TEXTO_CLAUSULA_ADICIONAL: z.string().min(1, 'Texto requerido'),
});

export {
  concMenorSchema,
  concMenorUnionSchema,
  concClausulaSchema,
  concClausulaAdicionalSchema,
};

const mapCaseTypeToSpanish = z.string().transform((type) => {
  const typeMap: Record<string, string> = {
    INSOLVENCY: 'Insolvencia',
    CONCILIATION: 'Conciliación',
    SUPPORT_AGREEMENT: 'Acuerdo de Apoyo',
  };
  return typeMap[type] || type;
});

const debtorForCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  idNumber: z.string(),
  idType: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string().nullable(),
  department: z.string().nullable(),
  birthDate: z.coerce.date().nullable(),
  maritalStatus: z.string().nullable(),
  occupation: z.string().nullable(),
  monthlyIncome: decimalToNumber,
  monthlyExpenses: decimalToNumber,
  otherIncomeDescription: z.string().nullable().optional(),
  otherIncomeAmount: decimalToNumber.nullable().optional(),
  hasEmployerCertification: z.boolean().optional(),
  dependents: z.coerce.number().nullable(),
  educationLevel: z.string().nullable(),
  totalDebt: decimalToNumber,
  emergencyContact: z.string().nullable(),
  emergencyPhone: z.string().nullable(),
  bankAccount: z.string().nullable(),
  bankName: z.string().nullable(),
  accountType: z.string().nullable(),
  description: z.string().nullable(),
  activeCases: z.coerce.number(),
  createdDate: z.coerce.date(),
  lastUpdate: z.coerce.date(),
  // Formulario definitivo - Sección I
  deudorTipoIdentificacion: z.string().nullable().optional(),
  deudorIdentificacion: z.string().nullable().optional(),
  deudorPrimerNombre: z.string().nullable().optional(),
  deudorSegundoNombre: z.string().nullable().optional(),
  deudorPrimerApellido: z.string().nullable().optional(),
  deudorSegundoApellido: z.string().nullable().optional(),
  deudorNombreCompleto: z.string().nullable().optional(),
  deudorFechaNacimiento: z.coerce.date().nullable().optional(),
  deudorLugarNacimiento: z.string().nullable().optional(),
  deudorNacionalidad: z.string().nullable().optional(),
  deudorEstadoCivil: z.string().nullable().optional(),
  deudorRegimenMatrimonial: z.string().nullable().optional(),
  sociedadConyugalVigente: z.boolean().optional(),
  existeCapitulaciones: z.boolean().optional(),
  deudorDireccionResidencia: z.string().nullable().optional(),
  deudorCiudad: z.string().nullable().optional(),
  deudorDepartamento: z.string().nullable().optional(),
  deudorCodigoPostal: z.string().nullable().optional(),
  deudorTelefonoFijo: z.string().nullable().optional(),
  deudorTelefonoCelular: z.string().nullable().optional(),
  deudorCorreoElectronico: z.string().nullable().optional(),
});

const operatorForCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  // Tarjeta profesional del operador: respaldo de TP_CONCILIADORA en los
  // documentos de conciliacion. Opcional porque las consultas que no
  // generan documentos no la piden.
  professionalCard: z.string().optional().nullable(),
});

const creditorForDebtSchema = z.object({
  name: z.string(),
  representative: z.string().optional().nullable(),
});

const documentForCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  uploadDate: z.coerce.date(),
  url: z.string(),
  caseId: z.string(),
  isGenerated: z.boolean().optional(),
});

const debtForCaseSchema = z.object({
  id: z.string(),
  amount: decimalToNumber,
  interestRate: decimalToNumber,
  type: z.string(),
  caseId: z.string(),
  creditorId: z.string(),
  debtorId: z.string().nullable(),
  creditor: creditorForDebtSchema,

  // Detailed creditor information
  creditorAddress: z.string().nullable(),
  creditorCity: z.string().nullable(),
  creditorEmail: z.string().nullable(),
  capitalAmount: decimalToNumber.nullable(),
  interestAmount: decimalToNumber.nullable(),
  isDeferred: z.boolean(),
  documentType: z.string().nullable(),
  grantDate: z.coerce.date().nullable(),
  dueDate: z.coerce.date().nullable(),
  creditClassification: z.string().nullable(),
  hasActiveLibranza: z.boolean(),
  creditorClass: z.string().nullable(),
  percentageOfTotal: decimalToNumber.nullable(),
  daysOverdue: z.number().nullable(),

  // Co-debtor/Guarantor info
  coDebtorName: z.string().nullable(),
  coDebtorCity: z.string().nullable(),
  coDebtorAddress: z.string().nullable(),
  coDebtorPhone: z.string().nullable(),
  coDebtorEmail: z.string().nullable(),
});

const assetForCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  value: decimalToNumber,
  caseId: z.string(),
  debtorId: z.string().nullable(),
  description: z.string().nullable().optional(),
  propertyType: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  encumbrance: z.string().nullable().optional(),
  affectation: z.string().nullable().optional(),
  precautionaryMeasure: z.string().nullable().optional(),
  proofDocument: z.string().nullable().optional(),
  isFamilyHome: z.boolean().nullable().optional(),
  isInalienablePatrimony: z.boolean().nullable().optional(),
  hasPendingFinesOrTaxes: z.boolean().nullable().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  licensePlate: z.string().nullable().optional(),
  transitAuthority: z.string().nullable().optional(),
  guaranteeInFavorOf: z.string().nullable().optional(),
  guaranteeAmount: decimalToNumber.nullable().optional(),
  material: z.string().nullable().optional(),
});

export const debtSchema = z.object({
  id: z.string().optional(),
  creditor: z.string().min(1, 'El acreedor es requerido'),
  creditorId: z.string().optional(), // Optional - not used in detailed form
  amount: z.string().optional(), // Optional - using capitalAmount/interestAmount instead
  type: z.string().min(1, 'El tipo de deuda es requerido'),
  interestRate: z.string().min(1, 'La tasa de interés es requerida'),

  // Detailed creditor information
  creditorAddress: z.string().optional(),
  creditorCity: z.string().optional(),
  creditorEmail: z.string().optional(),
  capitalAmount: z.string().optional(),
  interestAmount: z.string().optional(),
  isDeferred: z.boolean().default(false),
  documentType: z.string().optional(),
  grantDate: z.string().optional(),
  dueDate: z.string().optional(),
  creditClassification: z.string().optional(),
  hasActiveLibranza: z.boolean().default(false),
  creditorClass: z.string().optional(),
  percentageOfTotal: z.string().optional(),
  daysOverdue: z.number().optional(),

  // Co-debtor/Guarantor info
  noCoDebtor: z.boolean().optional(),
  coDebtorName: z.string().optional(),
  coDebtorCity: z.string().optional(),
  coDebtorAddress: z.string().optional(),
  coDebtorPhone: z.string().optional(),
  coDebtorEmail: z.string().optional(),
  // Dynamic "Otra" debt type detail
  otherDebtTypeDetail: z.string().optional(),
});

export const assetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre del bien es requerido'),
  type: z.string().min(1, 'El tipo de bien es requerido'),
  value: z.string().min(1, 'El valor es requerido'),
  description: z.string().optional(),

  // Real Estate specific fields
  propertyType: z.string().optional(),
  address: z.string().optional(),
  registrationNumber: z.string().optional(),
  encumbrance: z.string().optional(),
  affectation: z.string().optional(),
  precautionaryMeasure: z.string().optional(),
  proofDocument: z.string().optional(),
  isFamilyHome: z.boolean().default(false),
  isInalienablePatrimony: z.boolean().default(false),
  hasPendingFinesOrTaxes: z.boolean().default(false),

  // Personal Property specific fields
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  licensePlate: z.string().optional(),
  transitAuthority: z.string().optional(),
  guaranteeInFavorOf: z.string().optional(),
  guaranteeAmount: z.string().optional(),
  material: z.string().optional(),
});
export const libranzaSchema = z.object({
  id: z.string().optional(),
  payerName: z.string().min(1, 'El nombre del pagador es requerido'),
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  payerPhone: z.string().optional(),
  deductedAmount: z.string().min(1, 'La suma descontada es requerida'),
  productAndCreditor: z.string().optional(),
});

export const suspendedServiceSchema = z.object({
  id: z.string().optional(),
  creditorName: z.string().min(1, 'El nombre del acreedor es requerido'),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  suspendedProduct: z.string().optional(),
  amountOwed: z.string().min(1, 'El valor adeudado es requerido'),
});

export const dependentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido'),
  age: z.number().min(0, 'La edad debe ser mayor a 0'),
  relationship: z.string().min(1, 'El parentesco es requerido'),
});

// Schemas for database responses (with Decimal types)
const libranzaForCaseSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerAddress: z.string().nullable(),
  payerEmail: z.string().nullable(),
  payerPhone: z.string().nullable(),
  deductedAmount: decimalToNumber,
  productAndCreditor: z.string().nullable(),
});

const suspendedServiceForCaseSchema = z.object({
  id: z.string(),
  creditorName: z.string(),
  address: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  suspendedProduct: z.string().nullable(),
  amountOwed: decimalToNumber,
});

const dependentForCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  relationship: z.string(),
});

// Legal Process schemas
export const legalProcessSchema = z
  .object({
    id: z.string().optional(),
    processType: z.string().min(1, 'El tipo de proceso es requerido'),
    processTypeOther: z.string().optional(),
    plaintiff: z.string().min(1, 'El demandante es requerido'),
    court: z.string().min(1, 'El juzgado es requerido'),
    courtEmail: z
      .string()
      .email('Correo del juzgado inválido')
      .optional()
      .or(z.literal('')),
    fileNumber: z.string().min(1, 'El expediente es requerido'),
    precautionaryMeasure: z.string().optional(),
  })
  .superRefine((process, ctx) => {
    // "Otros" sin texto no dice nada: es el único tipo que no se explica solo.
    if (
      requiresOtherDetail(process.processType) &&
      !process.processTypeOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['processTypeOther'],
        message: 'Especifique el tipo de proceso',
      });
    }
  });

// ============================================================
// FORMULARIO DEFINITIVO - Schemas de formulario
// ============================================================

// Sección V: Relación Completa de Acreedores
export const acreedorFormSchema = z.object({
  id: z.string().optional(),
  // 5.1 Identificación del acreedor
  acreedorTipo: z.string().optional(),
  acreedorNombreRazonSocial: z
    .string()
    .min(1, 'El nombre o razón social es requerido'),
  acreedorTipoIdentificacion: z.string().optional(),
  acreedorIdentificacion: z.string().optional(),
  acreedorDireccion: z.string().optional(),
  acreedorCiudad: z.string().optional(),
  acreedorCorreo: z.string().optional(),
  acreedorTelefono: z.string().optional(),
  // 5.2 Información de la obligación
  tipoObligacion: z.string().optional(),
  numeroObligacion: z.string().optional(),
  fechaOtorgamiento: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  fechaMora: z.string().optional(),
  diasMora: z.number().optional(),
  valorCapital: z.string().optional(),
  valorInteresesCorrientes: z.string().optional(),
  valorInteresesMora: z.string().optional(),
  valorGastosCobranza: z.string().optional(),
  valorTotalObligacion: z.string().optional(),
  naturalezaCredito: z.string().optional(),
  obligacionCodeudores: z.boolean().default(false),
  nombreCodeudores: z.string().optional(),
  garantiaAsociada: z.boolean().default(false),
  tipoGarantia: z.string().optional(),
  descripcionGarantia: z.string().optional(),
  // 5.3 Información judicial
  procesoJudicialEnCurso: z.boolean().default(false),
  tipoProcesoJudicial: z.string().optional(),
  juzgadoNombre: z.string().optional(),
  juzgadoCiudad: z.string().optional(),
  procesoJudicialRadicado: z.string().optional(),
  demandanteNombre: z.string().optional(),
  etapaProcesal: z.string().optional(),
});

export type AcreedorFormData = z.infer<typeof acreedorFormSchema>;

// Sección VI: Inventario Detallado de Bienes
export const bienFormSchema = z.object({
  id: z.string().optional(),
  // 6.1 Identificación del bien
  bienTipo: z.string().min(1, 'El tipo de bien es requerido'),
  bienDescripcion: z.string().optional(),
  bienUbicacion: z.string().optional(),
  bienMatriculaInmobiliaria: z.string().optional(),
  bienPlaca: z.string().optional(),
  bienEntidadFinanciera: z.string().optional(),
  // 6.2 Valoración
  bienValorComercial: z.string().optional(),
  bienValorCatastral: z.string().optional(),
  bienValorLibros: z.string().optional(),
  // 6.3 Situación jurídica
  bienGravamenes: z.boolean().default(false),
  descripcionGravamen: z.string().optional(),
  bienEmbargado: z.boolean().default(false),
  bienAfectadoViviendaFamiliar: z.boolean().default(false),
  bienEnLeasing: z.boolean().default(false),
});

export type BienFormData = z.infer<typeof bienFormSchema>;

// Sección VII: Relación de Procesos Judiciales
export const procesoJudicialFormSchema = z.object({
  id: z.string().optional(),
  tipoProceso: z.string().optional(),
  tipoProcesoOtro: z.string().optional(),
  juzgadoNombre: z.string().optional(),
  juzgadoCiudad: z.string().optional(),
  juzgadoCorreo: z.string().optional(),
  procesoJudicialRadicado: z.string().optional(),
  demandanteNombre: z.string().optional(),
  demandadoNombre: z.string().optional(),
  cuantiaProceso: z.string().optional(),
  estadoProceso: z.string().optional(),
});

export type ProcesoJudicialFormData = z.infer<typeof procesoJudicialFormSchema>;

// Database response schemas for new models
const acreedorForCaseSchema = z.object({
  id: z.string(),
  acreedorTipo: z.string().nullable(),
  acreedorNombreRazonSocial: z.string(),
  acreedorTipoIdentificacion: z.string().nullable(),
  acreedorIdentificacion: z.string().nullable(),
  acreedorDireccion: z.string().nullable(),
  acreedorCiudad: z.string().nullable(),
  acreedorCorreo: z.string().nullable(),
  acreedorTelefono: z.string().nullable(),
  tipoObligacion: z.string().nullable(),
  numeroObligacion: z.string().nullable(),
  fechaOtorgamiento: z.coerce.date().nullable(),
  fechaVencimiento: z.coerce.date().nullable(),
  fechaMora: z.coerce.date().nullable(),
  diasMora: z.number().nullable(),
  valorCapital: decimalToNumber.nullable(),
  valorInteresesCorrientes: decimalToNumber.nullable(),
  valorInteresesMora: decimalToNumber.nullable(),
  valorGastosCobranza: decimalToNumber.nullable(),
  valorTotalObligacion: decimalToNumber.nullable(),
  naturalezaCredito: z.string().nullable(),
  obligacionCodeudores: z.boolean(),
  nombreCodeudores: z.string().nullable(),
  garantiaAsociada: z.boolean(),
  tipoGarantia: z.string().nullable(),
  descripcionGarantia: z.string().nullable(),
  procesoJudicialEnCurso: z.boolean(),
  tipoProcesoJudicial: z.string().nullable(),
  juzgadoNombre: z.string().nullable(),
  juzgadoCiudad: z.string().nullable(),
  procesoJudicialRadicado: z.string().nullable(),
  demandanteNombre: z.string().nullable(),
  etapaProcesal: z.string().nullable(),
});

const bienForCaseSchema = z.object({
  id: z.string(),
  bienTipo: z.string(),
  bienDescripcion: z.string().nullable(),
  bienUbicacion: z.string().nullable(),
  bienMatriculaInmobiliaria: z.string().nullable(),
  bienPlaca: z.string().nullable(),
  bienEntidadFinanciera: z.string().nullable(),
  bienValorComercial: decimalToNumber.nullable(),
  bienValorCatastral: decimalToNumber.nullable(),
  bienValorLibros: decimalToNumber.nullable(),
  bienGravamenes: z.boolean(),
  descripcionGravamen: z.string().nullable(),
  bienEmbargado: z.boolean(),
  bienAfectadoViviendaFamiliar: z.boolean(),
  bienEnLeasing: z.boolean(),
});

const procesoJudicialForCaseSchema = z.object({
  id: z.string(),
  tipoProceso: z.string().nullable(),
  tipoProcesoOtro: z.string().nullable(),
  juzgadoNombre: z.string().nullable(),
  juzgadoCiudad: z.string().nullable(),
  juzgadoCorreo: z.string().nullable(),
  procesoJudicialRadicado: z.string().nullable(),
  demandanteNombre: z.string().nullable(),
  demandadoNombre: z.string().nullable(),
  cuantiaProceso: decimalToNumber.nullable(),
  estadoProceso: z.string().nullable(),
});

const apoderadoForCaseSchema = z.object({
  id: z.string(),
  orden: z.number(),
  nombreCompleto: z.string(),
  tipoIdentificacion: z.string().nullable(),
  identificacion: z.string().nullable(),
  tarjetaProfesional: z.string().nullable(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  existePoderOtorgado: z.boolean(),
});

const legalProcessForCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  processType: z.string().nullable(),
  processTypeOther: z.string().nullable(),
  plaintiff: z.string().nullable(),
  court: z.string().nullable(),
  courtEmail: z.string().nullable(),
  fileNumber: z.string().nullable(),
  precautionaryMeasure: z.string().nullable(),
});

export const caseSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  debtorName: z.string(),
  type: mapCaseTypeToSpanish,
  totalDebt: decimalToNumber,
  creditors: z.coerce.number(),
  version: z.number().int().default(1),
  createdDate: z.coerce.date(),
  hearingDate: z.coerce.date().nullable(),
  phase: z.string().nullable(),
  causes: z.array(z.string()),
  otherCauseDetail: z.string().nullable().optional(),
  debtorId: z.string(),
  operatorId: z.string(),

  tramite: z.string().nullable(),
  filingDate: z.coerce.date().nullable(),
  debtorIdNumber: z.string().nullable(),
  convened: z.string().nullable(),
  attorney: z.string().nullable(),
  owedCapital: decimalToNumber.nullable(),
  designatedOperator: z.string().nullable(),
  designationDate: z.coerce.date().nullable(),
  positionAcceptanceDate: z.coerce.date().nullable(),
  inadmissionDate: z.coerce.date().nullable(),
  admissionDate: z.coerce.date().nullable(),
  firstHearingDate: z.coerce.date().nullable(),
  firstHearingTime: z.string().nullable(),
  hasLegalProcesses: z.boolean(),

  courtNumber: z.string().nullable(),
  city: z.string().nullable(),
  processType: z.string().nullable(),
  plaintiff: z.string().nullable(),
  judicialFileNumber: z.string().nullable(),
  suspensionDate: z.coerce.date().nullable(),
  resultDeliveryDate: z.coerce.date().nullable(),

  resultType: z.string().nullable(),
  resultDate: z.coerce.date().nullable(),
  siccacNumber: z.string().nullable(),
  riskCenterCommunication: z.boolean(),

  // Ámbito de Aplicación
  applicantScope: z.array(z.string()).optional(),

  // Ingresos y Gastos
  monthlyIncome: decimalToNumber.optional().nullable(),
  monthlyExpenses: decimalToNumber.optional().nullable(),
  otherIncomeDescription: z.string().optional().nullable(),
  otherIncomeAmount: decimalToNumber.optional().nullable(),
  hasEmployerCertification: z.boolean().optional(),

  // Propuesta de Pago
  gracePeriodRequested: z.boolean().optional(),
  gracePeriodMonths: z.coerce.number().optional().nullable(),
  paymentInKind: z.boolean().optional(),
  paymentInKindDescription: z.string().optional().nullable(),
  assetSaleAuthorized: z.boolean().optional(),
  assetSaleDescription: z.string().optional().nullable(),
  cashFlowPayment: z.boolean().optional(),
  paymentTermMonths: z.coerce.number().optional().nullable(),
  monthlyPaymentAmount: decimalToNumber.optional().nullable(),
  variablePayment: decimalToNumber.optional().nullable(),
  extraordinaryPayment: z.boolean().optional(),
  extraordinaryPaymentDate: z.string().optional().nullable(),
  capitalReduction: z.boolean().optional(),
  capitalReductionPercent: decimalToNumber.optional().nullable(),
  insuranceOffering: z.string().optional().nullable(),
  forgiveAccruedInterest: z.boolean().optional(),
  forgiveFutureInterest: z.boolean().optional(),
  paymentOrder: z.any().optional().nullable(), // JsonValue from Prisma
  hasClassPrivileges: z.boolean().optional(),
  classPrivilegesDescription: z.string().optional().nullable(),
  thirdPartyPaymentAuth: z.boolean().optional(),
  guaranteeSubstitution: z.boolean().optional(),

  // Sociedad Conyugal
  spouseName: z.string().optional().nullable(),
  spouseIdNumber: z.string().optional().nullable(),
  spouseAddress: z.string().optional().nullable(),
  spousePhone: z.string().optional().nullable(),
  spouseEmail: z.string().optional().nullable(),

  // Tarifa y Fundamentos
  requestedFee: z.string().optional().nullable(),
  legalFoundations: z.string().optional().nullable(),

  // Notificaciones
  notificationAddress: z.string().optional().nullable(),
  notificationCity: z.string().optional().nullable(),
  notificationPhone: z.string().optional().nullable(),
  notificationEmail: z.string().optional().nullable(),

  // Firma
  applicantSignatureName: z.string().optional().nullable(),
  applicantSignatureId: z.string().optional().nullable(),
  applicantSignature: z.string().optional().nullable(),

  // Zoom Meeting Info
  zoomMeetingId: z.string().optional().nullable(),
  zoomPassword: z.string().optional().nullable(),
  zoomLink: z.string().optional().nullable(),

  // Google Drive folder for case documents
  driveFolderId: z.string().optional().nullable(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección II: Cónyuge
  // ============================================================
  conyugeTipoIdentificacion: z.string().optional().nullable(),
  conyugeIdentificacion: z.string().optional().nullable(),
  conyugePrimerNombre: z.string().optional().nullable(),
  conyugeSegundoNombre: z.string().optional().nullable(),
  conyugePrimerApellido: z.string().optional().nullable(),
  conyugeSegundoApellido: z.string().optional().nullable(),
  conyugeNombreCompleto: z.string().optional().nullable(),
  conyugeTelefono: z.string().optional().nullable(),
  conyugeCorreo: z.string().optional().nullable(),
  sociedadConyugalDisuelta: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección III: Información Laboral y Económica
  // ============================================================
  deudorOcupacion: z.string().optional().nullable(),
  deudorProfesion: z.string().optional().nullable(),
  deudorActividadEconomica: z.string().optional().nullable(),
  deudorTipoVinculacion: z.string().optional().nullable(),
  deudorNombreEmpleador: z.string().optional().nullable(),
  deudorNitEmpleador: z.string().optional().nullable(),
  ingresoPrincipalMensual: decimalToNumber.optional().nullable(),
  otrosIngresosMensuales: decimalToNumber.optional().nullable(),
  totalIngresosMensuales: decimalToNumber.optional().nullable(),
  ingresosVariablesPromedio: decimalToNumber.optional().nullable(),
  ingresosNoOperacionales: decimalToNumber.optional().nullable(),
  gastosVivienda: decimalToNumber.optional().nullable(),
  gastosAlimentacion: decimalToNumber.optional().nullable(),
  gastosServiciosPublicos: decimalToNumber.optional().nullable(),
  gastosTransporte: decimalToNumber.optional().nullable(),
  gastosEducacion: decimalToNumber.optional().nullable(),
  gastosSalud: decimalToNumber.optional().nullable(),
  otrosGastos: decimalToNumber.optional().nullable(),
  totalGastosMensuales: decimalToNumber.optional().nullable(),
  capacidadPagoEstimada: decimalToNumber.optional().nullable(),
  patrimonioTotalEstimado: decimalToNumber.optional().nullable(),
  pasivoTotalEstimado: decimalToNumber.optional().nullable(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IV: Declaración de Cesación de Pagos
  // ============================================================
  cesacionPagos: z.boolean().optional(),
  fechaCesacionPagos: z.coerce.date().optional().nullable(),
  numeroAcreedoresActual: z.coerce.number().optional().nullable(),
  porcentajePasivoEnMora: decimalToNumber.optional().nullable(),
  obligacionesEnMora90Dias: z.boolean().optional(),
  procesosEjecutivosVigentes: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección VIII: Declaraciones del Deudor
  // ============================================================
  declaracionVeracidadInformacion: z.boolean().optional(),
  manifestacionBuenaFe: z.boolean().optional(),
  manifestacionNoOcultamientoBienes: z.boolean().optional(),
  autorizacionNotificacionesCorreo: z.boolean().optional(),
  autorizacionConsultaCentralesRiesgo: z.boolean().optional(),
  autorizacionTratamientoDatos: z.boolean().optional(),
  declaracionNoOmisiones: z.boolean().optional(),
  declaracionConocimientoNorma: z.boolean().optional(),

  // ============================================================
  // CONCILIACIÓN - Campos específicos del servicio de conciliación
  // ============================================================
  concAsunto: z.string().optional().nullable(),
  concDescripcionHechos: z.string().optional().nullable(),
  concPretensiones: z.string().optional().nullable(),
  concCuantiaPesos: z.string().optional().nullable(),
  concCuantiaLetras: z.string().optional().nullable(),
  concRelacionPruebas: z.string().optional().nullable(),
  concOtroMedioComunicacion: z.string().optional().nullable(),
  concFechaNacimiento: z.string().optional().nullable(),
  // Convocante (solicitante)
  concConvocanteName: z.string().optional().nullable(),
  concConvocanteTipoId: z.string().optional().nullable(),
  concConvocanteId: z.string().optional().nullable(),
  concConvocanteDireccion: z.string().optional().nullable(),
  concConvocanteCiudad: z.string().optional().nullable(),
  concConvocanteCorreo: z.string().optional().nullable(),
  concConvocanteCel: z.string().optional().nullable(),
  // Convocado (contraparte)
  concConvocadoName: z.string().optional().nullable(),
  concConvocadoTipoId: z.string().optional().nullable(),
  concConvocadoId: z.string().optional().nullable(),
  concConvocadoDireccion: z.string().optional().nullable(),
  concConvocadoCiudad: z.string().optional().nullable(),
  concConvocadoCorreo: z.string().optional().nullable(),
  concConvocadoCel: z.string().optional().nullable(),
  // Representante legal (opcional)
  concRepLegalName: z.string().optional().nullable(),
  concRepLegalTipoId: z.string().optional().nullable(),
  concRepLegalId: z.string().optional().nullable(),
  concRepLegalDireccion: z.string().optional().nullable(),
  concRepLegalCiudad: z.string().optional().nullable(),
  concRepLegalCorreo: z.string().optional().nullable(),
  concRepLegalCel: z.string().optional().nullable(),
  // Apoderado convocante
  concApoderadoConvocanteName: z.string().optional().nullable(),
  concApoderadoConvocanteTipoId: z.string().optional().nullable(),
  concApoderadoConvocanteId: z.string().optional().nullable(),
  concApoderadoConvocanteDireccion: z.string().optional().nullable(),
  concApoderadoConvocanteCiudad: z.string().optional().nullable(),
  concApoderadoConvocanteCorreo: z.string().optional().nullable(),
  concApoderadoConvocanteCel: z.string().optional().nullable(),
  concApoderadoConvocanteTP: z.string().optional().nullable(),
  // Apoderado convocado
  concApoderadoConvocadoName: z.string().optional().nullable(),
  concApoderadoConvocadoTipoId: z.string().optional().nullable(),
  concApoderadoConvocadoId: z.string().optional().nullable(),
  concApoderadoConvocadoCorreo: z.string().optional().nullable(),
  concApoderadoConvocadoCel: z.string().optional().nullable(),
  concApoderadoConvocadoTP: z.string().optional().nullable(),
  // Conciliadora
  concConciliadoraName: z.string().optional().nullable(),
  concConciliadoraCC: z.string().optional().nullable(),
  concConciliadoraTP: z.string().optional().nullable(),
  // Acuerdo/Acta
  concAcuerdoConciliatorio: z.string().optional().nullable(),
  concInfoAdicional: z.string().optional().nullable(),
  // Alimentos
  concClausulaPrimeroAlimentos: z.string().optional().nullable(),
  concClausulaSegundoAlimentos: z.string().optional().nullable(),
  concClausulaTerceroAlimentos: z.string().optional().nullable(),
  concNombreMenor: z.string().optional().nullable(),
  concNumeroClausula: z.string().optional().nullable(),
  concTextoClausula: z.string().optional().nullable(),
  concNumeroClausulaAdicional: z.string().optional().nullable(),
  concTextoClausulaAdicional: z.string().optional().nullable(),
  // Union marital
  concSituacionBienes: z.string().optional().nullable(),
  concSituacionAlimentos: z.string().optional().nullable(),
  // Informe/Terminacion
  concDescripcionResultado: z.string().optional().nullable(),
  concTipoConstanciaSolicitada: z.string().optional().nullable(),
  concDescripcionCausaAnormal: z.string().optional().nullable(),
  concHoraProgramada: z.string().optional().nullable(),
  // Causa / resultado (mutual-exclusive enum-like)
  concCausaTerminacion: z.string().optional().nullable(),
  concResultadoInforme: z.string().optional().nullable(),
  // Repeatable arrays (stored as Json in Prisma).
  //
  // `.nullable()` NO es cosmético: estas 6 columnas son `Json?` en Prisma, que
  // devuelve `null` (no `undefined`) cuando están vacías — y lo están en todo
  // caso que no sea de conciliación, porque `sanitizeJsonFields` las borra del
  // payload a propósito para que queden en NULL. Sin `.nullable()`, `caseSchema`
  // rechazaba esas filas; como `getAllCasesSchema` es `z.array(caseSchema)`, un
  // solo caso de insolvencia invalidaba el parse completo y `getAllCases`
  // devolvía `success: false`. La página lo enmascaraba con `data || []`, así
  // que /cases mostraba la lista vacía mientras las tarjetas de totales (que no
  // pasan por este schema) seguían mostrando el número correcto.
  //
  // Solo se toca `caseSchema` (camino de LECTURA). `createCaseSchema` y
  // `updateCaseSchema` validan payloads del cliente, que nunca envía `null`
  // aquí; aflojarlos sería relajar validación de entrada sin necesidad.
  concMenoresAlimentos: z.array(concMenorSchema).optional().nullable(),
  concMenoresUnion: z.array(concMenorUnionSchema).optional().nullable(),
  concClausulasAdicionalesAlimentos: z
    .array(concClausulaAdicionalSchema)
    .optional()
    .nullable(),
  concClausulasAdicionalesUnion: z
    .array(concClausulaAdicionalSchema)
    .optional()
    .nullable(),
  concClausulasAdicionalesDisolucion: z
    .array(concClausulaAdicionalSchema)
    .optional()
    .nullable(),
  concClausulasAcuerdo: z.array(concClausulaSchema).optional().nullable(),

  // ============================================================
  // ACUERDO DE APOYO - Campos específicos del servicio
  // ============================================================
  apoyoAsunto: z.string().optional().nullable(),
  apoyoDescripcionHechos: z.string().optional().nullable(),
  apoyoPretensiones: z.string().optional().nullable(),
  apoyoMontoMensual: z.string().optional().nullable(),
  apoyoPlazoMeses: z.string().optional().nullable(),
  apoyoCondiciones: z.string().optional().nullable(),
  apoyoTipoApoyo: z.string().optional().nullable(),
  // Beneficiario
  apoyoBeneficiarioName: z.string().optional().nullable(),
  apoyoBeneficiarioTipoId: z.string().optional().nullable(),
  apoyoBeneficiarioId: z.string().optional().nullable(),
  apoyoBeneficiarioDireccion: z.string().optional().nullable(),
  apoyoBeneficiarioCiudad: z.string().optional().nullable(),
  apoyoBeneficiarioCorreo: z.string().optional().nullable(),
  apoyoBeneficiarioCel: z.string().optional().nullable(),
  // Prestador
  apoyoPrestadorName: z.string().optional().nullable(),
  apoyoPrestadorTipoId: z.string().optional().nullable(),
  apoyoPrestadorId: z.string().optional().nullable(),
  apoyoPrestadorDireccion: z.string().optional().nullable(),
  apoyoPrestadorCiudad: z.string().optional().nullable(),
  apoyoPrestadorCorreo: z.string().optional().nullable(),
  apoyoPrestadorCel: z.string().optional().nullable(),
  apoyoPrestadorRelacion: z.string().optional().nullable(),
  // Conciliadora
  apoyoConciliadoraName: z.string().optional().nullable(),
  apoyoConciliadoraCC: z.string().optional().nullable(),
  apoyoConciliadoraTP: z.string().optional().nullable(),
  // Acuerdo y resultado
  apoyoAcuerdo: z.string().optional().nullable(),
  apoyoResultado: z.string().optional().nullable(),
  apoyoCausaTerminacion: z.string().optional().nullable(),
  // Mismo caso que los 6 arrays de conciliación de arriba: `Json?` en Prisma
  // devuelve `null`, y `.optional()` solo acepta `undefined`. Se quedó fuera de
  // a54d92e porque aquel fix se buscó por el prefijo `conc*`; este campo es del
  // bloque ACUERDO DE APOYO y está en NULL en todo caso que no sea
  // SUPPORT_AGREEMENT — es decir, en los 28 casos de producción.
  apoyoClausulas: z.array(concClausulaSchema).optional().nullable(),

  // Desglose interno de servicios de manutención. No va a los documentos.
  serviciosManutencion: z
    .array(servicioManutencionSchema)
    .optional()
    .nullable(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IX: Propuesta Inicial de Pago
  // ============================================================
  propuestaPlazoMeses: z.coerce.number().optional().nullable(),
  propuestaPeriodicidadPago: z.string().optional().nullable(),
  propuestaTasaInteres: decimalToNumber.optional().nullable(),
  propuestaQuitaPromedio: decimalToNumber.optional().nullable(),
  propuestaFechaInicioPago: z.coerce.date().optional().nullable(),
  propuestaObservaciones: z.string().optional().nullable(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección X: Documentos Anexos
  // ============================================================
  anexaSoporteIngresos: z.boolean().optional(),
  anexaExtractosBancarios: z.boolean().optional(),
  anexaCertificadosDeuda: z.boolean().optional(),
  anexaCertificadoTradicion: z.boolean().optional(),
  anexaRelacionProcesos: z.boolean().optional(),
  anexaDeclaracionRenta: z.boolean().optional(),
  anexaDocumentoIdentidad: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XI: Información del Apoderado
  // ============================================================
  apoderadoNombreCompleto: z.string().optional().nullable(),
  apoderadoTipoIdentificacion: z.string().optional().nullable(),
  apoderadoIdentificacion: z.string().optional().nullable(),
  apoderadoTarjetaProfesional: z.string().optional().nullable(),
  apoderadoDireccion: z.string().optional().nullable(),
  apoderadoTelefono: z.string().optional().nullable(),
  apoderadoCorreo: z.string().optional().nullable(),
  existePoderOtorgado: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XII: Datos Radicación Interna
  // ============================================================
  expedienteNumero: z.string().optional().nullable(),
  expedienteAnio: z.coerce.number().optional().nullable(),
  fechaRadicacion: z.coerce.date().optional().nullable(),
  centroConciliacionNombre: z.string().optional().nullable(),
  conciliadorAsignado: z.string().optional().nullable(),
  ciudadRadicacion: z.string().optional().nullable(),

  // Post-Acuerdo - Fechas y datos de resultado
  paymentStartDate: z.coerce.date().optional().nullable(),
  agreementValidityDate: z.coerce.date().optional().nullable(),
  approvalPercentage: decimalToNumber.optional().nullable(),

  // Fracaso - Datos específicos
  failureDate: z.coerce.date().optional().nullable(),
  failureType: z.string().optional().nullable(),

  // Acuerdo Bilateral
  isBilateral: z.boolean().optional(),
  bilateralAgreementNumber: z.string().optional().nullable(),
  bilateralCreditorId: z.string().optional().nullable(),

  debtor: debtorForCaseSchema,
  operator: operatorForCaseSchema,
  _count: z.object({
    documents: z.coerce.number(),
  }),
});

export type Case = z.infer<typeof caseSchema>;

export const caseWithRelationsSchema = caseSchema.extend({
  documents: z.array(documentForCaseSchema),
  debts: z.array(debtForCaseSchema),
  assets: z.array(assetForCaseSchema),
  libranzas: z.array(libranzaForCaseSchema).optional(),
  suspendedServices: z.array(suspendedServiceForCaseSchema).optional(),
  dependents: z.array(dependentForCaseSchema).optional(),
  legalProcesses: z.array(legalProcessForCaseSchema).optional(),
  // Formulario definitivo
  acreedores: z.array(acreedorForCaseSchema).optional(),
  bienes: z.array(bienForCaseSchema).optional(),
  procesosJudiciales: z.array(procesoJudicialForCaseSchema).optional(),
  apoderados: z.array(apoderadoForCaseSchema).optional(),
});

export type CaseWithRelations = z.infer<typeof caseWithRelationsSchema>;

export const caseSummarySchema = caseSchema.omit({
  debtor: true,
  operator: true,
  _count: true,
});

export type CaseSummary = z.infer<typeof caseSummarySchema>;

/**
 * Columnas escalares de Case que necesita el LISTADO de casos (getAllCases).
 *
 * Única fuente de verdad: el `select` de Prisma (features/case/actions.ts) y el
 * schema de validación (`caseListItemSchema`) se derivan de esta máscara, así
 * que no pueden desalinearse.
 *
 * Antes el listado traía las 269 columnas de cada caso y las validaba todas con
 * `caseSchema`: una columna ausente o un null inesperado en cualquiera de ellas
 * invalidaba el listado ENTERO (así se cayó /cases con las columnas `apoyo_*`).
 * Ahora solo depende de lo que las pantallas del listado leen. Si un componente
 * necesita otro campo, se agrega aquí; `CaseListItem` hace que tsc lo avise.
 */
export const CASE_LIST_COLUMNS = {
  id: true,
  caseNumber: true,
  debtorName: true,
  type: true,
  totalDebt: true,
  creditors: true,
  version: true,
  createdDate: true,
  hearingDate: true,
  phase: true,
  debtorId: true,
  operatorId: true,
  driveFolderId: true,
  causes: true,
} as const;

export const caseListItemSchema = caseSchema.pick({
  ...CASE_LIST_COLUMNS,
  debtor: true,
  operator: true,
  _count: true,
});

export type CaseListItem = z.infer<typeof caseListItemSchema>;
export const createCaseSchema = z.object({
  debtorId: z.string().min(1, 'El deudor es requerido'),
  type: z.enum(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'], {
    message: 'Tipo de caso inválido',
  }),
  totalDebt: z.union([
    z.number().min(0, 'La deuda total debe ser mayor a 0'),
    z
      .string()
      .min(1, 'La deuda total es requerida')
      .transform((val) => parseFloat(val.replace(/[^0-9.-]/g, ''))),
  ]),
  creditors: z.union([
    z.number().min(0, 'El número de acreedores debe ser mayor o igual a 0'),
    z.string().transform((val) => parseInt(val) || 0),
  ]),
  hearingDate: z.string().optional().nullable(),
  phase: casePhaseEnum.optional(),
  operatorId: z.string().min(1, 'El operador es requerido'),
  caseNumber: z.string().optional(),
  causes: z.array(z.string()).default([]),
  otherCauseDetail: z.string().optional(),

  tramite: z.string().optional(),
  filingDate: z.string().optional(),
  debtorIdNumber: z.string().optional(),
  convened: z.string().optional(),
  attorney: z.string().optional(),
  owedCapital: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  designatedOperator: z.string().optional(),
  designationDate: z.string().optional(),
  positionAcceptanceDate: z.string().optional(),
  inadmissionDate: z.string().optional(),
  admissionDate: z.string().optional(),
  firstHearingDate: z.string().optional(),
  firstHearingTime: z.string().optional(),
  hasLegalProcesses: z.boolean().default(false),
  courtNumber: z.string().optional(),
  city: z.string().optional(),
  processType: z.string().optional(),
  plaintiff: z.string().optional(),
  judicialFileNumber: z.string().optional(),
  suspensionDate: z.string().optional(),
  resultDeliveryDate: z.string().optional(),
  resultType: z.string().optional(),
  resultDate: z.string().optional(),
  siccacNumber: z.string().optional(),
  riskCenterCommunication: z.boolean().default(false),

  // Ámbito de Aplicación
  applicantScope: z.array(z.string()).default([]),

  // Ingresos y Gastos
  monthlyIncome: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  monthlyExpenses: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otherIncomeDescription: z.string().optional(),
  otherIncomeAmount: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  hasEmployerCertification: z.boolean().default(false),

  // Propuesta de Pago
  gracePeriodRequested: z.boolean().default(false),
  gracePeriodMonths: z.number().optional(),
  paymentInKind: z.boolean().default(false),
  paymentInKindDescription: z.string().optional(),
  assetSaleAuthorized: z.boolean().default(false),
  assetSaleDescription: z.string().optional(),
  cashFlowPayment: z.boolean().default(false),
  paymentTermMonths: z.number().optional(),
  monthlyPaymentAmount: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  variablePayment: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  extraordinaryPayment: z.boolean().default(false),
  extraordinaryPaymentDate: z.string().optional(),
  capitalReduction: z.boolean().default(false),
  capitalReductionPercent: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  insuranceOffering: z.string().optional(),
  forgiveAccruedInterest: z.boolean().default(false),
  forgiveFutureInterest: z.boolean().default(false),
  paymentOrder: z
    .object({
      primera: z.string().optional().nullable(),
      segunda: z.string().optional().nullable(),
      tercera: z.string().optional().nullable(),
      cuarta: z.string().optional().nullable(),
      quinta: z.string().optional().nullable(),
    })
    .optional()
    .catch({}),
  hasClassPrivileges: z.boolean().default(false),
  classPrivilegesDescription: z.string().optional(),
  thirdPartyPaymentAuth: z.boolean().default(false),
  guaranteeSubstitution: z.boolean().default(false),

  // Sociedad Conyugal
  spouseName: z.string().optional(),
  spouseIdNumber: z.string().optional(),
  spouseAddress: z.string().optional(),
  spousePhone: z.string().optional(),
  spouseEmail: z.string().optional(),

  // Tarifa y Fundamentos
  requestedFee: z.string().optional(),
  legalFoundations: z.string().optional(),

  // Notificaciones
  notificationAddress: z.string().optional(),
  notificationCity: z.string().optional(),
  notificationPhone: z.string().optional(),
  notificationEmail: z.string().optional(),

  // Firma
  applicantSignatureName: z.string().optional(),
  applicantSignatureId: z.string().optional(),
  applicantSignature: z.string().optional(),

  // Zoom Meeting Info
  zoomMeetingId: z.string().optional(),
  zoomPassword: z.string().optional(),
  zoomLink: z.string().optional(),

  // Post-Acuerdo - Fechas y datos de resultado
  paymentStartDate: z.string().optional(),
  agreementValidityDate: z.string().optional(),
  approvalPercentage: z
    .union([
      z.number().min(0).max(100).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),

  // Fracaso - Datos específicos
  failureDate: z.string().optional(),
  failureType: z.string().optional(),

  // Acuerdo Bilateral
  isBilateral: z.boolean().optional(),
  bilateralAgreementNumber: z.string().optional(),
  bilateralCreditorId: z.string().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección II: Cónyuge
  // ============================================================
  conyugeTipoIdentificacion: z.string().optional(),
  conyugeIdentificacion: z.string().optional(),
  conyugePrimerNombre: z.string().optional(),
  conyugeSegundoNombre: z.string().optional(),
  conyugePrimerApellido: z.string().optional(),
  conyugeSegundoApellido: z.string().optional(),
  conyugeNombreCompleto: z.string().optional(),
  conyugeTelefono: z.string().optional(),
  conyugeCorreo: z.string().optional(),
  sociedadConyugalDisuelta: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección III: Información Laboral y Económica
  // ============================================================
  deudorOcupacion: z.string().optional(),
  deudorProfesion: z.string().optional(),
  deudorActividadEconomica: z.string().optional(),
  deudorTipoVinculacion: z.string().optional(),
  deudorNombreEmpleador: z.string().optional(),
  deudorNitEmpleador: z.string().optional(),
  ingresoPrincipalMensual: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otrosIngresosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  totalIngresosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  ingresosVariablesPromedio: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  ingresosNoOperacionales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosVivienda: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosAlimentacion: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  // Desglose interno de servicios de manutencion (gas, agua, luz y "+ Otros").
  // Solo lo ve el operador: no se lleva a los documentos generados.
  serviciosManutencion: z.array(servicioManutencionSchema).optional(),
  gastosServiciosPublicos: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosTransporte: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosEducacion: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosSalud: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otrosGastos: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  totalGastosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  capacidadPagoEstimada: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  patrimonioTotalEstimado: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  pasivoTotalEstimado: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IV: Declaración de Cesación de Pagos
  // ============================================================
  cesacionPagos: z.boolean().optional(),
  fechaCesacionPagos: z.string().optional(),
  numeroAcreedoresActual: z.number().optional(),
  porcentajePasivoEnMora: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  obligacionesEnMora90Dias: z.boolean().optional(),
  procesosEjecutivosVigentes: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección VIII: Declaraciones del Deudor
  // ============================================================
  declaracionVeracidadInformacion: z.boolean().optional(),
  manifestacionBuenaFe: z.boolean().optional(),
  manifestacionNoOcultamientoBienes: z.boolean().optional(),
  autorizacionNotificacionesCorreo: z.boolean().optional(),
  autorizacionConsultaCentralesRiesgo: z.boolean().optional(),
  autorizacionTratamientoDatos: z.boolean().optional(),
  declaracionNoOmisiones: z.boolean().optional(),
  declaracionConocimientoNorma: z.boolean().optional(),

  // ============================================================
  // CONCILIACIÓN - Campos específicos del servicio de conciliación
  // ============================================================
  concAsunto: z.string().optional().nullable(),
  concDescripcionHechos: z.string().optional().nullable(),
  concPretensiones: z.string().optional().nullable(),
  concCuantiaPesos: z.string().optional().nullable(),
  concCuantiaLetras: z.string().optional().nullable(),
  concRelacionPruebas: z.string().optional().nullable(),
  concOtroMedioComunicacion: z.string().optional().nullable(),
  concFechaNacimiento: z.string().optional().nullable(),
  // Convocante (solicitante)
  concConvocanteName: z.string().optional().nullable(),
  concConvocanteTipoId: z.string().optional().nullable(),
  concConvocanteId: z.string().optional().nullable(),
  concConvocanteDireccion: z.string().optional().nullable(),
  concConvocanteCiudad: z.string().optional().nullable(),
  concConvocanteCorreo: z.string().optional().nullable(),
  concConvocanteCel: z.string().optional().nullable(),
  // Convocado (contraparte)
  concConvocadoName: z.string().optional().nullable(),
  concConvocadoTipoId: z.string().optional().nullable(),
  concConvocadoId: z.string().optional().nullable(),
  concConvocadoDireccion: z.string().optional().nullable(),
  concConvocadoCiudad: z.string().optional().nullable(),
  concConvocadoCorreo: z.string().optional().nullable(),
  concConvocadoCel: z.string().optional().nullable(),
  // Representante legal (opcional)
  concRepLegalName: z.string().optional().nullable(),
  concRepLegalTipoId: z.string().optional().nullable(),
  concRepLegalId: z.string().optional().nullable(),
  concRepLegalDireccion: z.string().optional().nullable(),
  concRepLegalCiudad: z.string().optional().nullable(),
  concRepLegalCorreo: z.string().optional().nullable(),
  concRepLegalCel: z.string().optional().nullable(),
  // Apoderado convocante
  concApoderadoConvocanteName: z.string().optional().nullable(),
  concApoderadoConvocanteTipoId: z.string().optional().nullable(),
  concApoderadoConvocanteId: z.string().optional().nullable(),
  concApoderadoConvocanteDireccion: z.string().optional().nullable(),
  concApoderadoConvocanteCiudad: z.string().optional().nullable(),
  concApoderadoConvocanteCorreo: z.string().optional().nullable(),
  concApoderadoConvocanteCel: z.string().optional().nullable(),
  concApoderadoConvocanteTP: z.string().optional().nullable(),
  // Apoderado convocado
  concApoderadoConvocadoName: z.string().optional().nullable(),
  concApoderadoConvocadoTipoId: z.string().optional().nullable(),
  concApoderadoConvocadoId: z.string().optional().nullable(),
  concApoderadoConvocadoCorreo: z.string().optional().nullable(),
  concApoderadoConvocadoCel: z.string().optional().nullable(),
  concApoderadoConvocadoTP: z.string().optional().nullable(),
  // Conciliadora
  concConciliadoraName: z.string().optional().nullable(),
  concConciliadoraCC: z.string().optional().nullable(),
  concConciliadoraTP: z.string().optional().nullable(),
  // Acuerdo/Acta
  concAcuerdoConciliatorio: z.string().optional().nullable(),
  concInfoAdicional: z.string().optional().nullable(),
  // Alimentos
  concClausulaPrimeroAlimentos: z.string().optional().nullable(),
  concClausulaSegundoAlimentos: z.string().optional().nullable(),
  concClausulaTerceroAlimentos: z.string().optional().nullable(),
  concNombreMenor: z.string().optional().nullable(),
  concNumeroClausula: z.string().optional().nullable(),
  concTextoClausula: z.string().optional().nullable(),
  concNumeroClausulaAdicional: z.string().optional().nullable(),
  concTextoClausulaAdicional: z.string().optional().nullable(),
  // Union marital
  concSituacionBienes: z.string().optional().nullable(),
  concSituacionAlimentos: z.string().optional().nullable(),
  // Informe/Terminacion
  concDescripcionResultado: z.string().optional().nullable(),
  concTipoConstanciaSolicitada: z.string().optional().nullable(),
  concDescripcionCausaAnormal: z.string().optional().nullable(),
  concHoraProgramada: z.string().optional().nullable(),
  // Causa / resultado (mutual-exclusive enum-like)
  concCausaTerminacion: z.string().optional().nullable(),
  concResultadoInforme: z.string().optional().nullable(),
  // Repeatable arrays (stored as Json in Prisma)
  concMenoresAlimentos: z.array(concMenorSchema).optional(),
  concMenoresUnion: z.array(concMenorUnionSchema).optional(),
  concClausulasAdicionalesAlimentos: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAdicionalesUnion: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAdicionalesDisolucion: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAcuerdo: z.array(concClausulaSchema).optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IX: Propuesta Inicial de Pago
  // ============================================================
  propuestaPlazoMeses: z.number().optional(),
  propuestaPeriodicidadPago: z.string().optional(),
  propuestaTasaInteres: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  propuestaQuitaPromedio: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  propuestaFechaInicioPago: z.string().optional(),
  propuestaObservaciones: z.string().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección X: Documentos Anexos
  // ============================================================
  anexaSoporteIngresos: z.boolean().optional(),
  anexaExtractosBancarios: z.boolean().optional(),
  anexaCertificadosDeuda: z.boolean().optional(),
  anexaCertificadoTradicion: z.boolean().optional(),
  anexaRelacionProcesos: z.boolean().optional(),
  anexaDeclaracionRenta: z.boolean().optional(),
  anexaDocumentoIdentidad: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XI: Información del Apoderado
  // ============================================================
  apoderadoNombreCompleto: z.string().optional(),
  apoderadoTipoIdentificacion: z.string().optional(),
  apoderadoIdentificacion: z.string().optional(),
  apoderadoTarjetaProfesional: z.string().optional(),
  apoderadoDireccion: z.string().optional(),
  apoderadoTelefono: z.string().optional(),
  apoderadoCorreo: z.string().optional(),
  existePoderOtorgado: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XII: Datos Radicación Interna
  // ============================================================
  expedienteNumero: z.string().optional(),
  expedienteAnio: z.number().optional(),
  fechaRadicacion: z.string().optional(),
  centroConciliacionNombre: z.string().optional(),
  conciliadorAsignado: z.string().optional(),
  ciudadRadicacion: z.string().optional(),
});

export type CreateCaseData = z.infer<typeof createCaseSchema>;
export const updateCaseSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
  version: z.number().int().optional(), // Optimistic locking — if supplied, must match DB version
  debtorId: z.string().min(1, 'El deudor es requerido').optional(),
  type: z
    .enum(['INSOLVENCY', 'CONCILIATION', 'SUPPORT_AGREEMENT'], {
      message: 'Tipo de caso inválido',
    })
    .optional(),
  totalDebt: z
    .union([
      z.number().min(0, 'La deuda total debe ser mayor a 0'),
      z
        .string()
        .min(1, 'La deuda total es requerida')
        .transform((val) => parseFloat(val.replace(/[^0-9.-]/g, ''))),
    ])
    .optional(),
  creditors: z
    .union([
      z.number().min(1, 'Debe haber al menos un acreedor'),
      z.string().transform((val) => parseInt(val) || 0),
    ])
    .optional(),
  hearingDate: z.string().optional().nullable(),
  // Deliberadamente `z.string()` y no el enum: un expediente legacy puede
  // tener persistida una fase que ya no es válida, y el formulario de edición
  // la reenvía tal cual. `validatePhaseTransition` la acepta como no-op y
  // rechaza cualquier cambio real de fase desde esta mutación (C-1).
  phase: z.string().optional(),
  operatorId: z.string().optional(),
  causes: z.array(z.string()).optional(),
  otherCauseDetail: z.string().optional(),

  tramite: z.string().optional(),
  filingDate: z.string().optional(),
  debtorIdNumber: z.string().optional(),
  convened: z.string().optional(),
  attorney: z.string().optional(),
  owedCapital: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  designatedOperator: z.string().optional(),
  designationDate: z.string().optional(),
  positionAcceptanceDate: z.string().optional(),
  inadmissionDate: z.string().optional(),
  admissionDate: z.string().optional(),
  firstHearingDate: z.string().optional(),
  firstHearingTime: z.string().optional(),
  hasLegalProcesses: z.boolean().optional(),
  courtNumber: z.string().optional(),
  city: z.string().optional(),
  processType: z.string().optional(),
  plaintiff: z.string().optional(),
  judicialFileNumber: z.string().optional(),
  suspensionDate: z.string().optional(),
  resultDeliveryDate: z.string().optional(),
  resultType: z.string().optional(),
  resultDate: z.string().optional(),
  siccacNumber: z.string().optional(),
  riskCenterCommunication: z.boolean().optional(),

  // Ámbito de Aplicación
  applicantScope: z.array(z.string()).optional(),

  // Ingresos y Gastos
  monthlyIncome: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  monthlyExpenses: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otherIncomeDescription: z.string().optional(),
  otherIncomeAmount: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  hasEmployerCertification: z.boolean().optional(),

  // Propuesta de Pago
  gracePeriodRequested: z.boolean().optional(),
  gracePeriodMonths: z.number().optional(),
  paymentInKind: z.boolean().optional(),
  paymentInKindDescription: z.string().optional(),
  assetSaleAuthorized: z.boolean().optional(),
  assetSaleDescription: z.string().optional(),
  cashFlowPayment: z.boolean().optional(),
  paymentTermMonths: z.number().optional(),
  monthlyPaymentAmount: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  variablePayment: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  extraordinaryPayment: z.boolean().optional(),
  extraordinaryPaymentDate: z.string().optional(),
  capitalReduction: z.boolean().optional(),
  capitalReductionPercent: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  insuranceOffering: z.string().optional(),
  forgiveAccruedInterest: z.boolean().optional(),
  forgiveFutureInterest: z.boolean().optional(),
  paymentOrder: z
    .object({
      primera: z.string().optional().nullable(),
      segunda: z.string().optional().nullable(),
      tercera: z.string().optional().nullable(),
      cuarta: z.string().optional().nullable(),
      quinta: z.string().optional().nullable(),
    })
    .optional()
    .catch({}),
  hasClassPrivileges: z.boolean().optional(),
  classPrivilegesDescription: z.string().optional(),
  thirdPartyPaymentAuth: z.boolean().optional(),
  guaranteeSubstitution: z.boolean().optional(),

  // Sociedad Conyugal
  spouseName: z.string().optional(),
  spouseIdNumber: z.string().optional(),
  spouseAddress: z.string().optional(),
  spousePhone: z.string().optional(),
  spouseEmail: z.string().optional(),

  // Tarifa y Fundamentos
  requestedFee: z.string().optional(),
  legalFoundations: z.string().optional(),

  // Notificaciones
  notificationAddress: z.string().optional(),
  notificationCity: z.string().optional(),
  notificationPhone: z.string().optional(),
  notificationEmail: z.string().optional(),

  // Firma
  applicantSignatureName: z.string().optional(),
  applicantSignatureId: z.string().optional(),
  applicantSignature: z.string().optional(),

  // Zoom Meeting Info
  zoomMeetingId: z.string().optional(),
  zoomPassword: z.string().optional(),
  zoomLink: z.string().optional(),

  // Post-Acuerdo - Fechas y datos de resultado
  paymentStartDate: z.string().optional(),
  agreementValidityDate: z.string().optional(),
  approvalPercentage: z
    .union([
      z.number().min(0).max(100).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),

  // Fracaso - Datos específicos
  failureDate: z.string().optional(),
  failureType: z.string().optional(),

  // Acuerdo Bilateral
  isBilateral: z.boolean().optional(),
  bilateralAgreementNumber: z.string().optional(),
  bilateralCreditorId: z.string().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección II: Cónyuge
  // ============================================================
  conyugeTipoIdentificacion: z.string().optional(),
  conyugeIdentificacion: z.string().optional(),
  conyugePrimerNombre: z.string().optional(),
  conyugeSegundoNombre: z.string().optional(),
  conyugePrimerApellido: z.string().optional(),
  conyugeSegundoApellido: z.string().optional(),
  conyugeNombreCompleto: z.string().optional(),
  conyugeTelefono: z.string().optional(),
  conyugeCorreo: z.string().optional(),
  sociedadConyugalDisuelta: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección III: Información Laboral y Económica
  // ============================================================
  deudorOcupacion: z.string().optional(),
  deudorProfesion: z.string().optional(),
  deudorActividadEconomica: z.string().optional(),
  deudorTipoVinculacion: z.string().optional(),
  deudorNombreEmpleador: z.string().optional(),
  deudorNitEmpleador: z.string().optional(),
  ingresoPrincipalMensual: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otrosIngresosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  totalIngresosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  ingresosVariablesPromedio: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  ingresosNoOperacionales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosVivienda: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosAlimentacion: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  // Desglose interno de servicios de manutencion (gas, agua, luz y "+ Otros").
  // Solo lo ve el operador: no se lleva a los documentos generados.
  serviciosManutencion: z.array(servicioManutencionSchema).optional(),
  gastosServiciosPublicos: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosTransporte: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosEducacion: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  gastosSalud: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  otrosGastos: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  totalGastosMensuales: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  capacidadPagoEstimada: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  patrimonioTotalEstimado: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  pasivoTotalEstimado: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IV: Declaración de Cesación de Pagos
  // ============================================================
  cesacionPagos: z.boolean().optional(),
  fechaCesacionPagos: z.string().optional(),
  numeroAcreedoresActual: z.number().optional(),
  porcentajePasivoEnMora: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  obligacionesEnMora90Dias: z.boolean().optional(),
  procesosEjecutivosVigentes: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección VIII: Declaraciones del Deudor
  // ============================================================
  declaracionVeracidadInformacion: z.boolean().optional(),
  manifestacionBuenaFe: z.boolean().optional(),
  manifestacionNoOcultamientoBienes: z.boolean().optional(),
  autorizacionNotificacionesCorreo: z.boolean().optional(),
  autorizacionConsultaCentralesRiesgo: z.boolean().optional(),
  autorizacionTratamientoDatos: z.boolean().optional(),
  declaracionNoOmisiones: z.boolean().optional(),
  declaracionConocimientoNorma: z.boolean().optional(),

  // ============================================================
  // CONCILIACIÓN - Campos específicos del servicio de conciliación
  // ============================================================
  concAsunto: z.string().optional().nullable(),
  concDescripcionHechos: z.string().optional().nullable(),
  concPretensiones: z.string().optional().nullable(),
  concCuantiaPesos: z.string().optional().nullable(),
  concCuantiaLetras: z.string().optional().nullable(),
  concRelacionPruebas: z.string().optional().nullable(),
  concOtroMedioComunicacion: z.string().optional().nullable(),
  concFechaNacimiento: z.string().optional().nullable(),
  // Convocante (solicitante)
  concConvocanteName: z.string().optional().nullable(),
  concConvocanteTipoId: z.string().optional().nullable(),
  concConvocanteId: z.string().optional().nullable(),
  concConvocanteDireccion: z.string().optional().nullable(),
  concConvocanteCiudad: z.string().optional().nullable(),
  concConvocanteCorreo: z.string().optional().nullable(),
  concConvocanteCel: z.string().optional().nullable(),
  // Convocado (contraparte)
  concConvocadoName: z.string().optional().nullable(),
  concConvocadoTipoId: z.string().optional().nullable(),
  concConvocadoId: z.string().optional().nullable(),
  concConvocadoDireccion: z.string().optional().nullable(),
  concConvocadoCiudad: z.string().optional().nullable(),
  concConvocadoCorreo: z.string().optional().nullable(),
  concConvocadoCel: z.string().optional().nullable(),
  // Representante legal (opcional)
  concRepLegalName: z.string().optional().nullable(),
  concRepLegalTipoId: z.string().optional().nullable(),
  concRepLegalId: z.string().optional().nullable(),
  concRepLegalDireccion: z.string().optional().nullable(),
  concRepLegalCiudad: z.string().optional().nullable(),
  concRepLegalCorreo: z.string().optional().nullable(),
  concRepLegalCel: z.string().optional().nullable(),
  // Apoderado convocante
  concApoderadoConvocanteName: z.string().optional().nullable(),
  concApoderadoConvocanteTipoId: z.string().optional().nullable(),
  concApoderadoConvocanteId: z.string().optional().nullable(),
  concApoderadoConvocanteDireccion: z.string().optional().nullable(),
  concApoderadoConvocanteCiudad: z.string().optional().nullable(),
  concApoderadoConvocanteCorreo: z.string().optional().nullable(),
  concApoderadoConvocanteCel: z.string().optional().nullable(),
  concApoderadoConvocanteTP: z.string().optional().nullable(),
  // Apoderado convocado
  concApoderadoConvocadoName: z.string().optional().nullable(),
  concApoderadoConvocadoTipoId: z.string().optional().nullable(),
  concApoderadoConvocadoId: z.string().optional().nullable(),
  concApoderadoConvocadoCorreo: z.string().optional().nullable(),
  concApoderadoConvocadoCel: z.string().optional().nullable(),
  concApoderadoConvocadoTP: z.string().optional().nullable(),
  // Conciliadora
  concConciliadoraName: z.string().optional().nullable(),
  concConciliadoraCC: z.string().optional().nullable(),
  concConciliadoraTP: z.string().optional().nullable(),
  // Acuerdo/Acta
  concAcuerdoConciliatorio: z.string().optional().nullable(),
  concInfoAdicional: z.string().optional().nullable(),
  // Alimentos
  concClausulaPrimeroAlimentos: z.string().optional().nullable(),
  concClausulaSegundoAlimentos: z.string().optional().nullable(),
  concClausulaTerceroAlimentos: z.string().optional().nullable(),
  concNombreMenor: z.string().optional().nullable(),
  concNumeroClausula: z.string().optional().nullable(),
  concTextoClausula: z.string().optional().nullable(),
  concNumeroClausulaAdicional: z.string().optional().nullable(),
  concTextoClausulaAdicional: z.string().optional().nullable(),
  // Union marital
  concSituacionBienes: z.string().optional().nullable(),
  concSituacionAlimentos: z.string().optional().nullable(),
  // Informe/Terminacion
  concDescripcionResultado: z.string().optional().nullable(),
  concTipoConstanciaSolicitada: z.string().optional().nullable(),
  concDescripcionCausaAnormal: z.string().optional().nullable(),
  concHoraProgramada: z.string().optional().nullable(),
  // Causa / resultado (mutual-exclusive enum-like)
  concCausaTerminacion: z.string().optional().nullable(),
  concResultadoInforme: z.string().optional().nullable(),
  // Repeatable arrays (stored as Json in Prisma)
  concMenoresAlimentos: z.array(concMenorSchema).optional(),
  concMenoresUnion: z.array(concMenorUnionSchema).optional(),
  concClausulasAdicionalesAlimentos: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAdicionalesUnion: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAdicionalesDisolucion: z
    .array(concClausulaAdicionalSchema)
    .optional(),
  concClausulasAcuerdo: z.array(concClausulaSchema).optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IX: Propuesta Inicial de Pago
  // ============================================================
  propuestaPlazoMeses: z.number().optional(),
  propuestaPeriodicidadPago: z.string().optional(),
  propuestaTasaInteres: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  propuestaQuitaPromedio: z
    .union([
      z.number().min(0).optional(),
      z
        .string()
        .transform((val) =>
          val ? parseFloat(val.replace(/[^0-9.-]/g, '')) : undefined,
        )
        .optional(),
    ])
    .optional(),
  propuestaFechaInicioPago: z.string().optional(),
  propuestaObservaciones: z.string().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección X: Documentos Anexos
  // ============================================================
  anexaSoporteIngresos: z.boolean().optional(),
  anexaExtractosBancarios: z.boolean().optional(),
  anexaCertificadosDeuda: z.boolean().optional(),
  anexaCertificadoTradicion: z.boolean().optional(),
  anexaRelacionProcesos: z.boolean().optional(),
  anexaDeclaracionRenta: z.boolean().optional(),
  anexaDocumentoIdentidad: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XI: Información del Apoderado
  // ============================================================
  apoderadoNombreCompleto: z.string().optional(),
  apoderadoTipoIdentificacion: z.string().optional(),
  apoderadoIdentificacion: z.string().optional(),
  apoderadoTarjetaProfesional: z.string().optional(),
  apoderadoDireccion: z.string().optional(),
  apoderadoTelefono: z.string().optional(),
  apoderadoCorreo: z.string().optional(),
  existePoderOtorgado: z.boolean().optional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección XII: Datos Radicación Interna
  // ============================================================
  expedienteNumero: z.string().optional(),
  expedienteAnio: z.number().optional(),
  fechaRadicacion: z.string().optional(),
  centroConciliacionNombre: z.string().optional(),
  conciliadorAsignado: z.string().optional(),
  ciudadRadicacion: z.string().optional(),
});

export type UpdateCaseData = z.infer<typeof updateCaseSchema>;
export const addDebtToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  creditorId: z.string().min(1, 'El ID del acreedor es requerido'),
  amount: z.string().min(1, 'El monto es requerido'),
  type: z.string().min(1, 'El tipo de deuda es requerido'),
  interestRate: z.string().min(1, 'La tasa de interés es requerida'),
});

export type AddDebtToCaseData = z.infer<typeof addDebtToCaseSchema>;
export const debtResponseSchema = z.object({
  id: z.string(),
  amount: decimalToNumber,
  interestRate: decimalToNumber,
  type: z.string(),
  creditor: z.string(),
  creditorId: z.string(),
});
export const removeDebtFromCaseSchema = z.object({
  debtId: z.string().min(1, 'El ID de la deuda es requerido'),
});

export type RemoveDebtFromCaseData = z.infer<typeof removeDebtFromCaseSchema>;

// Libranza schemas
export const addLibranzaToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  payerName: z.string().min(1, 'El nombre del pagador es requerido'),
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  payerPhone: z.string().optional(),
  deductedAmount: z.string().min(1, 'La suma descontada es requerida'),
  productAndCreditor: z.string().optional(),
});

export type AddLibranzaToCaseData = z.infer<typeof addLibranzaToCaseSchema>;

export const removeLibranzaFromCaseSchema = z.object({
  libranzaId: z.string().min(1, 'El ID de la libranza es requerido'),
});

export type RemoveLibranzaFromCaseData = z.infer<
  typeof removeLibranzaFromCaseSchema
>;

export const libranzaResponseSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerAddress: z.string().nullable(),
  payerEmail: z.string().nullable(),
  payerPhone: z.string().nullable(),
  deductedAmount: z.string(),
  productAndCreditor: z.string().nullable(),
});

// Suspended Service schemas
export const addSuspendedServiceToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  creditorName: z.string().min(1, 'El nombre del acreedor es requerido'),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  amountOwed: z.string().min(1, 'La suma adeudada es requerida'),
  serviceType: z.string().optional(),
});

export type AddSuspendedServiceToCaseData = z.infer<
  typeof addSuspendedServiceToCaseSchema
>;

export const removeSuspendedServiceFromCaseSchema = z.object({
  suspendedServiceId: z.string().min(1, 'El ID del servicio es requerido'),
});

export type RemoveSuspendedServiceFromCaseData = z.infer<
  typeof removeSuspendedServiceFromCaseSchema
>;

export const suspendedServiceResponseSchema = z.object({
  id: z.string(),
  creditorName: z.string(),
  address: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  amountOwed: z.string(),
  serviceType: z.string().nullable(),
});

// Asset schemas
export const addAssetToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  name: z.string().min(1, 'El nombre del bien es requerido'),
  type: z.string().min(1, 'El tipo de bien es requerido'),
  value: z.string().min(1, 'El valor es requerido'),
  description: z.string().optional(),
  propertyType: z.string().optional(),
  address: z.string().optional(),
  registrationNumber: z.string().optional(),
  encumbrance: z.string().optional(),
  affectation: z.string().optional(),
  precautionaryMeasure: z.string().optional(),
  proofDocument: z.string().optional(),
  isFamilyHome: z.boolean().optional(),
  isInalienablePatrimony: z.boolean().optional(),
  hasPendingFinesOrTaxes: z.boolean().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.string().optional(),
  licensePlate: z.string().optional(),
  transitAuthority: z.string().optional(),
  guaranteeInFavorOf: z.string().optional(),
  guaranteeAmount: z.string().optional(),
  material: z.string().optional(),
});

export type AddAssetToCaseData = z.infer<typeof addAssetToCaseSchema>;

export const removeAssetFromCaseSchema = z.object({
  assetId: z.string().min(1, 'El ID del bien es requerido'),
});

export type RemoveAssetFromCaseData = z.infer<typeof removeAssetFromCaseSchema>;

export const assetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  value: z.string(),
  description: z.string().nullable(),
  propertyType: z.string().nullable(),
  address: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  encumbrance: z.string().nullable(),
  affectation: z.string().nullable(),
  precautionaryMeasure: z.string().nullable(),
  proofDocument: z.string().nullable(),
  isFamilyHome: z.boolean().nullable(),
  isInalienablePatrimony: z.boolean().nullable(),
  hasPendingFinesOrTaxes: z.boolean().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  condition: z.string().nullable(),
  licensePlate: z.string().nullable(),
  transitAuthority: z.string().nullable(),
  guaranteeInFavorOf: z.string().nullable(),
  guaranteeAmount: z.string().nullable(),
  material: z.string().nullable(),
});

// Dependent schemas
export const addDependentToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  age: z.string().min(1, 'La edad es requerida'),
  relationship: z.string().min(1, 'El parentesco es requerido'),
});

export type AddDependentToCaseData = z.infer<typeof addDependentToCaseSchema>;

export const removeDependentFromCaseSchema = z.object({
  dependentId: z.string().min(1, 'El ID del dependiente es requerido'),
});

export type RemoveDependentFromCaseData = z.infer<
  typeof removeDependentFromCaseSchema
>;

export const dependentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.string(),
  relationship: z.string(),
});

export const caseStatsSchema = z.object({
  total: z.coerce.number(),
  byType: z.array(
    z.object({
      type: z.string(),
      _count: z.object({
        id: z.coerce.number(),
      }),
    }),
  ),
  averageDebt: z.coerce.number(),
  totalDebt: decimalToNumber.nullable(),
  totalCreditors: z.coerce.number().nullable(),
});

export type CaseStats = z.infer<typeof caseStatsSchema>;

// ---------------------------------------------------------------------------
// Dashboard Stats Schema
// ---------------------------------------------------------------------------

export const dashboardStatsSchema = z.object({
  totalCases: z.coerce.number(),
  casesThisMonth: z.coerce.number(),
  upcomingHearings: z.coerce.number(),
  totalDebt: decimalToNumber.nullable(),
  totalCreditors: z.coerce.number().nullable(),
  casesByPhase: z.array(
    z.object({
      phase: z.string(),
      count: z.coerce.number(),
    }),
  ),
  casesByType: z.array(
    z.object({
      type: z.string(),
      count: z.coerce.number(),
    }),
  ),
  casesOverTime: z.array(
    z.object({
      month: z.string(),
      count: z.coerce.number(),
    }),
  ),
  overduePayments: z.coerce.number().default(0),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const creditorOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nit: z.string(),
  type: z.string(),
});

export const documentDataSchema = z.object({
  name: z.string(),
  type: z.string(),
  caseId: z.string(),
  debtorName: z.string(),
  size: z.string(),
  format: z.string(),
  additionalInfo: z.string(),
  hearingDate: z.string(),
  hearingTime: z.string(),
  zoomId: z.string(),
  zoomPassword: z.string(),
  paymentTerms: z.string(),
  monthlyAmount: z.string(),
});

export const documentTemplateSchema = z.object({
  id: z.string(),
  fileName: z.string(),
});

export const newDebtorFormSchema = z.object({
  name: z.string(),
  idNumber: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  department: z.string(),
  monthlyIncome: z.number(),
  monthlyExpenses: z.number(),
});
export type DebtData = z.infer<typeof debtSchema>;
export type AssetData = z.infer<typeof assetSchema>;
export type FormDebt = z.infer<typeof debtSchema>;
export type DebtorOption = Pick<
  z.infer<typeof debtorForCaseSchema>,
  | 'id'
  | 'name'
  | 'idNumber'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'department'
  | 'monthlyIncome'
  | 'monthlyExpenses'
>;
export type CreditorOption = z.infer<typeof creditorOptionSchema>;
export type NewDebtForm = Pick<
  FormDebt,
  'creditor' | 'amount' | 'type' | 'interestRate'
> & {
  creditorId: string | undefined;
};
export type NewDebtorForm = z.infer<typeof newDebtorFormSchema>;
export type DocumentData = z.infer<typeof documentDataSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type CaseFormSubmissionData = z.infer<typeof createCaseSchema>;
export type EditCaseFormSubmissionData = z.infer<typeof updateCaseSchema>;
export const CaseType = {
  INSOLVENCY: 'INSOLVENCY',
  CONCILIATION: 'CONCILIATION',
  SUPPORT_AGREEMENT: 'SUPPORT_AGREEMENT',
} as const;

export type CaseTypeEnum = (typeof CaseType)[keyof typeof CaseType];
export const getAllCasesSchema = z.array(caseListItemSchema);
export const getCaseByIdSchema = z.string();
export const deleteCaseSchema = z.object({ id: z.string() });

// Apoderado (attorney) form schema for dynamic array
const apoderadoFormSchema = z.object({
  nombreCompleto: z
    .string()
    .trim()
    .min(1, 'El nombre completo del apoderado es requerido'),
  tipoIdentificacion: z.string().optional(),
  identificacion: z.string().optional(),
  tarjetaProfesional: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().optional(),
  existePoderOtorgado: z.boolean().optional(),
});

export type ApoderadoFormData = z.infer<typeof apoderadoFormSchema>;

export const createCaseFormSchema = createCaseSchema.extend({
  debts: z.array(debtSchema).default([]).optional(),
  assets: z.array(assetSchema).default([]).optional(),
  libranzas: z.array(libranzaSchema).default([]).optional(),
  suspendedServices: z.array(suspendedServiceSchema).default([]).optional(),
  dependents: z.array(dependentSchema).default([]).optional(),
  legalProcesses: z.array(legalProcessSchema).default([]).optional(),
  // Formulario definitivo
  acreedores: z.array(acreedorFormSchema).default([]).optional(),
  bienes: z.array(bienFormSchema).default([]).optional(),
  procesosJudiciales: z.array(procesoJudicialFormSchema).default([]).optional(),
  apoderados: z.array(apoderadoFormSchema).default([]).optional(),
});

export const updateCaseFormSchema = updateCaseSchema.extend({
  debts: z.array(debtSchema).default([]).optional(),
  assets: z.array(assetSchema).default([]).optional(),
  libranzas: z.array(libranzaSchema).default([]).optional(),
  suspendedServices: z.array(suspendedServiceSchema).default([]).optional(),
  dependents: z.array(dependentSchema).default([]).optional(),
  legalProcesses: z.array(legalProcessSchema).default([]).optional(),
  // Formulario definitivo
  acreedores: z.array(acreedorFormSchema).default([]).optional(),
  bienes: z.array(bienFormSchema).default([]).optional(),
  procesosJudiciales: z.array(procesoJudicialFormSchema).default([]).optional(),
  apoderados: z.array(apoderadoFormSchema).default([]).optional(),
});

export type CreateCaseFormData = z.infer<typeof createCaseFormSchema>;
export type UpdateCaseFormData = z.infer<typeof updateCaseFormSchema>;
// Form input types (before Zod transformations - what useForm actually uses)
export type CreateCaseFormInput = z.input<typeof createCaseFormSchema>;
export type UpdateCaseFormInput = z.input<typeof updateCaseFormSchema>;
export type LibranzaData = z.infer<typeof libranzaSchema>;
export type SuspendedServiceData = z.infer<typeof suspendedServiceSchema>;
export type DependentData = z.infer<typeof dependentSchema>;
export type LegalProcessData = z.infer<typeof legalProcessSchema>;
