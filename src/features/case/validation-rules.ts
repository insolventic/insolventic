/**
 * Validation Rules for Case Creation
 *
 * This file contains validation utilities and rules that complement
 * the main Zod schemas in schemas.ts
 */

import type { CreateCaseFormData, CreateCaseFormInput } from './schemas';

// ============================================
// CONSTANTS
// ============================================

// ---------------------------------------------------------------------------
// SMMLV — base de cálculo de los umbrales legales
// ---------------------------------------------------------------------------
//
// ⚠️ PENDIENTE DE VALIDACIÓN JURÍDICA ⚠️
//
// La constante anterior (`SMMLV_2025 = 1_300_000`) tenía el valor de 2024, no
// el de 2025, y estaba congelada en código para un sistema que opera en 2026.
// De ella cuelgan dos umbrales legales: la mínima cuantía (40 SMMLV, que
// determina si el apoderado judicial es obligatorio) y el tope de 150 SMMLV.
// Con el valor viejo, la mínima cuantía se calculaba sobre 1.300.000 en vez de
// sobre 1.750.905: un 35% por debajo del umbral real.
//
// Esta tabla resuelve el valor por año de radicación en vez de por constante
// de compilación.
//
// Fuentes normativas (verificadas contra las compilaciones oficiales):
//   2026 → $1.750.905. Fijado por el Decreto 1469 de 2025 (29-dic-2025, vigente
//          desde el 1-ene-2026), PERO ese decreto fue suspendido
//          provisionalmente por el Consejo de Estado el 12-feb-2026. La norma
//          operativa hoy es el Decreto 0159 de 2026 (19-feb-2026), que fija
//          "TRANSITORIAMENTE" el mismo valor en cumplimiento de esa orden
//          judicial. ⚠️ Al ser transitorio, el valor definitivo del año podría
//          cambiar: revisar antes de cada radicación de alto monto.
//   2025 → $1.423.500 (cross-check: 1.423.500 × 1,23 = 1.750.905, el 23% que
//          declara el Decreto 0159 de 2026).
//   2024 → $1.300.000. Pendiente de confirmar contra el Decreto 1572 de 2024,
//          derogado por el 1469 de 2025.
export const SMMLV_BY_YEAR: Readonly<Record<number, number>> = {
  2024: 1_300_000,
  2025: 1_423_500,
  2026: 1_750_905,
};

/** Último año con SMMLV cargado en la tabla. */
export const LATEST_SMMLV_YEAR = Math.max(
  ...Object.keys(SMMLV_BY_YEAR).map(Number),
);

/** true si el año pedido tiene un valor propio (no heredado del fallback). */
export function isSmmlvYearConfirmed(year: number): boolean {
  return year in SMMLV_BY_YEAR;
}

/**
 * SMMLV aplicable a un año de radicación.
 *
 * Si el año no está en la tabla (a partir de 2027, mientras no se cargue el
 * decreto correspondiente) cae al último año conocido en vez de lanzar: dejar a
 * los dos centros sin poder radicar un expediente sería peor que calcular el
 * umbral con una base conservadora. `isSmmlvYearConfirmed` permite avisar de la
 * degradación.
 */
export function getSmmlv(year: number = new Date().getFullYear()): number {
  return SMMLV_BY_YEAR[year] ?? SMMLV_BY_YEAR[LATEST_SMMLV_YEAR];
}

/**
 * @deprecated Nombre histórico conservado para no romper call-sites; su valor
 * era el de 2024. Usar `getSmmlv(year)`.
 */
export const SMMLV_2025 = SMMLV_BY_YEAR[2025];

export const CREDITOR_CLASSES = {
  PRIMERA: '1ª Clase – Tributarias',
  SEGUNDA: '2ª Clase – Vehiculares',
  TERCERA: '3ª Clase – Hipotecarios',
  CUARTA: '4ª Clase – Prendarios',
  QUINTA: '5ª Clase – Quirografarias (Laboral y otros)',
} as const;

/**
 * Maps a debt type to its creditor class.
 * Centralized rule used in both frontend (proposal) and backend (placeholder-mapper).
 */
