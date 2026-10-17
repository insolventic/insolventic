import { z } from 'zod';

import { CASE_PHASE_VALUES } from '@/lib/case-phases';
import { requiresOtherDetail } from '@/features/case/proceso-judicial-tipos';
import { parsearMonto } from './monto';

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

/**
 * Un monto de dinero escrito en el formulario.
 *
 * REEMPLAZA 54 COPIAS de esta unión, que tenía un bug alcanzable desde la UI:
 *
 *     z.union([
 *       z.number().min(0).optional(),
 *       z.string().transform((v) =>
 *         v ? parseFloat(v.replace(/[^0-9.-]/g, '')) : undefined).optional(),
 *     ]).optional()
 *
 * Dos problemas, los dos arreglados acá:
 *
 *  1. **El strip conservaba el punto**, así que `"1.500.000"` daba `1.5`. Con
 *     separador de miles en la UI eso dejaba de ser teórico. El parseo vive
 *     ahora en `parsearMonto` (ver su docblock para la regla punto/coma).
 *  2. **El `.min(0)` solo valía para la rama numérica.** Como 23 de los 26
 *     campos de dinero llegan como string, en la práctica no tenían mínimo
 *     ninguno: un `-500` entraba sin chistar. Y la salida del `.transform()`
 *     no se re-validaba, así que un `NaN` también pasaba. Acá se valida
 *     **después** de parsear, con `pipe`, así que el mínimo y el rechazo de
 *     `NaN` aplican a los 26 por igual.
 *
 * `montoOpcional()` para los campos que pueden quedar vacíos; `montoRequerido`
 * para los que no.
 */
const entradaDeMonto = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.undefined(),
]);

export const montoOpcional = () =>
  entradaDeMonto.transform(parsearMonto).pipe(z.number().min(0).optional());

export const montoRequerido = (mensaje: string) =>
  entradaDeMonto
    .transform(parsearMonto)
    .pipe(z.number({ message: mensaje }).min(0, mensaje));

// ---------------------------------------------------------------------------
// Fechas HISTÓRICAS del formulario de conciliación (C-1a, auditoría 2026-10-12)
// ---------------------------------------------------------------------------

