/**
 * Placeholder Mapper for Document Generation
 * Maps case data to HTML template placeholders
 */

import type { CaseWithRelations } from '../case/schemas';

// Type for the mapped placeholders
export type PlaceholderMap = Record<string, string>;

// Helper to format currency
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper to format date
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// Helper to format short date
function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Helper to get day number
function getDayNumber(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.getDate().toString();
}

// Helper to get day in words
function getDayInWords(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate();
  const words = [
    '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
    'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho',
    'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro',
    'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'treinta y uno',
  ];
  return words[day] || day.toString();
}

// Helper to get month name
function getMonthName(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('es-CO', { month: 'long' });
}

// Helper to get year
function getYear(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.getFullYear().toString();
}

// Helper for complete date in words
function formatDateComplete(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString('es-CO', { month: 'long' });
  const year = d.getFullYear();
  return `${day} de ${month} de ${year}`;
}

// Helper for SI/NO values
function boolToSiNo(value: boolean | null | undefined): string {
  return value ? 'SI' : 'NO';
}

// Helper to get gender prefix
function getGenderPrefix(name: string): string {
  // Simple heuristic - names ending in 'a' are typically female in Spanish
  const lowerName = name.toLowerCase().trim();
  const femaleEndings = ['a', 'ia', 'ita'];
  for (const ending of femaleEndings) {
    if (lowerName.endsWith(ending)) {
      return 'La señora';
    }
  }
  return 'El señor';
}

// Map causes to individual placeholders
function mapCauses(causes: string[]): PlaceholderMap {
  const causeLabels = [
    'SOBREENDEUDAMIENTO POR FALTA DE RECURSOS',
    'PERDIDA DE EMPLEO',
    'DIVORCIO',
    'ENFERMEDAD',
    'ACCIDENTE',
    'ESTAFA',
    'DISMINUCIÓN DE INGRESOS',
    'FALTA DE EDUCACIÓN FINANCIERA Y MALOS HÁBITOS FINANCIEROS',
    'MUERTE DE CÓNYUGE',
    'ACUDÍ A NUEVOS CRÉDITOS PARA CUBRIR OTROS',
    'MALA INVERSIÓN',
    'OTROS',
  ];

  const result: PlaceholderMap = {};
  for (let i = 0; i < 12; i++) {
    const causeKey = `CAUSA_${i + 1}`;
    result[causeKey] = causes.includes(causeLabels[i]) ? 'SI' : 'NO';
  }
  result['CAUSA_12_DETALLE'] = causes.find(c => !causeLabels.includes(c)) || '';
  return result;
}

// Map applicant scope
function mapApplicantScope(scope: string[]): PlaceholderMap {
  return {
    APLICACION_NO_COMERCIANTE: scope.includes('PERSONA_NATURAL_NO_COMERCIANTE') ? 'SI' : 'NO',
    APLICACION_PEQUENA_COMERCIANTE: scope.includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE') ? 'SI' : 'NO',
  };
}

