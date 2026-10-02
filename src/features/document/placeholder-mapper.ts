/**
 * Placeholder Mapper for Document Generation
 * Maps case data to HTML template placeholders
 */

import type { CaseWithRelations } from '../case/schemas';
import { nowColombia } from '@/lib/date-colombia';
import { renderTemplate } from './handlebars-lite';
import {
  formatCurrency,
  formatDate,
  formatShortDate,
  getDayNumber,
  getDayInWords,
  getMonthName,
  getYear,
  boolToSiNo,
  getGenderPrefix,
} from './placeholders/format';
import {
  mapCauses,
  mapLegalProcesses,
  mapLibranzas,
  mapSuspendedServices,
  mapDependents,
} from './placeholders/case-lists';
import { mapIncomeDeclaration } from './placeholders/income';
import { escapePlaceholder, escapeAllUnlessHtml } from './placeholders/escape';
import { mapDebts, mapAssets } from './placeholders/assets-debts';
import {
  buildConciliationContext,
  mapConciliationFields,
} from './placeholders/conciliacion';
import { mapApoyoFields } from './placeholders/apoyo';
import {
  mapApplicantScope,
  mapAgreementResult,
} from './placeholders/solicitante-acuerdo';
import {
  mapExtendedDates,
  mapExternalEntities,
  mapFracasoVariables,
} from './placeholders/fechas-entidades-fracaso';
import {
  mapDynamicTables,
  mapPaymentProposal,
} from './placeholders/tablas-dinamicas-pagos';
// Re-exportada: a diferencia de los demás sub-mappers movidos, varios tests
// la importan directo de este archivo (`@/features/document/placeholder-mapper`),
// no solo `mapCaseToPlaceholders` — ver la nota en placeholders/conciliacion.ts.
export { buildConciliationContext } from './placeholders/conciliacion';

// Type for the mapped placeholders
export type PlaceholderMap = Record<string, string>;

// Map check list variables (SI/NO validations)
function mapCheckList(caseData: CaseWithRelations): PlaceholderMap {
  const debtor = caseData.debtor;
  const totalDebt = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0,
  );
  const SMMLV = 1300000; // Salario mínimo 2025 Colombia

  // Calculate total assets value
  const totalAssets = caseData.assets.reduce(
    (sum, a) => sum + (Number(a.value) || 0),
    0,
  );

  const hasCreditors = caseData.debts.length > 0;
  const hasAssets = caseData.assets.length > 0;
  const hasIncome =
    (Number(caseData.monthlyIncome) || Number(debtor.monthlyIncome) || 0) > 0;
  const hasCauses = (caseData.causes || []).length > 0;
  const hasProposal =
    caseData.paymentTermMonths != null && caseData.paymentTermMonths > 0;
  const hasAlimentaryObligations = (caseData.dependents || []).length > 0;
  const hasLegalProcesses = (caseData.legalProcesses || []).length > 0;
  const isSmallMerchant = (caseData.applicantScope || []).includes(
    'PERSONA_NATURAL_PEQUENA_COMERCIANTE',
  );
  const hasSpouse = !!caseData.spouseName;
  const hasAttorney =
    !!(caseData as Record<string, unknown>).apoderadoNombreCompleto ||
    (((caseData as Record<string, unknown>).apoderados as unknown[]) || [])
      .length > 0;
  const moreThan150Creditors = caseData.debts.length > 150;
  const lessThan40SMMLV = totalDebt < 40 * SMMLV;
  const moreThan150SMMLV = totalDebt > 150 * SMMLV;

  return {
    // Check list SI/NO pairs
    SI_ACREEDORES: hasCreditors ? 'X' : '',
    NO_ACREEDORES: !hasCreditors ? 'X' : '',
    SI_BIENES: hasAssets ? 'X' : '',
    NO_BIENES: !hasAssets ? 'X' : '',
    SI_VALOR_BIENES: hasAssets && totalAssets > 0 ? 'X' : '',
    NO_VALOR_BIENES: !hasAssets || totalAssets === 0 ? 'X' : '',
    SI_INGRESOS: hasIncome ? 'X' : '',
    NO_INGRESOS: !hasIncome ? 'X' : '',
    SI_RECURSOS: hasIncome ? 'X' : '',
    NO_RECURSOS: !hasIncome ? 'X' : '',
    SI_CAUSAS: hasCauses ? 'X' : '',
    NO_CAUSAS: !hasCauses ? 'X' : '',
    SI_PROPUESTA: hasProposal ? 'X' : '',
    NO_PROPUESTA: !hasProposal ? 'X' : '',
    SI_ALIMENTARIAS: hasAlimentaryObligations ? 'X' : '',
    NO_ALIMENTARIAS: !hasAlimentaryObligations ? 'X' : '',
    SI_PROCESOS: hasLegalProcesses ? 'X' : '',
    NO_PROCESOS: !hasLegalProcesses ? 'X' : '',
    SI_PC: isSmallMerchant ? 'X' : '',
    NO_PC: !isSmallMerchant ? 'X' : '',
    TIPO_PERSONA: isSmallMerchant
      ? 'Pequeño Comerciante (PC)'
      : 'Persona Natural No Comerciante',
    SI_CONYUGAL: hasSpouse ? 'X' : '',
    NO_CONYUGAL: !hasSpouse ? 'X' : '',
    SI_APODERADO: hasAttorney ? 'X' : '',
    NO_APODERADO: !hasAttorney ? 'X' : '',
    SI_150: moreThan150Creditors ? 'X' : '',
    NO_150: !moreThan150Creditors ? 'X' : '',
    SI_40: lessThan40SMMLV ? 'X' : '',
    NO_40: !lessThan40SMMLV ? 'X' : '',
    SI_MAS_150: moreThan150SMMLV ? 'X' : '',
    NO_MAS_150: !moreThan150SMMLV ? 'X' : '',
    SI_SOLICITUD: 'X', // Always X when generating
    NO_SOLICITUD: '',
    OK: '✓',

    // New checklist: certificate/acreedor verification
    SI_CERT_AHORROS: '', // Manual: savings/guarantee certificate
    NO_CERT_AHORROS: 'X',
    SI_TODOS_ACREEDORES: hasCreditors ? 'X' : '',
    NO_TODOS_ACREEDORES: !hasCreditors ? 'X' : '',
    SI_DESCONOCE_INFO: '', // Manual: debtor declares unknown info
    NO_DESCONOCE_INFO: 'X',

    // Document verification SI/NO pairs
    SI_DOC_CEDULA: 'X', // Assumed present when generating
    NO_DOC_CEDULA: '',
    SI_DOC_REDAM: '', // Manual verification
    NO_DOC_REDAM: 'X',
    SI_DOC_MATRICULA: isSmallMerchant ? '' : 'N/A',
    NO_DOC_MATRICULA: isSmallMerchant ? 'X' : '',
    SI_DOC_TRADICION: hasAssets ? '' : 'N/A',
    NO_DOC_TRADICION: hasAssets ? 'X' : '',
    SI_DOC_IMPUESTOS: '', // Manual verification
    NO_DOC_IMPUESTOS: 'X',
    SI_DOC_BIENES_MUEBLES: hasAssets ? 'X' : '',
    NO_DOC_BIENES_MUEBLES: !hasAssets ? 'X' : '',
    SI_DOC_PODER: hasAttorney ? '' : 'N/A',
    NO_DOC_PODER: hasAttorney ? 'X' : '',
    SI_DOC_GASTOS: '', // Manual verification
    NO_DOC_GASTOS: 'X',
    SI_DOC_EXTRACTOS: '', // Manual verification
    NO_DOC_EXTRACTOS: 'X',
    SI_DOC_CONOCE_NORMA: '', // Manual: manifestacion conocer norma
    NO_DOC_CONOCE_NORMA: 'X',
    SI_DOC_FIRMA: 'X', // Always present when generating
    NO_DOC_FIRMA: '',

    // Notification verification
    SI_NOTIF_DEUDOR: '', // Manual: filled post-notification
    NO_NOTIF_DEUDOR: 'X',
    SI_NOTIF_ACREEDORES: '', // Manual: filled post-notification
    NO_NOTIF_ACREEDORES: 'X',

    // SMMLV reference
    SMMLV_VALOR: formatCurrency(SMMLV),
  };
}