const FECHA_SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si año/mes/día forman una fecha de calendario real (rechaza "31 de febrero"). */
function esFechaDeCalendarioValida(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * `"YYYY-MM-DD"` de "hoy" en hora de **Colombia**, sin importar en qué zona
 * corra el servidor — comparar instantes crudos haría que un servidor en UTC
 * rechazara, entre las 19:00 y las 23:59 hora de Colombia, una fecha de hoy
 * mismo por "ser del futuro". `en-CA` produce directamente el formato
 * `YYYY-MM-DD`, que compara bien como texto porque el orden de los campos ya
 * es de mayor a menor.
 */
function hoyEnColombia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Una fecha HISTÓRICA del formulario (`"YYYY-MM-DD"` de un `<input
 * type="date">`): la solicitud, la citación o el desistimiento ya ocurrieron,
 * así que además de ser una fecha real no puede ser del futuro.
 *
 * Por qué no basta con `z.string().optional()` + `parseDateOnly` en el
 * servidor: `parseDateOnly` (`src/lib/date-colombia.ts`) NO valida el
 * calendario — su regex acepta cualquier `\d{4}-\d{2}-\d{2}` y deja que
 * `Date.UTC` resuelva un "2026-02-31" corriéndolo al 3 de marzo, en silencio.
 * Es el comportamiento correcto para *leer* una fecha ya guardada; acá hace
 * falta *rechazar* una fecha imposible en la entrada, antes de guardarla.
 */
export const fechaHistoricaOpcional = (
  mensajeFutura = 'La fecha no puede ser futura',
) =>
  z
    .string()
    .optional()
    .nullable()
    .refine((valor) => {
      if (!valor || !valor.trim()) return true;
      const m = FECHA_SOLO_DIA.exec(valor.trim());
      if (!m) return false;
      const [, y, mo, d] = m;
      return esFechaDeCalendarioValida(Number(y), Number(mo), Number(d));
    }, 'Fecha inválida')
    .refine((valor) => {
      if (!valor || !valor.trim()) return true;
      // Ya se validó el formato arriba; acá solo se compara.
      return valor.trim() <= hoyEnColombia();
    }, mensajeFutura);

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
  // Casillas "Desconozco" del formulario de acreedores. Default por si la
  // consulta viene de un camino que todavia no las pide.
  interestRateUnknown: z.boolean().default(false),
  grantDateUnknown: z.boolean().default(false),
  dueDateUnknown: z.boolean().default(false),
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

  /**
   * Apoderado del acreedor, en DOS FUENTES independientes.
   *
   * No son dos formas de llenar el mismo dato: son dos hechos distintos que
   * pueden contradecirse. El registro es el poder acreditado antes del trámite;
   * el acta es quién compareció de verdad en la audiencia. Cuando las dos
   * existen y la identificación difiere, el PR 3 bloquea la generación en vez
   * de elegir una — decisión legal del 2026-10-09.
   *
   * Todo opcional: la AUSENCIA no bloquea nada, y la mayoría de los acreedores
   * no va a tener apoderado. Ver
   * docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md §4.
   */
  apoderadoRegistroNombre: z.string().optional(),
  apoderadoRegistroTipoId: z.string().optional(),
  apoderadoRegistroId: z.string().optional(),
  apoderadoRegistroTP: z.string().optional(),
  apoderadoRegistroCorreo: z.string().optional(),
  apoderadoRegistroTelefono: z.string().optional(),

  apoderadoActaNombre: z.string().optional(),
  apoderadoActaTipoId: z.string().optional(),
  apoderadoActaId: z.string().optional(),
  apoderadoActaTP: z.string().optional(),
  apoderadoActaCorreo: z.string().optional(),
  apoderadoActaTelefono: z.string().optional(),
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

// Database response schemas for new models
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
  // Fechas reales de solicitud/citación/desistimiento (C-1a) — mismo patrón
  // que `filingDate`: coerción directa, la columna ya es `DateTime?`.
  concFechaSolicitud: z.coerce.date().nullable(),
  concFechaCitacion: z.coerce.date().nullable(),
  concFechaDesistimiento: z.coerce.date().nullable(),
  // Aclaración de Acta y referencias (C-1c)
  concCampoConError: z.string().optional().nullable(),
  concDescripcionError: z.string().optional().nullable(),
  concValorIncorrecto: z.string().optional().nullable(),
  concValorCorrecto: z.string().optional().nullable(),
  concNumeroActaUnionRef: z.string().optional().nullable(),
  concNumeroTramiteUnionRef: z.string().optional().nullable(),
  concTipoSolicitanteDesistimiento: z.string().optional().nullable(),
  concApoderadoDesistimientoName: z.string().optional().nullable(),
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
  totalDebt: montoRequerido('La deuda total es requerida'),
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
  owedCapital: montoOpcional(),
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
  monthlyIncome: montoOpcional(),
  monthlyExpenses: montoOpcional(),
  otherIncomeDescription: z.string().optional(),
  otherIncomeAmount: montoOpcional(),
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
  monthlyPaymentAmount: montoOpcional(),
  variablePayment: montoOpcional(),
  extraordinaryPayment: z.boolean().default(false),
  extraordinaryPaymentDate: z.string().optional(),
  capitalReduction: z.boolean().default(false),
  capitalReductionPercent: montoOpcional(),
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
  // NO usa `montoOpcional`: es un PORCENTAJE, no dinero. Su input sigue siendo
  // `type="number"` y no lleva separador de miles, así que el punto nunca es
  // ambiguo acá — "12.5" es doce y medio por ciento y se lee bien. Además
  // necesita el `.max(100)`, que un monto no tiene.
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
  ingresoPrincipalMensual: montoOpcional(),
  otrosIngresosMensuales: montoOpcional(),
  totalIngresosMensuales: montoOpcional(),
  ingresosVariablesPromedio: montoOpcional(),
  ingresosNoOperacionales: montoOpcional(),
  gastosVivienda: montoOpcional(),
  gastosAlimentacion: montoOpcional(),
  // Desglose interno de servicios de manutencion (gas, agua, luz y "+ Otros").
  // Solo lo ve el operador: no se lleva a los documentos generados.
  serviciosManutencion: z.array(servicioManutencionSchema).optional(),
  gastosServiciosPublicos: montoOpcional(),
  gastosTransporte: montoOpcional(),
  gastosEducacion: montoOpcional(),
  gastosSalud: montoOpcional(),
  otrosGastos: montoOpcional(),
  totalGastosMensuales: montoOpcional(),
  capacidadPagoEstimada: montoOpcional(),
  patrimonioTotalEstimado: montoOpcional(),
  pasivoTotalEstimado: montoOpcional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IV: Declaración de Cesación de Pagos
  // ============================================================
  cesacionPagos: z.boolean().optional(),
  fechaCesacionPagos: z.string().optional(),
  numeroAcreedoresActual: z.number().optional(),
  porcentajePasivoEnMora: montoOpcional(),
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
  // Fechas reales de solicitud/citación/desistimiento (C-1a): texto del
  // <input type="date">, validado por fechaHistoricaOpcional() -- fecha
  // real y no futura. El parseo a Date (parseDateOnly) lo hace la action.
  concFechaSolicitud: fechaHistoricaOpcional(),
  concFechaCitacion: fechaHistoricaOpcional(),
  concFechaDesistimiento: fechaHistoricaOpcional(),
  // Aclaración de Acta y referencias (C-1c)
  concCampoConError: z.string().optional().nullable(),
  concDescripcionError: z.string().optional().nullable(),
  concValorIncorrecto: z.string().optional().nullable(),
  concValorCorrecto: z.string().optional().nullable(),
  concNumeroActaUnionRef: z.string().optional().nullable(),
  concNumeroTramiteUnionRef: z.string().optional().nullable(),
  concTipoSolicitanteDesistimiento: z.string().optional().nullable(),
  concApoderadoDesistimientoName: z.string().optional().nullable(),
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
  propuestaTasaInteres: montoOpcional(),
  propuestaQuitaPromedio: montoOpcional(),
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

  // ============================================================
  // ACUERDO DE APOYO
  // ============================================================
  // Las 29 columnas `apoyo*` estaban en `caseSchema` (lectura) pero NO aca.
  // Como Zod descarta las claves que no declara, los 28 campos que recoge el
  // formulario de Acuerdo de Apoyo se perdian en silencio: nunca llegaban a la
  // base, aunque las columnas, el mapper y las plantillas existieran. Las de
  // conciliacion si estaban; estas se quedaron afuera.
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
  apoyoClausulas: z.array(concClausulaSchema).optional(),
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
  totalDebt: montoOpcional(),
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
  owedCapital: montoOpcional(),
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
  monthlyIncome: montoOpcional(),
  monthlyExpenses: montoOpcional(),
  otherIncomeDescription: z.string().optional(),
  otherIncomeAmount: montoOpcional(),
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
  monthlyPaymentAmount: montoOpcional(),
  variablePayment: montoOpcional(),
  extraordinaryPayment: z.boolean().optional(),
  extraordinaryPaymentDate: z.string().optional(),
  capitalReduction: z.boolean().optional(),
  capitalReductionPercent: montoOpcional(),
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
  // NO usa `montoOpcional`: es un PORCENTAJE, no dinero. Su input sigue siendo
  // `type="number"` y no lleva separador de miles, así que el punto nunca es
  // ambiguo acá — "12.5" es doce y medio por ciento y se lee bien. Además
  // necesita el `.max(100)`, que un monto no tiene.
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
  ingresoPrincipalMensual: montoOpcional(),
  otrosIngresosMensuales: montoOpcional(),
  totalIngresosMensuales: montoOpcional(),
  ingresosVariablesPromedio: montoOpcional(),
  ingresosNoOperacionales: montoOpcional(),
  gastosVivienda: montoOpcional(),
  gastosAlimentacion: montoOpcional(),
  // Desglose interno de servicios de manutencion (gas, agua, luz y "+ Otros").
  // Solo lo ve el operador: no se lleva a los documentos generados.
  serviciosManutencion: z.array(servicioManutencionSchema).optional(),
  gastosServiciosPublicos: montoOpcional(),
  gastosTransporte: montoOpcional(),
  gastosEducacion: montoOpcional(),
  gastosSalud: montoOpcional(),
  otrosGastos: montoOpcional(),
  totalGastosMensuales: montoOpcional(),
  capacidadPagoEstimada: montoOpcional(),
  patrimonioTotalEstimado: montoOpcional(),
  pasivoTotalEstimado: montoOpcional(),

  // ============================================================
  // FORMULARIO DEFINITIVO - Sección IV: Declaración de Cesación de Pagos
  // ============================================================
  cesacionPagos: z.boolean().optional(),
  fechaCesacionPagos: z.string().optional(),
  numeroAcreedoresActual: z.number().optional(),
  porcentajePasivoEnMora: montoOpcional(),
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
  // Fechas reales de solicitud/citación/desistimiento (C-1a): texto del
  // <input type="date">, validado por fechaHistoricaOpcional() -- fecha
  // real y no futura. El parseo a Date (parseDateOnly) lo hace la action.
  concFechaSolicitud: fechaHistoricaOpcional(),
  concFechaCitacion: fechaHistoricaOpcional(),
  concFechaDesistimiento: fechaHistoricaOpcional(),
  // Aclaración de Acta y referencias (C-1c)
  concCampoConError: z.string().optional().nullable(),
  concDescripcionError: z.string().optional().nullable(),
  concValorIncorrecto: z.string().optional().nullable(),
  concValorCorrecto: z.string().optional().nullable(),
  concNumeroActaUnionRef: z.string().optional().nullable(),
  concNumeroTramiteUnionRef: z.string().optional().nullable(),
  concTipoSolicitanteDesistimiento: z.string().optional().nullable(),
  concApoderadoDesistimientoName: z.string().optional().nullable(),
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
  propuestaTasaInteres: montoOpcional(),
  propuestaQuitaPromedio: montoOpcional(),
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

  // ============================================================
  // ACUERDO DE APOYO
  // ============================================================
  // Las 29 columnas `apoyo*` estaban en `caseSchema` (lectura) pero NO aca.
  // Como Zod descarta las claves que no declara, los 28 campos que recoge el
  // formulario de Acuerdo de Apoyo se perdian en silencio: nunca llegaban a la
  // base, aunque las columnas, el mapper y las plantillas existieran. Las de
  // conciliacion si estaban; estas se quedaron afuera.
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
  apoyoClausulas: z.array(concClausulaSchema).optional(),
});