// Map debts (creditors) to placeholders
function mapDebts(debts: CaseWithRelations['debts']): PlaceholderMap {
  const result: PlaceholderMap = {};

  // Summary table (up to 10 creditors)
  for (let i = 0; i < 10; i++) {
    const debt = debts[i];
    const idx = i + 1;

    if (debt) {
      result[`ACREEDOR_${idx}`] = debt.creditor.name;
      result[`VALOR_${idx}`] = formatCurrency(debt.amount);
      result[`LIBRANZA_${idx}`] = boolToSiNo(debt.hasActiveLibranza);
      result[`CLASE_${idx}`] = debt.creditorClass || '';
      result[`PORCENTAJE_${idx}`] = debt.percentageOfTotal?.toString() || '';
      result[`DIAS_${idx}`] = debt.daysOverdue?.toString() || '';
    } else {
      result[`ACREEDOR_${idx}`] = '';
      result[`VALOR_${idx}`] = '';
      result[`LIBRANZA_${idx}`] = '';
      result[`CLASE_${idx}`] = '';
      result[`PORCENTAJE_${idx}`] = '';
      result[`DIAS_${idx}`] = '';
    }
  }

  // Detailed creditor info (AC1, AC2, AC3, etc.)
  for (let i = 0; i < Math.min(debts.length, 10); i++) {
    const debt = debts[i];
    const idx = i + 1;

    result[`AC${idx}_NOMBRE`] = debt.creditor.name;
    result[`AC${idx}_DOMICILIO`] = debt.creditorCity || '';
    result[`AC${idx}_DIRECCION`] = debt.creditorAddress || '';
    result[`AC${idx}_EMAIL`] = debt.creditorEmail || '';
    result[`AC${idx}_CAPITAL`] = formatCurrency(debt.capitalAmount);
    result[`AC${idx}_INTERESES`] = formatCurrency(debt.interestAmount);
    result[`AC${idx}_POSTERGADO`] = boolToSiNo(debt.isDeferred);
    result[`AC${idx}_TASA`] = `${debt.interestRate}%`;
    result[`AC${idx}_DOCUMENTO`] = debt.documentType || '';
    result[`AC${idx}_FECHA_OTORGAMIENTO`] = formatShortDate(debt.grantDate);
    result[`AC${idx}_FECHA_VENCIMIENTO`] = formatShortDate(debt.dueDate);
    result[`AC${idx}_CLASIFICACION`] = debt.creditClassification || '';
    result[`AC${idx}_CODEUDOR_NOMBRE`] = debt.coDebtorName || '';
    result[`AC${idx}_CODEUDOR_DOMICILIO`] = debt.coDebtorCity || '';
    result[`AC${idx}_CODEUDOR_DIRECCION`] = debt.coDebtorAddress || '';
  }

  // Total
  const totalDebt = debts.reduce((sum, d) => sum + (d.amount || 0), 0);
  result['TOTAL_ACREENCIAS'] = formatCurrency(totalDebt);

  return result;
}