// Los sub-mappers del Formulario Definitivo viven en
// ./placeholders/formulario-definitivo.ts (Paso 3 de la division).

// Map Sentido del Voto variables (lowercase naming as per HTML template)
function mapSentidoVotoVariables(caseData: CaseWithRelations): PlaceholderMap {
  return {
    // Variables en minúsculas como están en el template Sentido Del Voto.html
    deudor_nombre: caseData.debtor.name,
    deudor_cedula: caseData.debtor.idNumber,
    fecha_documento: formatDate(nowColombia()),
    tramite_interno: caseData.caseNumber,
    entidad_representada: '', // MANUAL - lo llena el acreedor
    apoderado_nombre: '', // MANUAL
    apoderado_cedula: '', // MANUAL
    tarjeta_profesional: '', // MANUAL
    correo_electronico: '', // MANUAL
    telefono_contacto: '', // MANUAL
    fecha_inicio_pago: '________________', // MANUAL - fecha de inicio de pagos post-acuerdo
    numero_cuotas: caseData.paymentTermMonths?.toString() || '____',
    valor_cuota: formatCurrency(Number(caseData.monthlyPaymentAmount) || 0),
    forma_pago: '', // MANUAL
    observaciones: '', // MANUAL
    votacion: '', // MANUAL - SI/NO
    firma_votante: '', // MANUAL
  };
}

// ============================================================
// INSOLVENCIA — contexto de bloques {{#each}} / {{#if}}
// ============================================================

/**
 * Un acreedor, con las claves que consumen las tablas de la Solicitud y de CYG.
 *
 * Los nombres son los mismos que los de los slots planos de `mapDebts`, sin el
 * prefijo numérico: `AC3_CODEUDOR_NOMBRE` ↔ `CODEUDOR_NOMBRE` dentro del
 * `{{#each}}`. Así la migración de una plantilla es mecánica y se puede leer el
 * diff sin cruzar dos vocabularios.
 */
export interface AcreedorContextItem {
  /** Número de orden, 1-based. Lo emite el builder porque handlebars-lite no expone `@index`. */
  NUMERO: string;

  // Ficha detallada (Sección 3 de la Solicitud)
  NOMBRE: string;
  DOMICILIO: string;
  DIRECCION: string;
  EMAIL: string;
  CAPITAL: string;
  INTERESES: string;
  POSTERGADO: string;
  TASA: string;
  DOCUMENTO: string;
  FECHA_OTORGAMIENTO: string;
  FECHA_VENCIMIENTO: string;
  CLASIFICACION: string;
  CODEUDOR_NOMBRE: string;
  CODEUDOR_DOMICILIO: string;
  CODEUDOR_DIRECCION: string;