export function getDebtClass(
  debtType: string,
): 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'quinta' {
  switch (debtType) {
    case 'IMPUESTOS':
      return 'primera';
    case 'VEHICULAR':
      return 'segunda';
    case 'HIPOTECARIA':
      return 'tercera';
    case 'PRENDARIA':
      return 'cuarta';
    case 'LABORAL':
    case 'PERSONAL':
    case 'TARJETA_CREDITO':
    case 'OTRA':
    default:
      return 'quinta';
  }
}

/**
 * Returns the display label for a class key.
 */
export function getClassLabel(
  key: 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'quinta',
): string {
  const labels: Record<string, string> = {
    primera: CREDITOR_CLASSES.PRIMERA,
    segunda: CREDITOR_CLASSES.SEGUNDA,
    tercera: CREDITOR_CLASSES.TERCERA,
    cuarta: CREDITOR_CLASSES.CUARTA,
    quinta: CREDITOR_CLASSES.QUINTA,
  };
  return labels[key] || key;
}

export const CREDIT_CLASSIFICATIONS = {
  GARANTIZADO: 'Crédito Garantizado',
  PRIVILEGIADO: 'Crédito Privilegiado',
  QUIROGRAFARIO: 'Crédito Quirografario',
} as const;

export const CAUSE_OPTIONS = [
  {
    value: 'SOBREENDEUDAMIENTO',
    label: 'Sobreendeudamiento por falta de recursos',
  },
  { value: 'PERDIDA_EMPLEO', label: 'Pérdida de empleo' },
  { value: 'DIVORCIO', label: 'Divorcio' },
  { value: 'ENFERMEDAD', label: 'Enfermedad' },
  { value: 'ACCIDENTE', label: 'Accidente' },
  { value: 'ESTAFA', label: 'Estafa' },
  { value: 'DISMINUCION_INGRESOS', label: 'Disminución de ingresos' },
  {
    value: 'MALA_EDUCACION_FINANCIERA',
    label: 'Falta de educación financiera y malos hábitos',
  },
  { value: 'MUERTE_CONYUGE', label: 'Muerte de cónyuge' },
  {
    value: 'NUEVOS_CREDITOS',
    label: 'Acudí a nuevos créditos para cubrir otros',
  },
  { value: 'MALA_INVERSION', label: 'Mala inversión' },
  { value: 'OTROS', label: 'Otros' },
] as const;

export const MARITAL_STATUS_OPTIONS = [
  { value: 'SOLTERO', label: 'Soltero(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'UNION_LIBRE', label: 'Unión Libre' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUDO', label: 'Viudo(a)' },
] as const;

export const PROPERTY_TYPES = [
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'LOTE', label: 'Lote' },
  { value: 'LOCAL', label: 'Local comercial' },
  { value: 'BODEGA', label: 'Bodega' },
  { value: 'OFICINA', label: 'Oficina' },
  { value: 'FINCA', label: 'Finca' },
  { value: 'OTRO', label: 'Otro' },
] as const;

export const MOVABLE_ASSET_CATEGORIES = [
  { value: 'ELECTRONICO', label: 'Electrónicos y electrodomésticos' },
  { value: 'ENSERES', label: 'Muebles y enseres' },
  { value: 'VEHICULO', label: 'Vehículo' },
  { value: 'JOYAS', label: 'Joyas y piedras preciosas' },
  { value: 'EFECTIVO', label: 'Dinero en efectivo' },
  { value: 'ACCIONES', label: 'Acciones y participaciones' },
  { value: 'CUENTAS', label: 'Cuentas por cobrar' },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: 'HIJO', label: 'Hijo(a)' },
  { value: 'CONYUGE', label: 'Cónyuge' },
  { value: 'PADRE', label: 'Padre' },
  { value: 'MADRE', label: 'Madre' },
  { value: 'HERMANO', label: 'Hermano(a)' },
  { value: 'ABUELO', label: 'Abuelo(a)' },
  { value: 'OTRO', label: 'Otro' },
] as const;

// ============================================
// VALIDATION RESULT TYPE
// ============================================