// Map assets to placeholders
function mapAssets(assets: CaseWithRelations['assets']): PlaceholderMap {
  const result: PlaceholderMap = {};

  // Separate real estate from personal property
  const realEstate = assets.filter(a => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE');
  const personalProperty = assets.filter(a => a.type !== 'INMUEBLE' && a.type !== 'REAL_ESTATE');

  // Real estate (first one)
  const immueble = realEstate[0];
  if (immueble) {
    result['INMUEBLE_TIPO'] = immueble.propertyType || immueble.name || '';
    result['INMUEBLE_DIRECCION'] = immueble.address || '';
    result['INMUEBLE_MATRICULA'] = immueble.registrationNumber || '';
    result['INMUEBLE_VALOR'] = formatCurrency(immueble.value);
    result['INMUEBLE_GRAVAMEN'] = immueble.encumbrance || '';
    result['INMUEBLE_AFECTACION'] = immueble.affectation || '';
    result['INMUEBLE_MEDIDA'] = immueble.precautionaryMeasure || '';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = boolToSiNo(immueble.isFamilyHome);
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = boolToSiNo(immueble.isInalienablePatrimony);
    result['INMUEBLE_DOCUMENTO'] = immueble.proofDocument || '';
  } else {
    result['INMUEBLE_TIPO'] = 'N/A';
    result['INMUEBLE_DIRECCION'] = 'N/A';
    result['INMUEBLE_MATRICULA'] = 'N/A';
    result['INMUEBLE_VALOR'] = 'N/A';
    result['INMUEBLE_GRAVAMEN'] = 'N/A';
    result['INMUEBLE_AFECTACION'] = 'N/A';
    result['INMUEBLE_MEDIDA'] = 'N/A';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = 'N/A';
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = 'N/A';
    result['INMUEBLE_DOCUMENTO'] = 'N/A';
  }

  // Personal property by category
  const findAssetByType = (types: string[]) =>
    personalProperty.find(a => types.some(t => a.type?.toLowerCase().includes(t.toLowerCase())));

  const electronics = findAssetByType(['electronico', 'electronic', 'electrodomestico']);
  const furniture = findAssetByType(['mueble', 'enseres', 'furniture']);
  const vehicle = findAssetByType(['vehiculo', 'vehicle', 'carro', 'moto']);
  const jewelry = findAssetByType(['joya', 'jewelry']);
  const cash = findAssetByType(['efectivo', 'cash', 'dinero']);
  const stocks = findAssetByType(['accion', 'stock', 'inversion']);
  const receivables = findAssetByType(['cuenta', 'receivable', 'cobrar']);

  result['MUEBLE_ELECTRONICO_DESC'] = electronics?.description || electronics?.name || 'N/A';
  result['MUEBLE_ELECTRONICO_VALOR'] = electronics ? formatCurrency(electronics.value) : 'N/A';
  result['MUEBLE_ENSERES_DESC'] = furniture?.description || furniture?.name || 'N/A';
  result['MUEBLE_ENSERES_VALOR'] = furniture ? formatCurrency(furniture.value) : 'N/A';
  result['MUEBLE_VEHICULO_DESC'] = vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''} - ${vehicle.licensePlate || ''}`.trim() : 'N/A';
  result['MUEBLE_VEHICULO_VALOR'] = vehicle ? formatCurrency(vehicle.value) : 'N/A';
  result['MUEBLE_JOYAS_DESC'] = jewelry?.description || jewelry?.name || 'N/A';
  result['MUEBLE_JOYAS_VALOR'] = jewelry ? formatCurrency(jewelry.value) : 'N/A';
  result['MUEBLE_EFECTIVO_DESC'] = cash?.description || 'N/A';
  result['MUEBLE_EFECTIVO_VALOR'] = cash ? formatCurrency(cash.value) : 'N/A';
  result['MUEBLE_ACCIONES_DESC'] = stocks?.description || stocks?.name || 'N/A';
  result['MUEBLE_ACCIONES_VALOR'] = stocks ? formatCurrency(stocks.value) : 'N/A';
  result['MUEBLE_CUENTAS_DESC'] = receivables?.description || receivables?.name || 'N/A';
  result['MUEBLE_CUENTAS_VALOR'] = receivables ? formatCurrency(receivables.value) : 'N/A';

  // Totals
  const totalRealEstate = realEstate.reduce((sum, a) => sum + (a.value || 0), 0);
  const totalPersonal = personalProperty.reduce((sum, a) => sum + (a.value || 0), 0);
  result['TOTAL_INMUEBLES'] = formatCurrency(totalRealEstate);
  result['TOTAL_MUEBLES'] = formatCurrency(totalPersonal);
  result['TOTAL_BIENES'] = formatCurrency(totalRealEstate + totalPersonal);

  return result;
}

// Map legal processes
function mapLegalProcesses(processes: CaseWithRelations['legalProcesses']): PlaceholderMap {
  const result: PlaceholderMap = {};

  for (let i = 0; i < 5; i++) {
    const process = processes?.[i];
    const idx = i + 1;

    if (process) {
      result[`PROCESO_${idx}_TIPO`] = process.processType || '';
      result[`PROCESO_${idx}_DEMANDANTE`] = process.plaintiff || '';
      result[`PROCESO_${idx}_JUZGADO`] = process.court || '';
      result[`PROCESO_${idx}_EXPEDIENTE`] = process.fileNumber || '';
      result[`PROCESO_${idx}_MEDIDA`] = process.precautionaryMeasure || '';
    } else {
      result[`PROCESO_${idx}_TIPO`] = 'N/A';
      result[`PROCESO_${idx}_DEMANDANTE`] = 'N/A';
      result[`PROCESO_${idx}_JUZGADO`] = 'N/A';
      result[`PROCESO_${idx}_EXPEDIENTE`] = 'N/A';
      result[`PROCESO_${idx}_MEDIDA`] = 'N/A';
    }
  }

  return result;
}

// Map libranzas
function mapLibranzas(libranzas: CaseWithRelations['libranzas']): PlaceholderMap {
  const lib = libranzas?.[0];
  return {
    LIBRANZA_PAGADOR: lib?.payerName || 'N/A',
    LIBRANZA_DIRECCION: lib?.payerAddress || 'N/A',
    LIBRANZA_EMAIL: lib?.payerEmail || 'N/A',
    LIBRANZA_TELEFONO: lib?.payerPhone || 'N/A',
    LIBRANZA_SUMA: lib ? formatCurrency(lib.deductedAmount) : 'N/A',
    LIBRANZA_PRODUCTO: lib?.productAndCreditor || 'N/A',
  };
}

// Map suspended services
function mapSuspendedServices(services: CaseWithRelations['suspendedServices']): PlaceholderMap {
  const svc = services?.[0];
  return {
    SERVICIOS_ACREEDOR: svc?.creditorName || 'N/A',
    SERVICIOS_DIRECCION: svc?.address || 'N/A',
    SERVICIOS_EMAIL: svc?.email || 'N/A',
    SERVICIOS_TELEFONO: svc?.phone || 'N/A',
    SERVICIOS_PRODUCTO: svc?.suspendedProduct || 'N/A',
    SERVICIOS_VALOR: svc ? formatCurrency(svc.amountOwed) : 'N/A',
  };
}

// Map dependents (alimentary obligations)
function mapDependents(dependents: CaseWithRelations['dependents']): PlaceholderMap {
  const result: PlaceholderMap = {};

  for (let i = 0; i < 5; i++) {
    const dep = dependents?.[i];
    const idx = i + 1;

    result[`OBL_ALIM_${idx}_NOMBRE`] = dep?.name || '';
    result[`OBL_ALIM_${idx}_EDAD`] = dep?.age?.toString() || '';
    result[`OBL_ALIM_${idx}_PARENTESCO`] = dep?.relationship || '';
  }

  return result;
}

// Map check list variables (SI/NO validations)
function mapCheckList(caseData: CaseWithRelations): PlaceholderMap {
  const debtor = caseData.debtor;
  const totalDebt = caseData.debts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const SMMLV = 1300000; // Salario mínimo 2025 Colombia

  // Calculate total assets value
  const totalAssets = caseData.assets.reduce((sum, a) => sum + (a.value || 0), 0);

  const hasCreditors = caseData.debts.length > 0;
  const hasAssets = caseData.assets.length > 0;
  const hasIncome = (caseData.monthlyIncome || debtor.monthlyIncome || 0) > 0;
  const hasCauses = (caseData.causes || []).length > 0;
  const hasProposal = caseData.paymentTermMonths != null && caseData.paymentTermMonths > 0;
  const hasAlimentaryObligations = (caseData.dependents || []).length > 0;
  const hasLegalProcesses = (caseData.legalProcesses || []).length > 0;
  const isSmallMerchant = (caseData.applicantScope || []).includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE');
  const hasSpouse = !!caseData.spouseName;
  const hasAttorney = false; // TODO: Add attorney field to case model
  const moreThan150Creditors = caseData.debts.length > 150;
  const lessThan40SMMLV = totalDebt < (40 * SMMLV);
  const moreThan150SMMLV = totalDebt > (150 * SMMLV);

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

    // SMMLV reference
    SMMLV_VALOR: formatCurrency(SMMLV),
  };
}

// Map certificate of income variables (Certificado de Ingresos)
function mapIncomeDeclaration(caseData: CaseWithRelations): PlaceholderMap {
  const debtor = caseData.debtor;
  const monthlyIncome = caseData.monthlyIncome || debtor.monthlyIncome || 0;

  return {
    NOMBRE_DECLARANTE: debtor.name,
    CEDULA_DECLARANTE: debtor.idNumber,
    CIUDAD_DOMICILIO: debtor.city || caseData.city || '',
    CORREO_DECLARANTE: debtor.email,
    TELEFONO_DECLARANTE: debtor.phone,
    ACTIVIDAD_ECONOMICA: debtor.occupation || 'No especificada',
    INGRESO_MENSUAL: formatCurrency(monthlyIncome),
  };
}

// Map additional date variables (ANO_*, DIA_*, MES_*)
function mapExtendedDates(caseData: CaseWithRelations): PlaceholderMap {
  const now = new Date();
  const filingDate = caseData.filingDate ? new Date(caseData.filingDate) : null;

  return {
    // Year variables
    ANO: getYear(now),
    ANO_RADICADO: getYear(filingDate) || getYear(now),
    ANO_TRAMITE: getYear(filingDate) || getYear(now),
    ANO_CONSTANCIA: getYear(now),
    ANO_BILATERAL: getYear(now),
    ANO_FRACASO: getYear(now),
    ANO_DESISTIMIENTO: getYear(now),
    ANO_INICIO_PAGO: '', // Manual - post-agreement
    ANO_VIGENCIA: '', // Manual - post-agreement

    // Day variables
    DIA: getDayNumber(now),
    DIA_DESISTIMIENTO: '', // Manual
    DIA_FRACASO: '', // Manual

    // Month variables
    MES: getMonthName(now),
    MES_DESISTIMIENTO: '', // Manual
    MES_FRACASO: '', // Manual

    // Complete date
    FECHA_COMPLETA: formatDateComplete(now),

    // Constancia
    NUMERO_CONSTANCIA: caseData.caseNumber || '',
  };
}

// Map external entities (judges, plaintiffs, etc.)
function mapExternalEntities(caseData: CaseWithRelations): PlaceholderMap {
  // Get first legal process if exists
  const firstProcess = caseData.legalProcesses?.[0];

  // Get first libranza if exists
  const firstLibranza = caseData.libranzas?.[0];

  return {
    // Judge information (Manual - filled during suspension)
    NOMBRE_JUZGADO: firstProcess?.court || '',
    NUMERO_JUZGADO: firstProcess?.fileNumber || '',
    NOMBRE_DEMANDANTE: firstProcess?.plaintiff || '',
    TIPO_PROCESO: firstProcess?.processType || '',

    // Payer entity (from libranzas)
    NOMBRE_ENTIDAD_PAGADORA: firstLibranza?.payerName || '',

    // Bilateral agreement (Manual)
    RADICADO_BILATERAL: '',
  };
}

// Map agreement and result variables
function mapAgreementResult(caseData: CaseWithRelations): PlaceholderMap {
  // Calculate voting results
  const totalCreditors = caseData.debts.length;

  // These would come from actual voting data - placeholders for now
  const negativeVotes = 0;
  const negativePercentage = totalCreditors > 0 ? (negativeVotes / totalCreditors) * 100 : 0;

  return {
    // Voting results
    ACREEDORES_NEGATIVOS: negativeVotes.toString(),
    PORCENTAJE_NEGATIVO: negativePercentage.toFixed(2) + '%',

    // Payment value
    VALOR_PAGO: formatCurrency(caseData.monthlyPaymentAmount),

    // Applicant type
    TIPO_SOLICITANTE: (caseData.applicantScope || []).includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE')
      ? 'Persona Natural Pequeño Comerciante'
      : 'Persona Natural No Comerciante',

    // Gender variants
    GENERO_DEUDOR_SINGULAR: caseData.debtor.name?.toLowerCase().endsWith('a') ? 'la' : 'el',
  };
}

// Map dynamic tables (these generate HTML content)
function mapDynamicTables(caseData: CaseWithRelations): PlaceholderMap {
  // Build creditors list for edicto
  const creditorsList = caseData.debts.map((d, i) =>
    `${i + 1}. ${d.creditor.name} - ${formatCurrency(d.amount)}`
  ).join('<br>');

  // Build assets inventory
  const assetsInventory = caseData.assets.map((a, i) =>
    `${i + 1}. ${a.name || a.type} - ${formatCurrency(a.value)}`
  ).join('<br>');

  // Build total creditors table
  const totalCreditors = caseData.debts.length;
  const totalDebt = caseData.debts.reduce((sum, d) => sum + (d.amount || 0), 0);

  return {
    // Dynamic table placeholders
    LISTA_ACREEDORES: creditorsList || 'Sin acreedores registrados',
    INVENTARIO_BIENES: assetsInventory || 'Sin bienes registrados',

    // Summary tables (HTML to be generated separately if needed)
    CUADRO_TOTAL_ACREEDORES: `
      <table border="1" cellpadding="5">
        <tr><th>Total Acreedores</th><td>${totalCreditors}</td></tr>
        <tr><th>Total Deuda</th><td>${formatCurrency(totalDebt)}</td></tr>
      </table>
    `,

    // Placeholders for complex tables (to be filled by specific generators)
    CUADRO_CALIFICACION_GRADUACION: '',
    CUADRO_CALIFICACION_FIRMADO: '',
    CUADRO_ACUERDO_BILATERAL: '',
    CUADRO_FRACASO_NEGOCIACION: '',
    PROPUESTA_REFORMA_PAGO: '',
    PROYECTO_CALIFICACION_GRADUACION: '',
  };
}

// Map payment proposal
function mapPaymentProposal(caseData: CaseWithRelations): PlaceholderMap {
  const monthlyIncome = caseData.monthlyIncome || caseData.debtor.monthlyIncome || 0;
  const monthlyExpenses = caseData.monthlyExpenses || caseData.debtor.monthlyExpenses || 0;
  const available = monthlyIncome - monthlyExpenses;

  // Calculate total capital from debts
  const totalCapital = caseData.debts.reduce((sum, d) => sum + (d.capitalAmount || d.amount || 0), 0);

  // Parse payment order
  const paymentOrder = (caseData.paymentOrder as Record<string, string | null>) || {};

  return {
    // Income/Expenses summary
    PROPUESTA_TOTAL_CAPITAL: formatCurrency(totalCapital),
    PROPUESTA_INGRESOS: formatCurrency(monthlyIncome),
    PROPUESTA_GASTOS: formatCurrency(monthlyExpenses),
    PROPUESTA_DISPONIBLE: formatCurrency(available),

    // Grace period
    PROP_GRACIA_SI: caseData.gracePeriodRequested ? 'X' : '',
    PROP_GRACIA_NO: !caseData.gracePeriodRequested ? 'X' : '',
    PROP_GRACIA_MESES: caseData.gracePeriodMonths?.toString() || '',

    // Dation in payment
    PROP_DACION_SI: caseData.paymentInKind ? 'X' : '',
    PROP_DACION_NO: !caseData.paymentInKind ? 'X' : '',
    PROP_DACION_DESC: caseData.paymentInKindDescription || '',

    // Asset sale
    PROP_VENTA_SI: caseData.assetSaleAuthorized ? 'X' : '',
    PROP_VENTA_NO: !caseData.assetSaleAuthorized ? 'X' : '',
    PROP_VENTA_DESC: caseData.assetSaleDescription || '',

    // Cash flow payment
    PROP_FLUJO_SI: caseData.cashFlowPayment ? 'X' : '',
    PROP_FLUJO_NO: !caseData.cashFlowPayment ? 'X' : '',

    // Term
    PROP_PLAZO: caseData.paymentTermMonths?.toString() || '',
    PROP_CUOTA_MENSUAL: formatCurrency(caseData.monthlyPaymentAmount),
    PROP_CUOTA_VARIABLE: formatCurrency(caseData.variablePayment),

    // Extraordinary payment
    PROP_EXTRAORDINARIA_SI: caseData.extraordinaryPayment ? 'X' : '',
    PROP_EXTRAORDINARIA_NO: !caseData.extraordinaryPayment ? 'X' : '',
    PROP_EXTRA_FECHA: caseData.extraordinaryPaymentDate || '',
    PROP_EXTRA_MES: '',

    // Interest rate offered (placeholder - needs to be calculated based on business rules)
    PROP_TASA_MENSUAL: '0%',
    PROP_TASA_ANUAL: '0%',

    // Capital reduction (quitas)
    PROP_QUITAS_SI: caseData.capitalReduction ? 'X' : '',
    PROP_QUITAS_NO: !caseData.capitalReduction ? 'X' : '',
    PROP_QUITAS_PORCENTAJE: caseData.capitalReductionPercent?.toString() || '',
    PROP_QUITAS_VALOR: formatCurrency(totalCapital * (1 - (caseData.capitalReductionPercent || 0) / 100)),

    // Insurance
    PROP_SEGURO_INCENDIO: caseData.insuranceOffering?.includes('incendio') ? 'X' : '',
    PROP_SEGURO_VIDA: caseData.insuranceOffering?.includes('vida') ? 'X' : '',

    // Interest forgiveness
    PROP_COND_CAUSADO: boolToSiNo(caseData.forgiveAccruedInterest),
    PROP_COND_FUTURO: boolToSiNo(caseData.forgiveFutureInterest),

    // Payment order (prelation)
    PROP_PRELACION_1: paymentOrder.primera || '',
    PROP_PRELACION_2: paymentOrder.segunda || '',
    PROP_PRELACION_3: paymentOrder.tercera || '',
    PROP_PRELACION_4: paymentOrder.cuarta || '',
    PROP_PRELACION_5: paymentOrder.quinta || '',

    // Class privileges
    PROP_PRIVILEGIOS_SI: caseData.hasClassPrivileges ? 'X' : '',
    PROP_PRIVILEGIOS_NO: !caseData.hasClassPrivileges ? 'X' : '',
    PROP_PRIVILEGIOS_DESC: caseData.classPrivilegesDescription || '',

    // Third party payment
    PROP_PAGO_TERCEROS_SI: caseData.thirdPartyPaymentAuth ? 'X' : '',
    PROP_PAGO_TERCEROS_NO: !caseData.thirdPartyPaymentAuth ? 'X' : '',

    // Guarantee substitution
    PROP_GARANTIAS_SI: caseData.guaranteeSubstitution ? 'X' : '',
    PROP_GARANTIAS_NO: !caseData.guaranteeSubstitution ? 'X' : '',
  };
}

/**
 * Main function to map all case data to placeholders
 */
export function mapCaseToPlaceholders(caseData: CaseWithRelations): PlaceholderMap {
  const debtor = caseData.debtor;
  const monthlyIncome = caseData.monthlyIncome || debtor.monthlyIncome || 0;
  const monthlyExpenses = caseData.monthlyExpenses || debtor.monthlyExpenses || 0;
  const available = monthlyIncome - monthlyExpenses;
  const genderPrefix = getGenderPrefix(debtor.name);

  const basePlaceholders: PlaceholderMap = {
    // Debtor basic info
    NOMBRE_DEUDOR: debtor.name,
    CEDULA_DEUDOR: debtor.idNumber,
    DIRECCION_DEUDOR: debtor.address,
    CIUDAD_DEUDOR: debtor.city || '',
    EMAIL_DEUDOR: debtor.email,
    TELEFONO_DEUDOR: debtor.phone,
    GENERO_DEUDOR: genderPrefix,
    GENERO_APODERADO: 'del apoderado',

    // Case basic info
    RADICADO: caseData.caseNumber,
    NUMERO_RADICADO: caseData.caseNumber.replace(/[^0-9]/g, ''),
    NUMERO_TRAMITE: caseData.caseNumber,
    NUMERO_ACUERDO: caseData.caseNumber.replace(/[^0-9]/g, ''),
    ANO_ACUERDO: new Date().getFullYear().toString(),

    // Dates - MANUAL: Estas fechas las ingresa el operador manualmente, no se auto-generan
    // Solo se muestran si ya fueron ingresadas por el operador
    FECHA_RADICACION: caseData.filingDate ? formatDate(caseData.filingDate) : '________________',
    FECHA_DESIGNACION: caseData.designationDate ? formatDate(caseData.designationDate) : '________________',
    FECHA_ACEPTACION: caseData.positionAcceptanceDate ? formatDate(caseData.positionAcceptanceDate) : '________________',
    FECHA_ADMISION: caseData.admissionDate ? formatDate(caseData.admissionDate) : '________________',
    FECHA_AUDIENCIA: (caseData.firstHearingDate || caseData.hearingDate) ? formatDate(caseData.firstHearingDate || caseData.hearingDate) : '________________',
    HORA_AUDIENCIA: caseData.firstHearingTime || '____:____',

    // Date components for current date
    NUMERO_DIA: getDayNumber(new Date()),
    NUMERO_DIA_LETRAS: getDayInWords(new Date()),
    NOMBRE_MES: getMonthName(new Date()),
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

    // Income/Expenses
    INGRESO_PRINCIPAL: formatCurrency(monthlyIncome),
    OTROS_INGRESOS_DETALLE: caseData.otherIncomeDescription || debtor.otherIncomeDescription || '',
    OTROS_INGRESOS_VALOR: formatCurrency(caseData.otherIncomeAmount || debtor.otherIncomeAmount),
    TOTAL_INGRESOS: formatCurrency(monthlyIncome + (caseData.otherIncomeAmount || debtor.otherIncomeAmount || 0)),
    CERTIFICACION_EMPLEADOR: boolToSiNo(caseData.hasEmployerCertification || debtor.hasEmployerCertification),
    GASTOS_MENSUALES: formatCurrency(monthlyExpenses),

    // Resources
    RECURSOS_INGRESOS: formatCurrency(monthlyIncome),
    RECURSOS_GASTOS: formatCurrency(monthlyExpenses),
    RECURSOS_DISPONIBLE: formatCurrency(available),

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

    // Operator
    NOMBRE_OPERADOR: caseData.operator.name,
    EMAIL_OPERADOR: caseData.operator.email,

    // Legal attorney placeholders (to be filled if applicable)
    NOMBRE_ABOGADO: '',
    CEDULA_ABOGADO: '',
    TARJETA_PROFESIONAL: '',
    NOMBRE_PERSONA: '',
    DESCRIPCION_PRUEBAS: '',

    // Agreement specific - MANUAL: Solo mostrar si ya fueron ingresadas
    DIA_ACEPTACION: caseData.admissionDate ? getDayNumber(caseData.admissionDate) : '____',
    MES_ACEPTACION: caseData.admissionDate ? getMonthName(caseData.admissionDate) : '____________',
    ANO_ACEPTACION: caseData.admissionDate ? new Date(caseData.admissionDate).getFullYear().toString() : '______',
    DIA_AUDIENCIA: (caseData.firstHearingDate || caseData.hearingDate) ? getDayNumber(caseData.firstHearingDate || caseData.hearingDate) : '____',
    MES_AUDIENCIA: (caseData.firstHearingDate || caseData.hearingDate) ? getMonthName(caseData.firstHearingDate || caseData.hearingDate) : '____________',
    ANO_AUDIENCIA: (caseData.firstHearingDate || caseData.hearingDate)
      ? new Date(caseData.firstHearingDate || caseData.hearingDate!).getFullYear().toString()
      : '______',

    // Payment terms - MANUAL
    NUMERO_MESES: caseData.paymentTermMonths?.toString() || '____',
    DIA_INICIO_PAGO: '____', // MANUAL - post-acuerdo
    MES_INICIO_PAGO: '____________', // MANUAL - post-acuerdo
    ANO_INICIO_PAGO: '______', // MANUAL - post-acuerdo
    DIA_VIGENCIA: '____', // MANUAL - vigencia del acuerdo
    MES_VIGENCIA: '____________', // MANUAL - vigencia del acuerdo
    ANO_VIGENCIA: '______', // MANUAL - vigencia del acuerdo
    PORCENTAJE_APROBACION: '____', // MANUAL - resultado de votación

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
    DECLARACION_BIENES: caseData.assets.length > 0
      ? 'que posee los siguientes bienes:'
      : 'que no posee bienes a su nombre.',
    DETALLE_BIENES: '',

    // Placeholders for tables (to be filled dynamically)
    CUADRO_CALIFICACION_GRADUACION: '',
    DETALLE_PAGO_CAPITAL: '',
    FORMA_PAGO_ACREEDORES: '',
    PROYECCION_PAGOS: '',

    // Signature
    DIA_FIRMA: getDayNumber(new Date()),
    MES_FIRMA: getMonthName(new Date()),
  };

  // Merge all mappings
  return {
    ...basePlaceholders,
    ...mapApplicantScope(caseData.applicantScope || []),
    ...mapCauses(caseData.causes || []),
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
  };
}

/**
 * Replace placeholders in HTML content
 */
export function replacePlaceholders(html: string, placeholders: PlaceholderMap): string {
  let result = html;

  for (const [key, value] of Object.entries(placeholders)) {
    // Replace {{KEY}} pattern
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}