  // Cuadro resumen
  VALOR: string;
  LIBRANZA: string;
  CLASE: string;
  PORCENTAJE: string;
  DIAS: string;

  /** Se llena a mano en la audiencia; vacío al generar. */
  APODERADO: string;
}

/**
 * Escapa TODOS los valores string del ítem.
 *
 * Es el mismo principio safe-by-default que `escapeAllUnlessHtml` aplica al
 * `PlaceholderMap` plano, y hace falta por separado porque **`extraContext` no
 * pasa por ese escape**: `renderDocumentHtml` lo funde en el contexto tal cual
 * (`{...extraContext, ...placeholders}`), y `substituteVars` lo inserta en el
 * HTML sin más.
 *
 * Escapar el objeto entero —en vez de campo por campo al construirlo— es
 * deliberado: una clave nueva queda protegida sin que nadie se acuerde.
 */
function escapeContextItem<T extends object>(item: T): T {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      typeof value === 'string' ? escapePlaceholder(value) : value,
    ]),
  ) as T;
}

/**
 * Contexto de bloques para casos de INSOLVENCIA.
 *
 * Hermano de `buildConciliationContext`, con una diferencia de fondo: aquel lee
 * columnas `Json` de forma libre, y este lee **relaciones tipadas**, así que no
 * necesita validar la forma de lo que encuentra.
 *
 * Existe para que las plantillas de insolvencia puedan usar `{{#each}}` en vez
 * de slots numerados. Hoy los slots topan la lista: la Solicitud imprime 3
 * fichas de acreedor y 10 renglones de resumen, y un caso con más acreedores
 * —el tope legal son 150— radica un documento incompleto y sin aviso.
 *
 * Por ahora **ninguna plantilla lo consume**: se introduce primero para que el
 * cambio de infraestructura se pueda verificar solo (el golden master no se
 * mueve) y la migración de cada plantilla sea un PR aparte y reversible. Ver
 * `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`.
 */
export function buildInsolvencyContext(
  caseData: CaseWithRelations,
): Record<string, unknown> {
  const debts = caseData.debts ?? [];

  // Los totales se calculan UNA vez sobre la lista completa, no por ítem: el
  // porcentaje de cada acreedor depende de todos los demás. Son los mismos dos
  // acumuladores que usa `mapDebts`.
  const totalCapitalAll = debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  const acreedores: AcreedorContextItem[] = debts.map((debt, index) => {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const interest = Number(debt.interestAmount) || 0;
    const percentage =
      totalCapitalAll > 0
        ? ((capital / totalCapitalAll) * 100).toFixed(2)
        : '0.00';

    // Si el deudor declaró que no hay codeudor, los tres campos van 'N/A' en
    // lugar de vacíos: en un documento legal no es lo mismo "no aplica" que
    // "no se informó".
    const sinCodeudor = !!(debt as Record<string, unknown>).noCoDebtor;
    const codeudor = (value: string | null | undefined) =>
      sinCodeudor ? 'N/A' : value || '';

    return escapeContextItem<AcreedorContextItem>({
      NUMERO: String(index + 1),

      NOMBRE: debt.creditor.name,
      DOMICILIO: debt.creditorCity || '',
      DIRECCION: debt.creditorAddress || '',
      EMAIL: debt.creditorEmail || '',
      CAPITAL: formatCurrency(capital),
      INTERESES: formatCurrency(interest),
      POSTERGADO: boolToSiNo(debt.isDeferred),
      TASA:
        String(debt.interestRate) === 'DESCONOZCO'
          ? 'Desconoce'
          : `${Number(debt.interestRate) || 0}%`,
      DOCUMENTO: debt.documentType || '',
      FECHA_OTORGAMIENTO: formatShortDate(debt.grantDate),
      FECHA_VENCIMIENTO: formatShortDate(debt.dueDate),
      CLASIFICACION: debt.creditClassification || '',
      CODEUDOR_NOMBRE: codeudor(debt.coDebtorName),
      CODEUDOR_DOMICILIO: codeudor(debt.coDebtorCity),
      CODEUDOR_DIRECCION: codeudor(debt.coDebtorAddress),

      VALOR: formatCurrency(Number(debt.amount)),
      LIBRANZA: boolToSiNo(debt.hasActiveLibranza),
      CLASE: debt.creditorClass || '',
      // A diferencia del slot plano, el símbolo va siempre: la rama persistida
      // daba "33" y la calculada "33.00%" en el mismo documento.
      PORCENTAJE: debt.percentageOfTotal
        ? `${debt.percentageOfTotal}%`
        : `${percentage}%`,
      DIAS: debt.daysOverdue?.toString() || '',

      APODERADO: '',
    });
  });

  return {
    ACREEDORES: acreedores,
    // Bandera para `{{#if}}`: permite que la plantilla ponga una leyenda
    // ("no declara acreedores") en lugar de una tabla vacía.
    TIENE_ACREEDORES_LISTA: acreedores.length > 0,
  };
}