export type UpdateCaseData = z.infer<typeof updateCaseSchema>;
export const addDebtToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  creditorId: z.string().min(1, 'El ID del acreedor es requerido'),
  amount: z.string().min(1, 'El monto es requerido'),
  type: z.string().min(1, 'El tipo de deuda es requerido'),
  interestRate: z.string().min(1, 'La tasa de interés es requerida'),

  // Resto de columnas de Debt (Formulario Definitivo, Sección VI): el
  // `reset()` del diálogo de edición ya las carga desde `fullCase.debts`
  // (edit-case-dialog.tsx) y `debtSchema` (el tipo del formulario) ya las
  // tiene todas; solo faltaban acá, en lo que el alta post-creación valida y
  // envía. Mismo hallazgo que motivó el ítem 3 (apoderados).
  creditorAddress: z.string().optional(),
  creditorCity: z.string().optional(),
  creditorEmail: z.string().optional(),
  capitalAmount: z.string().optional(),
  interestAmount: z.string().optional(),
  isDeferred: z.boolean().optional(),
  documentType: z.string().optional(),
  grantDate: z.string().optional(),
  dueDate: z.string().optional(),
  creditClassification: z.string().optional(),
  hasActiveLibranza: z.boolean().optional(),
  creditorClass: z.string().optional(),
  percentageOfTotal: z.string().optional(),
  daysOverdue: z.number().optional(),

  // Codeudor/Avalista
  coDebtorName: z.string().optional(),
  coDebtorCity: z.string().optional(),
  coDebtorAddress: z.string().optional(),
  coDebtorPhone: z.string().optional(),
  coDebtorEmail: z.string().optional(),
});