export interface ValidationIssue {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ============================================
// COHERENCE VALIDATION FUNCTIONS
// ============================================

/**
 * Validates income/expenses coherence
 */
export function validateIncomeExpenses(
  monthlyIncome: number | undefined,
  monthlyExpenses: number | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const income = monthlyIncome || 0;
  const expenses = monthlyExpenses || 0;

  if (expenses > income) {
    issues.push({
      field: 'monthlyExpenses',
      message: 'Los gastos superan los ingresos. Verifique los datos.',
      type: 'warning',
    });
  }

  if (income > 0 && expenses === 0) {
    issues.push({
      field: 'monthlyExpenses',
      message: 'Debe declarar gastos si tiene ingresos',
      type: 'warning',
    });
  }

  return issues;
}

/**
 * Validates debt limits based on SMMLV
 */
export function validateDebtLimits(
  totalDebt: number,
  creditorCount: number,
  year: number = new Date().getFullYear(),
): ValidationIssue[] {
  const smmlv = getSmmlv(year);
  const issues: ValidationIssue[] = [];

  // Check 150 creditor limit
  if (creditorCount > 150) {
    issues.push({
      field: 'debts',
      message: 'No puede tener más de 150 acreedores para este procedimiento',
      type: 'error',
    });
  }

  // Check if debt exceeds 150 SMMLV (may require different procedure)
  if (totalDebt > 150 * smmlv) {
    issues.push({
      field: 'totalDebt',
      message:
        'La deuda total supera 150 SMMLV. Verifique si aplica este procedimiento.',
      type: 'warning',
    });
  }

  return issues;
}

/**
 * Validates payment proposal coherence
 */
export function validatePaymentProposal(
  data: Partial<CreateCaseFormInput>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Grace period validation
  if (data.gracePeriodRequested && !data.gracePeriodMonths) {
    issues.push({
      field: 'gracePeriodMonths',
      message: 'Debe especificar el número de meses de período de gracia',
      type: 'error',
    });
  }

  if (data.gracePeriodMonths && data.gracePeriodMonths > 24) {
    issues.push({
      field: 'gracePeriodMonths',
      message: 'El período de gracia no puede exceder 24 meses',
      type: 'error',
    });
  }

  // Dation in payment
  if (data.paymentInKind && !data.paymentInKindDescription) {
    issues.push({
      field: 'paymentInKindDescription',
      message: 'Debe describir el bien ofrecido como dación en pago',
      type: 'error',
    });
  }

  // Asset sale authorization
  if (data.assetSaleAuthorized && !data.assetSaleDescription) {
    issues.push({
      field: 'assetSaleDescription',
      message: 'Debe describir el bien autorizado para venta',
      type: 'error',
    });
  }

  // Capital reduction
  if (data.capitalReduction && !data.capitalReductionPercent) {
    issues.push({
      field: 'capitalReductionPercent',
      message: 'Debe especificar el porcentaje de reducción de capital',
      type: 'error',
    });
  }

  const capitalReductionPercent =
    typeof data.capitalReductionPercent === 'string'
      ? parseFloat(data.capitalReductionPercent)
      : data.capitalReductionPercent;
  if (capitalReductionPercent && capitalReductionPercent > 100) {
    issues.push({
      field: 'capitalReductionPercent',
      message: 'El porcentaje de reducción no puede superar 100%',
      type: 'error',
    });
  }

  // Payment term
  if (data.paymentTermMonths && data.paymentTermMonths > 120) {
    issues.push({
      field: 'paymentTermMonths',
      message: 'El plazo de pago no puede exceder 120 meses (10 años)',
      type: 'error',
    });
  }

  // Extraordinary payment
  if (data.extraordinaryPayment && !data.extraordinaryPaymentDate) {
    issues.push({
      field: 'extraordinaryPaymentDate',
      message: 'Debe especificar la fecha del pago extraordinario',
      type: 'error',
    });
  }

  // Class privileges
  if (data.hasClassPrivileges && !data.classPrivilegesDescription) {
    issues.push({
      field: 'classPrivilegesDescription',
      message: 'Debe describir los privilegios de clase solicitados',
      type: 'error',
    });
  }

  return issues;
}

/**
 * Validates spouse data based on marital status
 */
export function validateSpouseData(
  maritalStatus: string | undefined,
  spouseData: {
    spouseName?: string | null;
    spouseIdNumber?: string | null;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (maritalStatus && ['CASADO', 'UNION_LIBRE'].includes(maritalStatus)) {
    if (!spouseData.spouseName) {
      issues.push({
        field: 'spouseName',
        message: 'Debe ingresar el nombre del cónyuge',
        type: 'error',
      });
    }

    if (!spouseData.spouseIdNumber) {
      issues.push({
        field: 'spouseIdNumber',
        message: 'Debe ingresar la cédula del cónyuge',
        type: 'error',
      });
    }
  }

  return issues;
}

/**
 * Validates assets declaration coherence
 */
export function validateAssetsDeclaration(
  hasAssets: boolean,
  assetCount: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (hasAssets && assetCount === 0) {
    issues.push({
      field: 'assets',
      message: 'Si declara tener bienes, debe agregar al menos uno',
      type: 'error',
    });
  }

  if (!hasAssets && assetCount > 0) {
    issues.push({
      field: 'hasAssets',
      message: 'Marcó que no tiene bienes pero agregó bienes a la lista',
      type: 'warning',
    });
  }

  return issues;
}

/**
 * Validates legal processes declaration coherence
 */
export function validateLegalProcesses(
  hasLegalProcesses: boolean,
  processCount: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (hasLegalProcesses && processCount === 0) {
    issues.push({
      field: 'legalProcesses',
      message:
        'Si declara tener procesos judiciales, debe agregar al menos uno',
      type: 'error',
    });
  }

  if (!hasLegalProcesses && processCount > 0) {
    issues.push({
      field: 'hasLegalProcesses',
      message: 'Marcó que no tiene procesos pero agregó procesos a la lista',
      type: 'warning',
    });
  }

  return issues;
}

/**
 * Validates attorney data if acting with attorney
 */
export function validateAttorneyData(
  hasAttorney: boolean,
  attorneyData: {
    attorney?: string | null;
    // Add more attorney fields as needed
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (hasAttorney && !attorneyData.attorney) {
    issues.push({
      field: 'attorney',
      message: 'Debe ingresar los datos del apoderado',
      type: 'error',
    });
  }

  return issues;
}

// ============================================
// DYNAMIC CONDITIONAL VALIDATIONS
// ============================================

/**
 * Validates conditions based on asset types.
 * - Real estate → Certificado de tradición required
 * - Vehicle → Tarjeta de propiedad required
 */
export function validateAssetConditionals(
  assets: Array<{ type?: string; name?: string }>,
  uploadedDocKeys: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const hasRealEstate = assets.some(
    (a) =>
      a.type === 'INMUEBLE' ||
      a.type === 'Inmueble' ||
      [
        'CASA',
        'APARTAMENTO',
        'LOTE',
        'LOCAL',
        'BODEGA',
        'OFICINA',
        'FINCA',
      ].includes(a.type || ''),
  );
  const hasVehicle = assets.some(
    (a) =>
      a.type === 'VEHICULO' ||
      a.type === 'Vehiculo' ||
      (a.name || '').toLowerCase().includes('vehículo') ||
      (a.name || '').toLowerCase().includes('vehiculo'),
  );

  if (hasRealEstate && !uploadedDocKeys.includes('tradicion_libertad')) {
    issues.push({
      field: 'document_tradicion_libertad',
      message:
        'Tiene bienes inmuebles: debe adjuntar el certificado de tradición y libertad',
      type: 'error',
    });
  }

  if (hasVehicle && !uploadedDocKeys.includes('tarjeta_propiedad')) {
    issues.push({
      field: 'document_tarjeta_propiedad',
      message: 'Tiene vehículo: debe adjuntar la tarjeta de propiedad',
      type: 'error',
    });
  }

  return issues;
}

/**
 * Validates minimum cuantía threshold.
 * If debt exceeds 40 SMMLV, attorney is required.
 */
export function validateMinimaCuantia(
  totalDebt: number,
  hasAttorney: boolean,
  year: number = new Date().getFullYear(),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const minimaCuantia = 40 * getSmmlv(year);

  if (totalDebt > minimaCuantia) {
    if (!hasAttorney) {
      issues.push({
        field: 'attorney',
        message: `La deuda total ($${totalDebt.toLocaleString('es-CO')}) supera la mínima cuantía (40 SMMLV = $${minimaCuantia.toLocaleString('es-CO')}). Es obligatorio contar con apoderado judicial.`,
        type: 'error',
      });
    }
  }

  return issues;
}

// ============================================
// REQUIRED DOCUMENTS VALIDATION
// ============================================

export const REQUIRED_DOCUMENTS = [
  { id: 'cedula', name: 'Cédula de ciudadanía', always: true },
  { id: 'redam', name: 'Certificado REDAM', always: true },
  { id: 'cert_ingresos', name: 'Certificado de ingresos', always: true },
];

export const CONDITIONAL_DOCUMENTS = [
  {
    id: 'tradicion_libertad',
    name: 'Certificado de tradición y libertad de inmuebles',
    condition: 'hasRealEstate' as const,
  },
  {
    id: 'poder',
    name: 'Poder (notariado o prueba de envío desde correo del deudor)',
    condition: 'hasAttorney' as const,
  },
  {
    id: 'matricula',
    name: 'Registro de matrícula mercantil (Cámara de Comercio)',
    condition: 'isSmallMerchant' as const,
  },
  {
    id: 'tarjeta_propiedad',
    name: 'Tarjeta de propiedad del vehículo',
    condition: 'hasVehicle' as const,
  },
];

export const OPTIONAL_DOCUMENTS = [
  { id: 'extractos', name: 'Extractos bancarios', multiple: true },
  {
    id: 'gastos_manutencion',
    name: 'Copia de gastos de manutención (gas, agua, luz)',
    multiple: true,
  },
  {
    id: 'procesos_judiciales',
    name: 'Historial de procesos judiciales',
    multiple: true,
  },
  { id: 'mandamientos_pago', name: 'Mandamientos de pago', multiple: true },
  { id: 'certificados_deuda', name: 'Certificados de deuda', multiple: true },
  {
    id: 'copias_titulos',
    name: 'Copias de letras, pagarés, cheques',
    multiple: true,
  },
];

export function getRequiredDocuments(
  caseData: Partial<CreateCaseFormInput>,
): string[] {
  // Conciliation and support-agreement cases follow a different document workflow —
  // no obligatory uploads at creation time; documents are produced by the
  // respective pipeline (Solicitud, Acta, Acuerdo, etc.).
  if (caseData.type === 'CONCILIATION' || caseData.type === 'SUPPORT_AGREEMENT')
    return [];

  const required = REQUIRED_DOCUMENTS.map((d) => d.id);

  const assets = (caseData.assets || []) as Array<{
    type?: string;
    name?: string;
  }>;

  // Real estate → certificado de tradición y libertad
  const hasRealEstate = assets.some(
    (a) =>
      a.type === 'INMUEBLE' ||
      a.type === 'Inmueble' ||
      [
        'CASA',
        'APARTAMENTO',
        'LOTE',
        'LOCAL',
        'BODEGA',
        'OFICINA',
        'FINCA',
      ].includes(a.type || ''),
  );
  if (hasRealEstate) {
    required.push('tradicion_libertad');
  }

  // Attorney → poder
  const hasAttorney = !!(caseData as Record<string, unknown>).hasAttorney;
  if (hasAttorney) {
    required.push('poder');
  }

  // Small merchant → matrícula mercantil
  const isSmallMerchant =
    caseData.applicantScope?.includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE') ||
    caseData.applicantScope?.includes('Persona natural pequeño comerciante');
  if (isSmallMerchant) {
    required.push('matricula');
  }

  // Vehicle → tarjeta de propiedad
  const hasVehicle = assets.some(
    (a) =>
      a.type === 'VEHICULO' ||
      a.type === 'Vehiculo' ||
      (a.name || '').toLowerCase().includes('vehículo') ||
      (a.name || '').toLowerCase().includes('vehiculo'),
  );
  if (hasVehicle) {
    required.push('tarjeta_propiedad');
  }

  return required;
}

/**
 * Validates that all required documents have been uploaded.
 * Returns list of missing documents for display.
 */
export interface DocumentValidationResult {
  isValid: boolean;
  missingDocuments: Array<{ id: string; name: string }>;
}

export function validateDocumentsComplete(
  uploadedDocKeys: string[],
  caseData: Partial<CreateCaseFormInput>,
): DocumentValidationResult {
  const requiredIds = getRequiredDocuments(caseData);

  const allDocs = [...REQUIRED_DOCUMENTS, ...CONDITIONAL_DOCUMENTS];

  const missingDocuments = requiredIds
    .filter((id) => !uploadedDocKeys.includes(id))
    .map((id) => {
      const doc = allDocs.find((d) => d.id === id);
      return { id, name: doc?.name ?? id };
    });

  return {
    isValid: missingDocuments.length === 0,
    missingDocuments,
  };
}

// ============================================
// COMPLETE CASE VALIDATION
// ============================================

/**
 * Performs complete validation of case data
 * Returns all errors and warnings.
 * @param uploadedDocKeys — array of document keys that have been uploaded (e.g. ['cedula', 'redam'])
 */
export function validateCaseComplete(
  data: Partial<CreateCaseFormInput>,
  uploadedDocKeys: string[] = [],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Calculate totals from debts
  const debts = data.debts || [];
  const totalDebt = debts.reduce((sum, d) => {
    const capital =
      typeof d.capitalAmount === 'string'
        ? parseFloat(d.capitalAmount) || 0
        : d.capitalAmount || 0;
    const interest =
      typeof d.interestAmount === 'string'
        ? parseFloat(d.interestAmount) || 0
        : d.interestAmount || 0;
    return sum + capital + interest;
  }, 0);

  // Basic required fields
  if (!data.debtorId) {
    issues.push({
      field: 'debtorId',
      message: 'Debe seleccionar un deudor',
      type: 'error',
    });
  }

  if (!data.causes || data.causes.length === 0) {
    issues.push({
      field: 'causes',
      message: 'Debe seleccionar al menos una causa',
      type: 'error',
    });
  }

  if (!data.applicantScope || data.applicantScope.length === 0) {
    issues.push({
      field: 'applicantScope',
      message: 'Debe seleccionar el ámbito de aplicación',
      type: 'error',
    });
  }

  if (debts.length === 0) {
    issues.push({
      field: 'debts',
      message: 'Debe agregar al menos un acreedor',
      type: 'error',
    });
  }

  // Income/Expenses validation
  const incomeIssues = validateIncomeExpenses(
    typeof data.monthlyIncome === 'number' ? data.monthlyIncome : undefined,
    typeof data.monthlyExpenses === 'number' ? data.monthlyExpenses : undefined,
  );

  incomeIssues.forEach((issue) => {
    if (issue.type === 'error') issues.push(issue);
    else warnings.push(issue);
  });

  // Debt limits validation
  const debtIssues = validateDebtLimits(totalDebt, debts.length);
  debtIssues.forEach((issue) => {
    if (issue.type === 'error') issues.push(issue);
    else warnings.push(issue);
  });

  // Payment proposal validation
  const proposalIssues = validatePaymentProposal(data);
  proposalIssues.forEach((issue) => {
    if (issue.type === 'error') issues.push(issue);
    else warnings.push(issue);
  });

  // Assets validation — the form has no explicit "hasAssets" flag, so we
  // derive it from the assets array itself. This makes the consistency
  // check a no-op in practice (both branches require a mismatch that
  // can't happen), but we keep it so the helper stays reachable for
  // future UI changes that might add an explicit toggle.
  const assetsList = data.assets || [];
  const assetIssues = validateAssetsDeclaration(
    assetsList.length > 0,
    assetsList.length,
  );
  assetIssues.forEach((issue) => {
    if (issue.type === 'error') issues.push(issue);
    else warnings.push(issue);
  });

  // Legal processes validation
  const processIssues = validateLegalProcesses(
    data.hasLegalProcesses || false,
    (data.legalProcesses || []).length,
  );
  processIssues.forEach((issue) => {
    if (issue.type === 'error') issues.push(issue);
    else warnings.push(issue);
  });

  // Notification fields
  if (!data.notificationEmail) {
    issues.push({
      field: 'notificationEmail',
      message: 'Email de notificación es requerido',
      type: 'error',
    });
  }

  if (!data.notificationAddress) {
    issues.push({
      field: 'notificationAddress',
      message: 'Dirección de notificación es requerida',
      type: 'error',
    });
  }

  if (!data.notificationPhone) {
    issues.push({
      field: 'notificationPhone',
      message: 'Teléfono de notificación es requerido',
      type: 'error',
    });
  }

  // Documents validation
  if (uploadedDocKeys.length > 0 || Object.keys(data).length > 0) {
    const docValidation = validateDocumentsComplete(uploadedDocKeys, data);
    docValidation.missingDocuments.forEach((doc) => {
      issues.push({
        field: `document_${doc.id}`,
        message: `Documento obligatorio faltante: ${doc.name}`,
        type: 'error',
      });
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
  };
}

// ============================================
// FIELD REQUIREMENTS BY DOCUMENT
// ============================================

export const DOCUMENT_REQUIRED_FIELDS: Record<string, string[]> = {
  'solicitud-insolvencia': [
    'NOMBRE_DEUDOR',
    'CEDULA_DEUDOR',
    'DIRECCION_DEUDOR',
    'EMAIL_DEUDOR',
    'TELEFONO_DEUDOR',
    'ACREEDOR_1',
    'VALOR_1',
    'TOTAL_ACREENCIAS',
    'INGRESO_PRINCIPAL',
    'GASTOS_MENSUALES',
    'PROPUESTA_DISPONIBLE',
  ],
  'designacion-conciliador': [
    'NOMBRE_DEUDOR',
    'CEDULA_DEUDOR',
    'FECHA_RADICACION',
    'FECHA_DESIGNACION',
  ],
  'aceptacion-cargo': [
    'NOMBRE_DEUDOR',
    'CEDULA_DEUDOR',
    'FECHA_RADICACION',
    'FECHA_DESIGNACION',
    'FECHA_ACEPTACION',
  ],
  'auto-admision': [
    'NOMBRE_DEUDOR',
    'CEDULA_DEUDOR',
    'RADICADO',
    'FECHA_ADMISION',
    'FECHA_AUDIENCIA',
    'HORA_AUDIENCIA',
    'ZOOM_ID',
    'ZOOM_CODIGO',
    'ZOOM_LINK',
  ],
};

/**
 * Checks if all required fields for a document type are filled
 */
export function canGenerateDocument(
  documentType: string,
  placeholders: Record<string, string>,
): { canGenerate: boolean; missingFields: string[] } {
  const requiredFields = DOCUMENT_REQUIRED_FIELDS[documentType] || [];

  const missingFields = requiredFields.filter((field) => {
    const value = placeholders[field];
    return !value || value.trim() === '' || value === 'N/A';
  });

  return {
    canGenerate: missingFields.length === 0,
    missingFields,
  };
}

// ============================================
// BACKEND ENTRY POINT (C-2)
// ============================================

/**
 * Punto de entrada único de las reglas de negocio para las server actions.
 *
 * Hasta C-2 este módulo solo lo importaban los componentes del formulario de
 * creación, así que un POST directo a `createCase` / `updateCase` —trivial de
 * construir contra una server action— saltaba todas las reglas del trámite.
 *
 * Diferencias deliberadas respecto de `validateCaseComplete` (que sigue siendo
 * el validador del formulario, más exigente):
 *
 *  - **Se segmenta por tipo de caso.** Las reglas de umbral (mínima cuantía,
 *    150 SMMLV, 150 acreedores) y los campos obligatorios del formulario de
 *    insolvencia no aplican a CONCILIATION ni a SUPPORT_AGREEMENT, que se
 *    radican con otro soporte documental. Aplicarlas a todo bloquearía la
 *    operación real de los dos centros.
 *  - **No valida documentos adjuntos.** `validateDocumentsComplete` necesita
 *    la lista de archivos subidos, que el servidor no conoce en el momento de
 *    crear el caso (la carga va por otro flujo). Queda como brecha conocida.
 *  - **En update solo valida lo que llega.** Una edición parcial no debe
 *    fallar por campos que el payload ni siquiera toca.
 *
 * ⚠️ PENDIENTE DE VALIDACIÓN JURÍDICA: ver `SMMLV_BY_YEAR` y la lista de
 * reglas marcadas en docs/IMPLEMENTACION_SEMANA_3.md.
 */
export type CaseValidationMode = 'create' | 'update';

export interface BusinessRulesOptions {
  mode: CaseValidationMode;
  /** Año de radicación; determina el SMMLV aplicable. */
  year?: number;
  /**
   * Estado civil del deudor. Vive en `Debtor`, no en `Case`, así que la server
   * action lo pasa explícitamente; sin él la regla de sociedad conyugal no se
   * evalúa (no se asume soltería).
   */
  debtorMaritalStatus?: string | null;
}

export function validateCaseBusinessRules(
  data: Partial<CreateCaseFormInput>,
  options: BusinessRulesOptions = { mode: 'create' },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const year = options.year ?? new Date().getFullYear();
  const isInsolvency = (data.type ?? 'INSOLVENCY') === 'INSOLVENCY';
  const isCreate = options.mode === 'create';

  const push = (list: ValidationIssue[]) =>
    list.forEach((issue) => {
      if (issue.type === 'error') issues.push(issue);
      else warnings.push(issue);
    });

  // --- Reglas aplicables a todo tipo de caso -------------------------------

  const debts = data.debts ?? [];
  const totalDebt = debts.reduce((sum, d) => {
    const capital =
      typeof d.capitalAmount === 'string'
        ? parseFloat(d.capitalAmount) || 0
        : (d.capitalAmount ?? 0);
    const interest =
      typeof d.interestAmount === 'string'
        ? parseFloat(d.interestAmount) || 0
        : (d.interestAmount ?? 0);
    return sum + capital + interest;
  }, 0);

  if (data.monthlyIncome !== undefined || data.monthlyExpenses !== undefined) {
    push(
      validateIncomeExpenses(
        typeof data.monthlyIncome === 'number' ? data.monthlyIncome : undefined,
        typeof data.monthlyExpenses === 'number'
          ? data.monthlyExpenses
          : undefined,
      ),
    );
  }

  push(validatePaymentProposal(data));

  if (options.debtorMaritalStatus) {
    push(
      validateSpouseData(options.debtorMaritalStatus, {
        spouseName: data.spouseName,
        spouseIdNumber: data.spouseIdNumber,
      }),
    );
  }

  // `validateAssetConditionals` queda fuera a propósito: depende de la lista de
  // documentos ya cargados, que el servidor no conoce al crear el caso.
  // Brecha conocida — ver docs/IMPLEMENTACION_SEMANA_3.md.

  if (data.hasLegalProcesses !== undefined) {
    push(
      validateLegalProcesses(
        data.hasLegalProcesses || false,
        (data.legalProcesses ?? []).length,
      ),
    );
  }

  // --- Reglas específicas del trámite de insolvencia ------------------------

  if (isInsolvency) {
    if (debts.length > 0 || isCreate) {
      push(validateDebtLimits(totalDebt, debts.length, year));
    }

    if (totalDebt > 0) {
      push(validateMinimaCuantia(totalDebt, Boolean(data.attorney), year));
    }

    push(
      validateAttorneyData(Boolean(data.attorney), { attorney: data.attorney }),
    );

    if (isCreate) {
      if (!data.debtorId) {
        issues.push({
          field: 'debtorId',
          message: 'Debe seleccionar un deudor',
          type: 'error',
        });
      }
      if (!data.causes || data.causes.length === 0) {
        issues.push({
          field: 'causes',
          message: 'Debe seleccionar al menos una causa',
          type: 'error',
        });
      }
      if (debts.length === 0) {
        issues.push({
          field: 'debts',
          message: 'Debe agregar al menos un acreedor',
          type: 'error',
        });
      }
    }
  }

  return { isValid: issues.length === 0, issues, warnings };
}

/**
 * Aplana los errores en un mensaje único apto para el `error` que devuelven
 * las server actions (que solo transportan string).
 */
export function formatValidationErrors(result: ValidationResult): string {
  return result.issues.map((i) => i.message).join(' | ');
}