/**
 * Contexto de bloques que corresponde al tipo de caso.
 *
 * Único punto de decisión: antes el mismo ternario estaba repetido en los tres
 * sitios que renderizan (dos en `generate-documents.ts`, uno en `actions.ts`),
 * así que agregar un tipo obligaba a acordarse de los tres.
 *
 * Devuelve `undefined` cuando el tipo no aporta bloques, para que
 * `renderDocumentHtml` reciba exactamente lo que recibía antes.
 */
export function buildTemplateContext(
  caseData: CaseWithRelations,
): Record<string, unknown> | undefined {
  if (caseData.type === 'CONCILIATION')
    return buildConciliationContext(caseData);
  if (caseData.type === 'INSOLVENCY') return buildInsolvencyContext(caseData);
  return undefined;
}

/**
 * Main function to map all case data to placeholders
 */
export function mapCaseToPlaceholders(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const debtor = caseData.debtor;
  // Ensure all Decimal fields are converted to Number to prevent string concatenation in reduce()
  const monthlyIncome =
    Number(caseData.monthlyIncome) || Number(debtor.monthlyIncome) || 0;
  const monthlyExpenses =
    Number(caseData.monthlyExpenses) || Number(debtor.monthlyExpenses) || 0;
  const available = monthlyIncome - monthlyExpenses;
  const genderPrefix = getGenderPrefix(debtor.name);

  const basePlaceholders: PlaceholderMap = {
    // Debtor basic info
    NOMBRE_DEUDOR: debtor.name,
    NOMBRE_COMPLETO: debtor.name,
    NOMBRE_DEUDOR_COMPLETO: debtor.name,
    CEDULA_DEUDOR: debtor.idNumber,
    NUMERO_CEDULA: debtor.idNumber,
    DIRECCION_DEUDOR: debtor.address,
    CIUDAD_DEUDOR: debtor.city || '',
    EMAIL_DEUDOR: debtor.email,
    CORREO_ELECTRONICO: debtor.email,
    TELEFONO_DEUDOR: debtor.phone,
    NUMERO_TELEFONO: debtor.phone,
    MUNICIPIO_RESIDENCIA: debtor.city || caseData.city || 'Bogotá',
    GENERO_DEUDOR: genderPrefix,
    GENERO_APODERADO: 'del apoderado',

    // Case basic info
    RADICADO: caseData.caseNumber,
    NUMERO_RADICADO: caseData.caseNumber.replace(/[^0-9]/g, ''),
    NUMERO_TRAMITE: caseData.caseNumber,
    NUMERO_ACUERDO: caseData.caseNumber.replace(/[^0-9]/g, ''),
    ANO_ACUERDO: getYear(nowColombia()),
    DIA_ACUERDO: '____', // MANUAL - día del acuerdo
    MES_ACUERDO: '____________', // MANUAL - mes del acuerdo
    CIUDAD: debtor.city || caseData.city || 'Bogotá',
    NOMBRE_CONVOCANTE: debtor.name,

    // Dates - MANUAL: Estas fechas las ingresa el operador manualmente, no se auto-generan
    // Solo se muestran si ya fueron ingresadas por el operador
    FECHA_RADICACION: caseData.filingDate
      ? formatDate(caseData.filingDate)
      : '________________',
    FECHA_DESIGNACION: caseData.designationDate
      ? formatDate(caseData.designationDate)
      : '________________',
    FECHA_ACEPTACION: caseData.positionAcceptanceDate
      ? formatDate(caseData.positionAcceptanceDate)
      : '________________',
    FECHA_ADMISION: caseData.admissionDate
      ? formatDate(caseData.admissionDate)
      : '________________',
    FECHA_AUDIENCIA:
      caseData.firstHearingDate || caseData.hearingDate
        ? formatDate(caseData.firstHearingDate || caseData.hearingDate)
        : '________________',
    HORA_AUDIENCIA: caseData.firstHearingTime || '____:____',
    FECHA_HORA_AUDIENCIA:
      caseData.firstHearingDate || caseData.hearingDate
        ? `${formatDate(caseData.firstHearingDate || caseData.hearingDate)} - ${caseData.firstHearingTime || '____:____'}`
        : '________________',

    // Auto de admision (para Edicto Emplazatorio)
    DIA_AUTO: caseData.admissionDate
      ? getDayNumber(caseData.admissionDate)
      : '____',
    MES_AUTO: caseData.admissionDate
      ? getMonthName(caseData.admissionDate)
      : '____________',
    ANO_AUTO: caseData.admissionDate
      ? getYear(caseData.admissionDate)
      : '______',

    // Date components for current date
    NUMERO_DIA: getDayNumber(nowColombia()),
    NUMERO_DIA_LETRAS: getDayInWords(nowColombia()),
    NOMBRE_MES: getMonthName(nowColombia()),
    NUMERO_DIAS: '20', // Default days for verification

    // Next hearing placeholders
    DIA_PROXIMA: '',
    MES_PROXIMA: '',
    HORA_PROXIMA: '',

    // Zoom
    ZOOM_ID: caseData.zoomMeetingId || '',
    ZOOM_CODIGO: caseData.zoomPassword || '',
    ZOOM_LINK: caseData.zoomLink || '',
    ID_REUNION_ZOOM: caseData.zoomMeetingId || '',
    CODIGO_ACCESO_ZOOM: caseData.zoomPassword || '',

    // Audiencia
    NUMERO_AUDIENCIA: '1',

    // Audiencia — Objeciones (manual, filled per hearing)
    NOMBRE_ACREEDOR_OBJETANTE: '____________________',
    NOMBRE_ACREENCIA_OBJETADA: '____________________',
    FECHA_LIMITE_OBJETANTES: '____________________',
    FECHA_LIMITE_PRONUNCIAMIENTO: '____________________',
    CORRECCION_LEGALIDAD: '____________________',
    DESCRIPCION_ERROR_LEGALIDAD: '____________________',
    FECHA_SOLICITUD_AMPLIACION: '____________________',
    NOMBRE_COADYUVANTE: '____________________',
    NOMBRES_APODERADOS_ACREEDORES: '____________________',

    // Income/Expenses
    INGRESO_PRINCIPAL: formatCurrency(monthlyIncome),
    OTROS_INGRESOS_DETALLE:
      caseData.otherIncomeDescription || debtor.otherIncomeDescription || '',
    OTROS_INGRESOS_VALOR: formatCurrency(
      Number(caseData.otherIncomeAmount) ||
        Number(debtor.otherIncomeAmount) ||
        0,
    ),
    TOTAL_INGRESOS: formatCurrency(
      monthlyIncome +
        (Number(caseData.otherIncomeAmount) ||
          Number(debtor.otherIncomeAmount) ||
          0),
    ),
    CERTIFICACION_EMPLEADOR: boolToSiNo(
      caseData.hasEmployerCertification || debtor.hasEmployerCertification,
    ),
    GASTOS_MENSUALES: formatCurrency(monthlyExpenses),

    // Resources — must use TOTAL income (principal + otros), not just principal
    RECURSOS_INGRESOS: formatCurrency(
      monthlyIncome +
        (Number(caseData.otherIncomeAmount) ||
          Number(debtor.otherIncomeAmount) ||
          0),
    ),
    RECURSOS_GASTOS: formatCurrency(monthlyExpenses),
    RECURSOS_DISPONIBLE: formatCurrency(
      monthlyIncome +
        (Number(caseData.otherIncomeAmount) ||
          Number(debtor.otherIncomeAmount) ||
          0) -
        monthlyExpenses,
    ),

    // Spouse
    CONYUGE_NOMBRE: caseData.spouseName || '',
    CONYUGE_CC: caseData.spouseIdNumber || '',
    CONYUGE_DIRECCION: caseData.spouseAddress || '',
    CONYUGE_TELEFONO: caseData.spousePhone || '',
    CONYUGE_EMAIL: caseData.spouseEmail || '',

    // Notifications
    NOTIF_DIRECCION: caseData.notificationAddress || debtor.address,
    NOTIF_TELEFONO: caseData.notificationPhone || debtor.phone,
    NOTIF_EMAIL: caseData.notificationEmail || debtor.email,
    EMAIL_NOTIFICACIONES: caseData.notificationEmail || debtor.email,

    // Operator (null-safe)
    NOMBRE_OPERADOR: caseData.operator?.name || '',
    EMAIL_OPERADOR: caseData.operator?.email || '',

    // Legal attorney placeholders (to be filled if applicable)
    NOMBRE_ABOGADO: '',
    CEDULA_ABOGADO: '',
    TARJETA_PROFESIONAL: '',
    NOMBRE_PERSONA: '',
    DESCRIPCION_PRUEBAS: '',

    // Agreement specific - MANUAL: Solo mostrar si ya fueron ingresadas
    DIA_ACEPTACION: caseData.admissionDate
      ? getDayNumber(caseData.admissionDate)
      : '____',
    MES_ACEPTACION: caseData.admissionDate
      ? getMonthName(caseData.admissionDate)
      : '____________',
    ANO_ACEPTACION: caseData.admissionDate
      ? new Date(caseData.admissionDate).getFullYear().toString()
      : '______',
    DIA_AUDIENCIA:
      caseData.firstHearingDate || caseData.hearingDate
        ? getDayNumber(caseData.firstHearingDate || caseData.hearingDate)
        : '____',
    MES_AUDIENCIA:
      caseData.firstHearingDate || caseData.hearingDate
        ? getMonthName(caseData.firstHearingDate || caseData.hearingDate)
        : '____________',
    ANO_AUDIENCIA:
      caseData.firstHearingDate || caseData.hearingDate
        ? new Date(caseData.firstHearingDate || caseData.hearingDate!)
            .getFullYear()
            .toString()
        : '______',

    // Payment terms - Ahora con campos de BD
    NUMERO_MESES: caseData.paymentTermMonths?.toString() || '____',
    DIA_INICIO_PAGO: caseData.paymentStartDate
      ? getDayNumber(caseData.paymentStartDate)
      : '____',
    MES_INICIO_PAGO: caseData.paymentStartDate
      ? getMonthName(caseData.paymentStartDate)
      : '____________',
    ANO_INICIO_PAGO: caseData.paymentStartDate
      ? getYear(caseData.paymentStartDate)
      : '______',
    FECHA_INICIO_PAGO: caseData.paymentStartDate
      ? formatDate(caseData.paymentStartDate)
      : '________________',
    DIA_VIGENCIA: caseData.agreementValidityDate
      ? getDayNumber(caseData.agreementValidityDate)
      : '____',
    MES_VIGENCIA: caseData.agreementValidityDate
      ? getMonthName(caseData.agreementValidityDate)
      : '____________',
    ANO_VIGENCIA: caseData.agreementValidityDate
      ? getYear(caseData.agreementValidityDate)
      : '______',
    FECHA_VIGENCIA: caseData.agreementValidityDate
      ? formatDate(caseData.agreementValidityDate)
      : '________________',
    PORCENTAJE_APROBACION: caseData.approvalPercentage?.toString() || '____',

    // Aliases for Reforma Acuerdo and Acuerdo Bilateral templates
    NOMBRE_ACREEDOR:
      caseData.debts?.[0]?.creditor?.name || '________________________________',
    // Representante del acreedor que reporta el incumplimiento (mismo acreedor
    // que NOMBRE_ACREEDOR) — no confundir con NOMBRE_REPRESENTANTE_LEGAL, que es
    // el representante legal de una parte en conciliación (otro dato).
    NOMBRE_REPRESENTANTE:
      caseData.debts?.[0]?.creditor?.representative ||
      '________________________________',
    NUMERO_CUOTAS: caseData.paymentTermMonths?.toString() || '____',
    PORCENTAJE_RECONOCIMIENTO:
      caseData.approvalPercentage?.toString() || '____',
    DIA_INICIO: caseData.paymentStartDate
      ? getDayNumber(caseData.paymentStartDate)
      : '____',
    MES_INICIO: caseData.paymentStartDate
      ? getMonthName(caseData.paymentStartDate)
      : '____________',
    ANO_INICIO: caseData.paymentStartDate
      ? getYear(caseData.paymentStartDate)
      : '______',

    // Control de Legalidad - MANUAL
    FECHA_CONTROL_LEGALIDAD: '________________', // MANUAL
    LUGAR_CONTROL_LEGALIDAD: '________________________________', // MANUAL
    HECHO_1: '', // MANUAL - durante audiencia
    HECHO_2: '', // MANUAL - durante audiencia
    HECHO_3: '', // MANUAL - durante audiencia

    // Sentido del Voto - MANUAL (formulario independiente para acreedores)
    VOTACION: '', // MANUAL - SI/NO
    FORMA_PAGO_VOTANTE: '', // MANUAL
    NUMERO_CUOTAS_VOTANTE: '', // MANUAL
    VALOR_CUOTA_VOTANTE: '', // MANUAL
    OBSERVACIONES_VOTANTE: '', // MANUAL
    FIRMA_VOTANTE: '', // MANUAL
    NOMBRE_VOTANTE: '', // MANUAL
    CEDULA_VOTANTE: '', // MANUAL
    ENTIDAD_REPRESENTADA: '', // MANUAL
    FECHA_DOCUMENTO_VOTO: '', // MANUAL

    // Información del Juez - MANUAL (para suspensión de procesos)
    NOMBRE_JUEZ: '', // MANUAL
    CARGO_JUEZ: '', // MANUAL

    // Bienes declaration
    DECLARACION_BIENES:
      caseData.assets.length > 0
        ? 'que posee los siguientes bienes:'
        : 'que no posee bienes a su nombre.',
    DETALLE_BIENES: '',

    // Placeholders for tables (to be filled dynamically)
    CUADRO_CALIFICACION_GRADUACION: '',
    DETALLE_PAGO_CAPITAL: '',
    FORMA_PAGO_ACREEDORES: '',
    PROYECCION_PAGOS: '',

    // Signature and current year
    DIA_FIRMA: getDayNumber(nowColombia()),
    MES_FIRMA: getMonthName(nowColombia()),
    ANO_FIRMA: getYear(nowColombia()),
    ANO_ACTUAL: getYear(nowColombia()),
  };

  // Build dynamic anexos list — only documents actually uploaded (not auto-generated)
  const uploadedDocs = (caseData.documents || []).filter((d) => !d.isGenerated);
  const listaAnexos =
    uploadedDocs.length > 0
      ? uploadedDocs
          .map((d) => `<li>${escapePlaceholder(d.name)}</li>`)
          .join('\n            ')
      : '<li>No se han adjuntado documentos aún</li>';

  // Merge all mappings.
  // escapeAllUnlessHtml escapa TODO valor string salvo la allowlist de HTML
  // del sistema — punto único de defensa contra inyección HTML/XSS.
  return escapeAllUnlessHtml({
    ...basePlaceholders,
    LISTA_ANEXOS: listaAnexos,
    ...mapApplicantScope(caseData.applicantScope || []),
    ...mapCauses(
      caseData.causes || [],
      (caseData as Record<string, unknown>).otherCauseDetail as string,
    ),
    ...mapDebts(caseData.debts || []),
    ...mapAssets(caseData.assets || []),
    ...mapLegalProcesses(caseData.legalProcesses),
    ...mapLibranzas(caseData.libranzas),
    ...mapSuspendedServices(caseData.suspendedServices),
    ...mapDependents(caseData.dependents),
    ...mapPaymentProposal(caseData),
    // New mappings added from audit
    ...mapCheckList(caseData),
    ...mapIncomeDeclaration(caseData),
    ...mapExtendedDates(caseData),
    ...mapExternalEntities(caseData),
    ...mapAgreementResult(caseData),
    ...mapDynamicTables(caseData),
    // Fracaso and audiencia specific mappings
    ...mapFracasoVariables(caseData),
    ...mapSentidoVotoVariables(caseData),
    // Conciliation-specific placeholders (only relevant for CONCILIATION cases)
    ...(caseData.type === 'CONCILIATION'
      ? mapConciliationFields(caseData)
      : {}),
    // Support agreement placeholders (only relevant for SUPPORT_AGREEMENT cases)
    ...(caseData.type === 'SUPPORT_AGREEMENT' ? mapApoyoFields(caseData) : {}),
  });
}