export type AddDebtToCaseData = z.infer<typeof addDebtToCaseSchema>;
export const debtResponseSchema = z.object({
  id: z.string(),
  amount: decimalToNumber,
  interestRate: decimalToNumber,
  type: z.string(),
  creditor: z.string(),
  creditorId: z.string(),

  creditorAddress: z.string().nullable(),
  creditorCity: z.string().nullable(),
  creditorEmail: z.string().nullable(),
  capitalAmount: decimalToNumber.nullable(),
  interestAmount: decimalToNumber.nullable(),
  isDeferred: z.boolean(),
  documentType: z.string().nullable(),
  // Fechas como string 'YYYY-MM-DD', no Date: mismo formato que ya usa el
  // reset de edit-case-dialog.tsx (`toISOString().split('T')[0]`), para que
  // la fila que vuelve del server action se pueda meter directo en el
  // formulario sin reconvertir.
  grantDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  creditClassification: z.string().nullable(),
  hasActiveLibranza: z.boolean(),
  creditorClass: z.string().nullable(),
  percentageOfTotal: decimalToNumber.nullable(),
  daysOverdue: z.number().nullable(),

  coDebtorName: z.string().nullable(),
  coDebtorCity: z.string().nullable(),
  coDebtorAddress: z.string().nullable(),
  coDebtorPhone: z.string().nullable(),
  coDebtorEmail: z.string().nullable(),
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

// ---------------------------------------------------------------------------
// Apoderados (Sección XI) — alta/baja post-creación, mismo patrón que
// Debt/Asset/Libranza/SuspendedService/Dependent: sin edición en el lugar,
// corregir un apoderado es borrarlo y volver a agregarlo con el dato bueno.
// ---------------------------------------------------------------------------

export const addApoderadoToCaseSchema = z.object({
  caseId: z.string().min(1, 'El ID del caso es requerido'),
  nombreCompleto: z.string().min(1, 'El nombre completo es requerido'),
  tipoIdentificacion: z.string().optional(),
  identificacion: z.string().optional(),
  tarjetaProfesional: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().optional(),
  existePoderOtorgado: z.boolean().optional(),
});

export type AddApoderadoToCaseData = z.infer<typeof addApoderadoToCaseSchema>;

export const removeApoderadoFromCaseSchema = z.object({
  apoderadoId: z.string().min(1, 'El ID del apoderado es requerido'),
});

export type RemoveApoderadoFromCaseData = z.infer<
  typeof removeApoderadoFromCaseSchema
>;

export const apoderadoResponseSchema = z.object({
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
/**
 * GC-M6 — `deleteCase` es un borrado FÍSICO en cascada e irreversible de un
 * expediente legal. `confirmCaseNumber` es la confirmación escrita a mano: el
 * operador tiene que teclear el número del caso.
 *
 * Es OBLIGATORIO en el schema, no solo en el diálogo. Una server action es un
 * endpoint: si la confirmación viviera únicamente en el componente, bastaría
 * invocar la action sin pasar por la UI para saltársela. El diálogo aporta la
 * fricción; el schema la hace exigible.
 */
export const deleteCaseSchema = z.object({
  id: z.string(),
  confirmCaseNumber: z
    .string()
    .trim()
    .min(1, 'Escriba el número del caso para confirmar la eliminación'),
});

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
  apoderados: z.array(apoderadoFormSchema).default([]).optional(),
});

export const updateCaseFormSchema = updateCaseSchema.extend({
  debts: z.array(debtSchema).default([]).optional(),
  assets: z.array(assetSchema).default([]).optional(),
  libranzas: z.array(libranzaSchema).default([]).optional(),
  suspendedServices: z.array(suspendedServiceSchema).default([]).optional(),
  dependents: z.array(dependentSchema).default([]).optional(),
  legalProcesses: z.array(legalProcessSchema).default([]).optional(),
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