/** Un `{{VARIABLE}}` suelto. No matchea los tags de bloque, que llevan `#` o `/`. */
const VAR_TOKEN_RE = /\{\{([A-Za-z0-9_]+)\}\}/g;

/**
 * Bloques `{{#if}}` / `{{#unless}}` / `{{#each}}` con su contenido.
 *
 * La sintaxis real (handlebars-lite.ts) siempre lleva DOS tokens en el tag de
 * apertura —`{{#if FLAG}}`, `{{#each LISTA}}`— nunca uno solo. El cierre puede
 * venir con o sin el identificador repetido (`{{/if}}` o `{{/if FLAG}}`, este
 * último es el que usan las plantillas de conciliación). El backreference `\1`
 * exige que abra y cierre el mismo tipo de bloque.
 */
const BLOCK_RE =
  /\{\{#(if|each|unless)\s+[A-Za-z0-9_]+\s*\}\}((?:(?!\{\{#(?:if|each|unless)\b)[\s\S])*?)\{\{\/\1(?:\s+[A-Za-z0-9_]+)?\s*\}\}/g;

/**
 * Quita del HTML los bloques de control con todo su contenido, y devuelve lo
 * que queda: las variables de nivel raíz.
 *
 * Existe porque las variables de adentro de un bloque NO se resuelven contra el
 * contexto raíz sino contra el scope del bloque (el item del `{{#each}}`), así
 * que cualquier análisis que las cuente como variables del mapper da falsos
 * positivos. Los dos análisis que hay lo necesitan: el detector de placeholders
 * sin resolver de `renderDocumentHtml` —que BLOQUEA la generación— y
 * `validatePlaceholderCoverage`.
 *
 * Igual que `resolveBlocks` de handlebars-lite, se aplica en pasadas hasta
 * estabilizar: cada pasada solo puede quitar el bloque MÁS interno (la negative
 * lookahead evita que `[\s\S]*?` se coma un `{{#if/each/unless` anidado), así
 * que los anidados se pelan de adentro hacia afuera.
 *
 * Los tags envueltos en comentarios HTML (`<!-- {{#each X}} -->`, el patrón que
 * usan las plantillas de conciliación para seguir siendo HTML válido sin
 * renderizar) se manejan solos: el regex matchea el tag y deja los `<!--` y
 * `-->` sueltos como texto, que no contienen placeholders.
 */
function stripBlocks(html: string): string {
  let out = html;
  // Cota de seguridad, igual que en handlebars-lite: evita un bucle infinito
  // ante una plantilla mal formada.
  for (let pass = 0; pass < 32; pass++) {
    const before = out;
    out = out.replace(BLOCK_RE, '');
    if (out === before) break;
  }
  return out;
}

export interface RenderedDocument {
  html: string;
  /**
   * Placeholders `{{VAR}}` que el HTML referencia y que el mapper NO produce
   * en absoluto. Son un desajuste real plantilla↔mapper, no un campo opcional
   * vacío: el documento saldría con un hueco silencioso.
   */
  unresolved: string[];
}

/**
 * Renderiza la plantilla e informa de los placeholders que quedaron sin
 * resolver (C-3).
 *
 * Antes, `replacePlaceholders` borraba en silencio todo `{{VAR}}` que el
 * contexto no cubriera. Un documento legal salía con campos en blanco —o con
 * filas de tabla desaparecidas— visualmente indistinguible de uno correcto, se
 * radicaba, y el defecto aparecía en la audiencia.
 *
 * Distinción que hace esta función, y que es la clave del arreglo:
 *  - placeholder **conocido por el mapper con valor vacío** → campo opcional
 *    legítimo; se sigue vaciando y la fila vacía se sigue limpiando (no cambia
 *    el render de las plantillas existentes).
 *  - placeholder **ausente del mapper** → se reporta en `unresolved` para que
 *    el llamador BLOQUEE la generación, y en el HTML se deja un marcador
 *    visible en lugar de la nada, por si algún camino se saltara el bloqueo.
 */
export function renderDocumentHtml(
  html: string,
  placeholders: PlaceholderMap,
  extraContext?: Record<string, unknown>,
): RenderedDocument {
  // handlebars-lite takes a merged context (strings + flags + arrays).
  // For legacy insolvency templates with no {{#...}} tokens, the engine
  // short-circuits to plain substitution, preserving byte-for-byte output.
  const ctx: Record<string, unknown> = {
    ...(extraContext ?? {}),
    ...placeholders,
  };

  // El detector va ANTES del render: `substituteVars` de handlebars-lite ya
  // sustituye por '' toda variable ausente del contexto (handlebars-lite.ts:62),
  // así que escanear el HTML ya renderizado no encontraría nada. Hay que
  // comparar contra la fuente.
  //
  // `stripBlocks` saca las variables que están dentro de un bloque: esas se
  // resuelven contra el scope del bloque, no contra el contexto raíz.
  const referenced = new Set(
    [...stripBlocks(html).matchAll(VAR_TOKEN_RE)].map((m) => m[1]),
  );
  const unresolved = [...referenced].filter((name) => !(name in ctx));

  // Marcador visible en lugar del hueco silencioso, por si algún camino se
  // saltara el bloqueo del llamador.
  const ctxWithMarkers: Record<string, unknown> = { ...ctx };
  for (const name of unresolved) {
    ctxWithMarkers[name] = `«FALTA: ${name}»`;
  }

  let result = renderTemplate(html, ctxWithMarkers);

  // Remove empty table rows: <tr> where all <td> content is empty after placeholder replacement
  result = result.replace(/<tr>\s*(?:<td[^>]*>\s*<\/td>\s*)+<\/tr>/g, '');

  // Remove empty summary/creditor table rows (rows with only label and empty value)
  result = result.replace(
    /<tr>\s*<td[^>]*class="label-td"[^>]*>[^<]*<\/td>\s*<td>\s*<\/td>\s*<\/tr>/g,
    '',
  );

  return { html: result, unresolved };
}

/**
 * @deprecated Descarta el informe de placeholders sin resolver. Usar
 * `renderDocumentHtml` y bloquear la generación si `unresolved` no está vacío.
 */
export function replacePlaceholders(
  html: string,
  placeholders: PlaceholderMap,
  extraContext?: Record<string, unknown>,
): string {
  return renderDocumentHtml(html, placeholders, extraContext).html;
}

/**
 * Validation result for placeholder coverage
 */
export interface PlaceholderCoverageResult {
  /** Whether all placeholders are covered with non-empty values */
  complete: boolean;
  /** Total number of placeholders found in the HTML */
  totalPlaceholders: number;
  /** Number of placeholders with values */
  coveredCount: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Placeholders that exist in HTML but not in the mapper */
  missing: string[];
  /** Placeholders that exist in mapper but have empty/placeholder values */
  empty: string[];
  /** Placeholders that have actual data values */
  filled: string[];
}

/**
 * Validates that all variables in the HTML template have values in the mapper
 * @param html - The HTML template content
 * @param placeholders - The mapped placeholders
 * @returns Validation result with coverage statistics
 */
export function validatePlaceholderCoverage(
  html: string,
  placeholders: PlaceholderMap,
): PlaceholderCoverageResult {
  // Las variables de dentro de un bloque se resuelven contra el scope del
  // bloque, no contra el mapper: contarlas acá daba faltantes falsos y hundía
  // el porcentaje de cobertura. Con una plantilla de conciliación típica el
  // resultado era un `logger.warn` de "cobertura baja" en cada generación,
  // sobre un documento que salía perfecto.
  const matches = [...stripBlocks(html).matchAll(VAR_TOKEN_RE)];
  const foundVariables = [...new Set(matches.map((m) => m[1]))]; // Unique variables

  // Categorize variables
  const missing: string[] = [];
  const empty: string[] = [];
  const filled: string[] = [];

  // Values that indicate a manual/empty placeholder
  const emptyIndicators = [
    '',
    '____',
    '______',
    '____________',
    '________________',
    '________________________________',
    'N/A',
    '____:____',
  ];

  for (const variable of foundVariables) {
    if (!(variable in placeholders)) {
      // Variable not found in mapper at all
      missing.push(variable);
    } else {
      const value = placeholders[variable];
      if (!value || emptyIndicators.includes(value.trim())) {
        // Variable exists but has empty or placeholder value
        empty.push(variable);
      } else {
        // Variable has actual data
        filled.push(variable);
      }
    }
  }

  const totalPlaceholders = foundVariables.length;
  const coveredCount = filled.length;
  const coveragePercentage =
    totalPlaceholders > 0
      ? Math.round((coveredCount / totalPlaceholders) * 100)
      : 100;

  return {
    complete: missing.length === 0 && empty.length === 0,
    totalPlaceholders,
    coveredCount,
    coveragePercentage,
    missing,
    empty,
    filled,
  };
}

/**
 * Get a summary report of placeholder coverage for debugging
 * @param html - The HTML template content
 * @param placeholders - The mapped placeholders
 * @returns Formatted string report
 */
export function getPlaceholderCoverageReport(
  html: string,
  placeholders: PlaceholderMap,
): string {
  const result = validatePlaceholderCoverage(html, placeholders);

  let report = `\n=== Placeholder Coverage Report ===\n`;
  report += `Coverage: ${result.coveragePercentage}% (${result.coveredCount}/${result.totalPlaceholders})\n`;
  report += `Status: ${result.complete ? '✅ COMPLETE' : '⚠️ INCOMPLETE'}\n\n`;

  if (result.missing.length > 0) {
    report += `❌ Missing (${result.missing.length}):\n`;
    result.missing.forEach((v) => (report += `   - ${v}\n`));
    report += '\n';
  }

  if (result.empty.length > 0) {
    report += `⚪ Empty/Manual (${result.empty.length}):\n`;
    result.empty.forEach((v) => (report += `   - ${v}\n`));
    report += '\n';
  }

  if (result.filled.length > 0 && result.filled.length <= 20) {
    report += `✅ Filled (${result.filled.length}):\n`;
    result.filled.forEach(
      (v) =>
        (report += `   - ${v}: "${placeholders[v]?.substring(0, 50)}${(placeholders[v]?.length || 0) > 50 ? '...' : ''}"\n`),
    );
  } else if (result.filled.length > 20) {
    report += `✅ Filled: ${result.filled.length} variables (not listing all)\n`;
  }

  return report;
}
