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
  // Ensure Prisma Decimal objects are converted to number
  const num = Number(value);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
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
  if (String(date) === 'DESCONOZCO') return 'Desconoce';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
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
    '',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciseis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidos',
    'veintitres',
    'veinticuatro',
    'veinticinco',
    'veintiseis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
    'treinta',
    'treinta y uno',
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
function mapCauses(
  causes: string[],
  otherCauseDetail?: string | null,
): PlaceholderMap {
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
  result['CAUSA_12_DETALLE'] =
    otherCauseDetail || causes.find((c) => !causeLabels.includes(c)) || '';
  return result;
}

// Map applicant scope
function mapApplicantScope(scope: string[]): PlaceholderMap {
  const isNonMerchant =
    scope.includes('PERSONA_NATURAL_NO_COMERCIANTE') ||
    scope.some((s) => s.toLowerCase().includes('no comerciante'));
  const isSmallMerchant =
    scope.includes('PERSONA_NATURAL_PEQUENA_COMERCIANTE') ||
    scope.some((s) => s.toLowerCase().includes('pequeño comerciante'));

  return {
    APLICACION_NO_COMERCIANTE: isNonMerchant ? 'SI' : 'NO',
    APLICACION_PEQUENA_COMERCIANTE: isSmallMerchant ? 'SI' : 'NO',
    TIPO_SOLICITANTE: isSmallMerchant
      ? 'Persona Natural Pequeño Comerciante'
      : 'Persona Natural No Comerciante',
  };
}

// Map debts (creditors) to placeholders
function mapDebts(debts: CaseWithRelations['debts']): PlaceholderMap {
  const result: PlaceholderMap = {};

  // Calculate total for percentages
  const totalDebt = debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalCapitalAll = debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  // Summary table (up to 11 creditors - CYG template has 11 rows)
  for (let i = 0; i < 11; i++) {
    const debt = debts[i];
    const idx = i + 1;

    if (debt) {
      const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
      const interest = Number(debt.interestAmount) || 0;
      const percentage =
        totalCapitalAll > 0
          ? ((capital / totalCapitalAll) * 100).toFixed(2)
          : '0.00';

      result[`ACREEDOR_${idx}`] = debt.creditor.name;
      result[`VALOR_${idx}`] = formatCurrency(Number(debt.amount));
      result[`LIBRANZA_${idx}`] = boolToSiNo(debt.hasActiveLibranza);
      result[`CLASE_${idx}`] = debt.creditorClass || '';
      result[`PORCENTAJE_${idx}`] =
        debt.percentageOfTotal?.toString() || `${percentage}%`;
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

  // Detailed creditor info (AC1..AC11) + RAW numeric values for CYG table
  for (let i = 0; i < 11; i++) {
    const debt = debts[i];
    const idx = i + 1;

    if (debt) {
      const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
      const interest = Number(debt.interestAmount) || 0;

      result[`AC${idx}_NOMBRE`] = debt.creditor.name;
      result[`AC${idx}_DOMICILIO`] = debt.creditorCity || '';
      result[`AC${idx}_DIRECCION`] = debt.creditorAddress || '';
      result[`AC${idx}_EMAIL`] = debt.creditorEmail || '';
      result[`AC${idx}_CAPITAL`] = formatCurrency(capital);
      result[`AC${idx}_INTERESES`] = formatCurrency(interest);
      result[`AC${idx}_POSTERGADO`] = boolToSiNo(debt.isDeferred);
      result[`AC${idx}_TASA`] =
        String(debt.interestRate) === 'DESCONOZCO'
          ? 'Desconoce'
          : `${Number(debt.interestRate) || 0}%`;
      result[`AC${idx}_DOCUMENTO`] = debt.documentType || '';
      result[`AC${idx}_FECHA_OTORGAMIENTO`] = formatShortDate(debt.grantDate);
      result[`AC${idx}_FECHA_VENCIMIENTO`] = formatShortDate(debt.dueDate);
      result[`AC${idx}_CLASIFICACION`] = debt.creditClassification || '';
      result[`AC${idx}_CODEUDOR_NOMBRE`] = debt.coDebtorName || '';
      result[`AC${idx}_CODEUDOR_DOMICILIO`] = debt.coDebtorCity || '';
      result[`AC${idx}_CODEUDOR_DIRECCION`] = debt.coDebtorAddress || '';
      // RAW numeric values for CYG table JavaScript calculation
      result[`AC${idx}_CAPITAL_RAW`] = capital.toString();
      result[`AC${idx}_INTERESES_RAW`] = interest.toString();
    } else {
      result[`AC${idx}_NOMBRE`] = '';
      result[`AC${idx}_CAPITAL`] = '';
      result[`AC${idx}_INTERESES`] = '';
      result[`AC${idx}_CLASIFICACION`] = '';
      result[`AC${idx}_DOCUMENTO`] = '';
      result[`AC${idx}_CAPITAL_RAW`] = '';
      result[`AC${idx}_INTERESES_RAW`] = '';
    }
  }

  // Total
  result['TOTAL_ACREENCIAS'] = formatCurrency(totalDebt);

  return result;
}

// Map assets to placeholders
function mapAssets(assets: CaseWithRelations['assets']): PlaceholderMap {
  const result: PlaceholderMap = {};

  // Separate real estate from personal property
  const realEstate = assets.filter(
    (a) => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE',
  );
  const personalProperty = assets.filter(
    (a) => a.type !== 'INMUEBLE' && a.type !== 'REAL_ESTATE',
  );

  // Map ALL real estate properties (up to 5)
  for (let i = 0; i < 5; i++) {
    const immueble = realEstate[i];
    const idx = i + 1;

    if (immueble) {
      result[`INMUEBLE_${idx}_TIPO`] =
        immueble.propertyType || immueble.name || '';
      result[`INMUEBLE_${idx}_DIRECCION`] = immueble.address || '';
      result[`INMUEBLE_${idx}_MATRICULA`] = immueble.registrationNumber || '';
      result[`INMUEBLE_${idx}_VALOR`] = formatCurrency(immueble.value);
      result[`INMUEBLE_${idx}_GRAVAMEN`] = immueble.encumbrance || '';
      result[`INMUEBLE_${idx}_AFECTACION`] = immueble.affectation || '';
      result[`INMUEBLE_${idx}_MEDIDA`] = immueble.precautionaryMeasure || '';
      result[`INMUEBLE_${idx}_VIVIENDA_FAMILIAR`] = boolToSiNo(
        immueble.isFamilyHome,
      );
      result[`INMUEBLE_${idx}_PATRIMONIO_FAMILIA`] = boolToSiNo(
        immueble.isInalienablePatrimony,
      );
      result[`INMUEBLE_${idx}_DOCUMENTO`] = immueble.proofDocument || '';
    }
  }

  // Keep backward compatibility with single INMUEBLE_ variables
  const firstImmueble = realEstate[0];
  if (firstImmueble) {
    result['INMUEBLE_TIPO'] =
      firstImmueble.propertyType || firstImmueble.name || '';
    result['INMUEBLE_DIRECCION'] = firstImmueble.address || '';
    result['INMUEBLE_MATRICULA'] = firstImmueble.registrationNumber || '';
    result['INMUEBLE_VALOR'] = formatCurrency(firstImmueble.value);
    result['INMUEBLE_GRAVAMEN'] = firstImmueble.encumbrance || '';
    result['INMUEBLE_AFECTACION'] = firstImmueble.affectation || '';
    result['INMUEBLE_MEDIDA'] = firstImmueble.precautionaryMeasure || '';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = boolToSiNo(
      firstImmueble.isFamilyHome,
    );
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = boolToSiNo(
      firstImmueble.isInalienablePatrimony,
    );
    result['INMUEBLE_DOCUMENTO'] = firstImmueble.proofDocument || '';
  } else {
    result['INMUEBLE_TIPO'] = 'No declara bienes inmuebles';
    result['INMUEBLE_DIRECCION'] = '';
    result['INMUEBLE_MATRICULA'] = '';
    result['INMUEBLE_VALOR'] = '';
    result['INMUEBLE_GRAVAMEN'] = '';
    result['INMUEBLE_AFECTACION'] = '';
    result['INMUEBLE_MEDIDA'] = '';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = '';
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = '';
    result['INMUEBLE_DOCUMENTO'] = '';
  }

  // Personal property by category - get ALL items, not just first
  const filterAssetsByType = (types: string[]) =>
    personalProperty.filter((a) =>
      types.some((t) => a.type?.toLowerCase().includes(t.toLowerCase())),
    );

  const allElectronics = filterAssetsByType([
    'electronico',
    'electronic',
    'electrodomestico',
  ]);
  const allFurniture = filterAssetsByType(['mueble', 'enseres', 'furniture']);
  const allVehicles = filterAssetsByType([
    'vehiculo',
    'vehicle',
    'carro',
    'moto',
  ]);
  const allJewelry = filterAssetsByType(['joya', 'jewelry']);
  const allCash = filterAssetsByType(['efectivo', 'cash', 'dinero']);
  const allStocks = filterAssetsByType(['accion', 'stock', 'inversion']);
  const allReceivables = filterAssetsByType(['cuenta', 'receivable', 'cobrar']);

  // Generate consolidated descriptions for each category
  const formatAssetList = (items: typeof personalProperty) => {
    if (items.length === 0) return 'No declara';
    return items.map((a) => a.description || a.name || a.type).join('; ');
  };

  const sumValues = (items: typeof personalProperty) =>
    items.reduce((sum, a) => sum + (a.value || 0), 0);

  // Format vehicles with full details
  const formatVehicleList = (vehicles: typeof personalProperty) => {
    if (vehicles.length === 0) return 'No declara';
    return vehicles
      .map((v) =>
        `${v.brand || ''} ${v.model || ''} - Placa: ${v.licensePlate || 'N/A'}`.trim(),
      )
      .join('; ');
  };

  result['MUEBLE_ELECTRONICO_DESC'] = formatAssetList(allElectronics);
  result['MUEBLE_ELECTRONICO_VALOR'] =
    allElectronics.length > 0
      ? formatCurrency(sumValues(allElectronics))
      : 'N/A';
  result['MUEBLE_ENSERES_DESC'] = formatAssetList(allFurniture);
  result['MUEBLE_ENSERES_VALOR'] =
    allFurniture.length > 0 ? formatCurrency(sumValues(allFurniture)) : 'N/A';
  result['MUEBLE_VEHICULO_DESC'] = formatVehicleList(allVehicles);
  result['MUEBLE_VEHICULO_VALOR'] =
    allVehicles.length > 0 ? formatCurrency(sumValues(allVehicles)) : 'N/A';
  result['MUEBLE_JOYAS_DESC'] = formatAssetList(allJewelry);
  result['MUEBLE_JOYAS_VALOR'] =
    allJewelry.length > 0 ? formatCurrency(sumValues(allJewelry)) : 'N/A';
  result['MUEBLE_EFECTIVO_DESC'] = formatAssetList(allCash);
  result['MUEBLE_EFECTIVO_VALOR'] =
    allCash.length > 0 ? formatCurrency(sumValues(allCash)) : 'N/A';
  result['MUEBLE_ACCIONES_DESC'] = formatAssetList(allStocks);
  result['MUEBLE_ACCIONES_VALOR'] =
    allStocks.length > 0 ? formatCurrency(sumValues(allStocks)) : 'N/A';
  result['MUEBLE_CUENTAS_DESC'] = formatAssetList(allReceivables);
  result['MUEBLE_CUENTAS_VALOR'] =
    allReceivables.length > 0
      ? formatCurrency(sumValues(allReceivables))
      : 'N/A';

  // Totals
  const totalRealEstate = realEstate.reduce(
    (sum, a) => sum + (a.value || 0),
    0,
  );
  const totalPersonal = personalProperty.reduce(
    (sum, a) => sum + (a.value || 0),
    0,
  );
  result['TOTAL_INMUEBLES'] = formatCurrency(totalRealEstate);
  result['TOTAL_MUEBLES'] = formatCurrency(totalPersonal);
  result['TOTAL_BIENES'] = formatCurrency(totalRealEstate + totalPersonal);

  // Counts
  result['CANTIDAD_INMUEBLES'] = realEstate.length.toString();
  result['CANTIDAD_MUEBLES'] = personalProperty.length.toString();
  result['CANTIDAD_BIENES'] = assets.length.toString();

  return result;
}

// Map legal processes
function mapLegalProcesses(
  processes: CaseWithRelations['legalProcesses'],
): PlaceholderMap {
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
function mapLibranzas(
  libranzas: CaseWithRelations['libranzas'],
): PlaceholderMap {
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
function mapSuspendedServices(
  services: CaseWithRelations['suspendedServices'],
): PlaceholderMap {
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
function mapDependents(
  dependents: CaseWithRelations['dependents'],
): PlaceholderMap {
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
  const hasAttorney = false; // TODO: Add attorney field to case model
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
  const monthlyIncome =
    Number(caseData.monthlyIncome) || Number(debtor.monthlyIncome) || 0;

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
  const totalDebt = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0,
  );
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  // Find majority creditor (largest debt)
  const sortedDebts = [...caseData.debts].sort(
    (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0),
  );
  const majorityCreditor = sortedDebts[0];
  const majorityCreditorName = majorityCreditor?.creditor?.name || '';
  const majorityCreditorAmount = Number(majorityCreditor?.amount) || 0;
  const majorityPercentage =
    totalDebt > 0 ? (majorityCreditorAmount / totalDebt) * 100 : 0;

  // Approval percentage from database or calculate
  const approvalPercentage = caseData.approvalPercentage || 0;

  // These would come from actual voting data - placeholders for now
  const negativeVotes = 0;
  const negativePercentage =
    totalCreditors > 0 ? (negativeVotes / totalCreditors) * 100 : 0;

  return {
    // Voting results
    ACREEDORES_NEGATIVOS: negativeVotes.toString(),
    PORCENTAJE_NEGATIVO: negativePercentage.toFixed(2) + '%',
    PORCENTAJE_APROBACION_REAL: approvalPercentage.toString() + '%',
    PORCENTAJE_VOTACION: approvalPercentage.toFixed(2) + '%',

    // Majority creditor (for fracaso documents)
    ACREEDOR_MAYORITARIO: majorityCreditorName,
    VALOR_ACREEDOR_MAYORITARIO: formatCurrency(majorityCreditorAmount),
    PORCENTAJE_ACREEDOR_MAYORITARIO: majorityPercentage.toFixed(2) + '%',

    // Total capital (for fracaso documents)
    TOTAL_CAPITAL_ADEUDADO: formatCurrency(totalCapital),
    TOTAL_CAPITAL_FRACASO: formatCurrency(totalCapital),

    // Payment value
    VALOR_PAGO: formatCurrency(Number(caseData.monthlyPaymentAmount) || 0),

    // Applicant type
    TIPO_SOLICITANTE: (caseData.applicantScope || []).includes(
      'PERSONA_NATURAL_PEQUENA_COMERCIANTE',
    )
      ? 'Persona Natural Pequeño Comerciante'
      : 'Persona Natural No Comerciante',

    // Gender variants - improved logic
    GENERO_DEUDOR_SINGULAR: getGenderArticle(caseData.debtor.name),

    // Año de firma (usado en constancias)
    ANO_FIRMA: getYear(new Date()),

    // Nombres en formatos adicionales
    NOMBRE_DEUDOR_MAYUSCULAS: caseData.debtor.name?.toUpperCase() || '',
    CEDULA_DEUDOR_FORMATO: formatIdNumber(caseData.debtor.idNumber),
  };
}

// Helper to get gender article (el/la)
function getGenderArticle(name: string): string {
  if (!name) return 'el';
  const firstName = name.split(' ')[0].toLowerCase();
  // Common female name endings in Spanish
  const femaleEndings = ['a', 'ia', 'na', 'da', 'ta', 'sa', 'za', 'ía'];
  // Common male names that end in 'a'
  const maleExceptions = ['joshua', 'josua', 'garcia', 'borja', 'kocha'];

  if (maleExceptions.includes(firstName)) return 'el';

  for (const ending of femaleEndings) {
    if (firstName.endsWith(ending)) return 'la';
  }
  return 'el';
}

// Helper to format ID number with dots
function formatIdNumber(idNumber: string): string {
  if (!idNumber) return '';
  // Remove any existing formatting
  const cleaned = idNumber.replace(/\D/g, '');
  // Add thousand separators (Colombian format)
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Map fracaso (failure) specific variables
function mapFracasoVariables(caseData: CaseWithRelations): PlaceholderMap {
  // Failure date - now comes from database field
  const failureDate = caseData.failureDate
    ? new Date(caseData.failureDate)
    : null;
  const firstProcess = caseData.legalProcesses?.[0];

  // Get bilateral creditor - if isBilateral is true, use bilateralCreditorId to find creditor name
  let bilateralCreditorName = '';
  if (caseData.isBilateral && caseData.bilateralCreditorId) {
    const bilateralDebt = caseData.debts?.find(
      (d) => d.creditorId === caseData.bilateralCreditorId,
    );
    bilateralCreditorName = bilateralDebt?.creditor?.name || '';
  }
  // Fallback to first creditor if no bilateral creditor specified
  if (!bilateralCreditorName) {
    bilateralCreditorName = caseData.debts?.[0]?.creditor?.name || '';
  }

  return {
    // Fechas de fracaso - Ahora vienen de la BD
    DIA_FRACASO: failureDate ? getDayNumber(failureDate) : '____',
    MES_FRACASO: failureDate ? getMonthName(failureDate) : '____________',
    ANO_FRACASO: failureDate ? getYear(failureDate) : '______',
    FECHA_FRACASO: failureDate ? formatDate(failureDate) : '________________',
    TIPO_FRACASO: caseData.failureType || '',

    // Información del juzgado
    NUMERO_JUZGADO: firstProcess?.fileNumber || '____',
    NUMERO_JUZGADO_FINAL: firstProcess?.fileNumber || '____',

    // Acuerdo bilateral - Ahora viene de la BD
    NOMBRE_ACREEDOR_BILATERAL:
      bilateralCreditorName || '________________________________',
    RADICADO_BILATERAL: caseData.bilateralAgreementNumber || '________________',
    ANO_BILATERAL: getYear(new Date()),
    ES_BILATERAL: caseData.isBilateral ? 'SI' : 'NO',

    // Constancia
    NUMERO_CONSTANCIA: caseData.caseNumber?.replace(/[^0-9]/g, '') || '',
    ANO_CONSTANCIA: getYear(new Date()),
  };
}

// ============================================================
// FORMULARIO DEFINITIVO - New placeholder mappers
// ============================================================

// Map Acreedores (formulario definitivo)
function mapAcreedoresDefinitivo(caseData: CaseWithRelations): PlaceholderMap {
  const result: PlaceholderMap = {};
  const acreedores = caseData.acreedores || [];

  for (let i = 0; i < 15; i++) {
    const a = acreedores[i];
    const idx = i + 1;

    if (a) {
      result[`acr_${idx}_tipo`] = a.acreedorTipo || '';
      result[`acr_${idx}_nombre`] = a.acreedorNombreRazonSocial || '';
      result[`acr_${idx}_identificacion`] = a.acreedorIdentificacion || '';
      result[`acr_${idx}_direccion`] = a.acreedorDireccion || '';
      result[`acr_${idx}_ciudad`] = a.acreedorCiudad || '';
      result[`acr_${idx}_correo`] = a.acreedorCorreo || '';
      result[`acr_${idx}_telefono`] = a.acreedorTelefono || '';
      result[`acr_${idx}_tipo_obligacion`] = a.tipoObligacion || '';
      result[`acr_${idx}_numero_obligacion`] = a.numeroObligacion || '';
      result[`acr_${idx}_fecha_otorgamiento`] = a.fechaOtorgamiento
        ? formatShortDate(a.fechaOtorgamiento)
        : '';
      result[`acr_${idx}_fecha_vencimiento`] = a.fechaVencimiento
        ? formatShortDate(a.fechaVencimiento)
        : '';
      result[`acr_${idx}_dias_mora`] = a.diasMora?.toString() || '';
      result[`acr_${idx}_capital`] = formatCurrency(a.valorCapital);
      result[`acr_${idx}_intereses_corrientes`] = formatCurrency(
        a.valorInteresesCorrientes,
      );
      result[`acr_${idx}_intereses_mora`] = formatCurrency(
        a.valorInteresesMora,
      );
      result[`acr_${idx}_gastos_cobranza`] = formatCurrency(
        a.valorGastosCobranza,
      );
      result[`acr_${idx}_total`] = formatCurrency(a.valorTotalObligacion);
      result[`acr_${idx}_naturaleza`] = a.naturalezaCredito || '';
      result[`acr_${idx}_codeudores`] = boolToSiNo(a.obligacionCodeudores);
      result[`acr_${idx}_nombre_codeudores`] = a.nombreCodeudores || '';
      result[`acr_${idx}_garantia`] = boolToSiNo(a.garantiaAsociada);
      result[`acr_${idx}_tipo_garantia`] = a.tipoGarantia || '';
      result[`acr_${idx}_proceso_judicial`] = boolToSiNo(
        a.procesoJudicialEnCurso,
      );
      result[`acr_${idx}_juzgado`] = a.juzgadoNombre || '';
      result[`acr_${idx}_radicado`] = a.procesoJudicialRadicado || '';
    } else {
      result[`acr_${idx}_nombre`] = '';
      result[`acr_${idx}_capital`] = '';
      result[`acr_${idx}_total`] = '';
    }
  }

  // Totals
  const totalCapitalAcr = acreedores.reduce(
    (sum, a) => sum + (Number(a.valorCapital) || 0),
    0,
  );
  const totalObligaciones = acreedores.reduce(
    (sum, a) => sum + (Number(a.valorTotalObligacion) || 0),
    0,
  );
  result['total_capital_acreedores'] = formatCurrency(totalCapitalAcr);
  result['total_obligaciones_acreedores'] = formatCurrency(totalObligaciones);
  result['numero_acreedores_definitivo'] = acreedores.length.toString();

  return result;
}

// Map Bienes (formulario definitivo)
function mapBienesDefinitivo(caseData: CaseWithRelations): PlaceholderMap {
  const result: PlaceholderMap = {};
  const bienes = caseData.bienes || [];

  for (let i = 0; i < 10; i++) {
    const b = bienes[i];
    const idx = i + 1;

    if (b) {
      result[`bien_${idx}_tipo`] = b.bienTipo || '';
      result[`bien_${idx}_descripcion`] = b.bienDescripcion || '';
      result[`bien_${idx}_ubicacion`] = b.bienUbicacion || '';
      result[`bien_${idx}_matricula`] = b.bienMatriculaInmobiliaria || '';
      result[`bien_${idx}_placa`] = b.bienPlaca || '';
      result[`bien_${idx}_entidad`] = b.bienEntidadFinanciera || '';
      result[`bien_${idx}_valor_comercial`] = formatCurrency(
        b.bienValorComercial,
      );
      result[`bien_${idx}_valor_catastral`] = formatCurrency(
        b.bienValorCatastral,
      );
      result[`bien_${idx}_gravamenes`] = boolToSiNo(b.bienGravamenes);
      result[`bien_${idx}_embargado`] = boolToSiNo(b.bienEmbargado);
      result[`bien_${idx}_vivienda_familiar`] = boolToSiNo(
        b.bienAfectadoViviendaFamiliar,
      );
      result[`bien_${idx}_leasing`] = boolToSiNo(b.bienEnLeasing);
    } else {
      result[`bien_${idx}_tipo`] = '';
      result[`bien_${idx}_valor_comercial`] = '';
    }
  }

  const totalBienes = bienes.reduce(
    (sum, b) => sum + (Number(b.bienValorComercial) || 0),
    0,
  );
  result['total_bienes_definitivo'] = formatCurrency(totalBienes);
  result['numero_bienes_definitivo'] = bienes.length.toString();

  return result;
}

// Map Procesos Judiciales (formulario definitivo)
function mapProcesosJudicialesDefinitivo(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const result: PlaceholderMap = {};
  const procesos = caseData.procesosJudiciales || [];

  for (let i = 0; i < 10; i++) {
    const p = procesos[i];
    const idx = i + 1;

    if (p) {
      result[`pj_${idx}_tipo`] = p.tipoProceso || '';
      result[`pj_${idx}_juzgado`] = p.juzgadoNombre || '';
      result[`pj_${idx}_ciudad`] = p.juzgadoCiudad || '';
      result[`pj_${idx}_radicado`] = p.procesoJudicialRadicado || '';
      result[`pj_${idx}_demandante`] = p.demandanteNombre || '';
      result[`pj_${idx}_demandado`] = p.demandadoNombre || '';
      result[`pj_${idx}_cuantia`] = formatCurrency(p.cuantiaProceso);
      result[`pj_${idx}_estado`] = p.estadoProceso || '';
    } else {
      result[`pj_${idx}_tipo`] = '';
      result[`pj_${idx}_juzgado`] = '';
    }
  }

  result['numero_procesos_judiciales'] = procesos.length.toString();
  return result;
}

// Map Formulario Definitivo Case fields (cónyuge, laboral, cesación, declaraciones, propuesta, apoderado, radicación)
function mapFormularioDefinitivoFields(
  caseData: CaseWithRelations,
): PlaceholderMap {
  const debtor = caseData.debtor;

  return {
    // Sección I: Deudor (campos extendidos)
    deudor_tipo_identificacion:
      debtor.deudorTipoIdentificacion || debtor.idType || '',
    deudor_identificacion: debtor.deudorIdentificacion || debtor.idNumber || '',
    deudor_primer_nombre: debtor.deudorPrimerNombre || '',
    deudor_segundo_nombre: debtor.deudorSegundoNombre || '',
    deudor_primer_apellido: debtor.deudorPrimerApellido || '',
    deudor_segundo_apellido: debtor.deudorSegundoApellido || '',
    deudor_nombre_completo: debtor.deudorNombreCompleto || debtor.name || '',
    deudor_fecha_nacimiento: debtor.deudorFechaNacimiento
      ? formatShortDate(debtor.deudorFechaNacimiento)
      : '',
    deudor_lugar_nacimiento: debtor.deudorLugarNacimiento || '',
    deudor_nacionalidad: debtor.deudorNacionalidad || '',
    deudor_estado_civil: debtor.deudorEstadoCivil || debtor.maritalStatus || '',
    deudor_regimen_matrimonial: debtor.deudorRegimenMatrimonial || '',
    sociedad_conyugal_vigente: boolToSiNo(debtor.sociedadConyugalVigente),
    existe_capitulaciones: boolToSiNo(debtor.existeCapitulaciones),
    deudor_direccion_residencia:
      debtor.deudorDireccionResidencia || debtor.address || '',
    deudor_ciudad_form: debtor.deudorCiudad || debtor.city || '',
    deudor_departamento_form:
      debtor.deudorDepartamento || debtor.department || '',
    deudor_codigo_postal: debtor.deudorCodigoPostal || '',
    deudor_telefono_fijo: debtor.deudorTelefonoFijo || '',
    deudor_telefono_celular: debtor.deudorTelefonoCelular || debtor.phone || '',
    deudor_correo_electronico:
      debtor.deudorCorreoElectronico || debtor.email || '',

    // Sección II: Cónyuge
    conyuge_tipo_identificacion: caseData.conyugeTipoIdentificacion || '',
    conyuge_identificacion: caseData.conyugeIdentificacion || '',
    conyuge_primer_nombre: caseData.conyugePrimerNombre || '',
    conyuge_segundo_nombre: caseData.conyugeSegundoNombre || '',
    conyuge_primer_apellido: caseData.conyugePrimerApellido || '',
    conyuge_segundo_apellido: caseData.conyugeSegundoApellido || '',
    conyuge_nombre_completo: caseData.conyugeNombreCompleto || '',
    conyuge_telefono: caseData.conyugeTelefono || '',
    conyuge_correo: caseData.conyugeCorreo || '',
    sociedad_conyugal_disuelta: boolToSiNo(caseData.sociedadConyugalDisuelta),

    // Sección III: Información Laboral y Económica
    deudor_ocupacion: caseData.deudorOcupacion || '',
    deudor_profesion: caseData.deudorProfesion || '',
    deudor_actividad_economica: caseData.deudorActividadEconomica || '',
    deudor_tipo_vinculacion: caseData.deudorTipoVinculacion || '',
    deudor_nombre_empleador: caseData.deudorNombreEmpleador || '',
    deudor_nit_empleador: caseData.deudorNitEmpleador || '',
    ingreso_principal_mensual: formatCurrency(caseData.ingresoPrincipalMensual),
    otros_ingresos_mensuales: formatCurrency(caseData.otrosIngresosMensuales),
    total_ingresos_mensuales: formatCurrency(caseData.totalIngresosMensuales),
    ingresos_variables_promedio: formatCurrency(
      caseData.ingresosVariablesPromedio,
    ),
    ingresos_no_operacionales: formatCurrency(caseData.ingresosNoOperacionales),
    gastos_vivienda: formatCurrency(caseData.gastosVivienda),
    gastos_alimentacion: formatCurrency(caseData.gastosAlimentacion),
    gastos_servicios_publicos: formatCurrency(caseData.gastosServiciosPublicos),
    gastos_transporte: formatCurrency(caseData.gastosTransporte),
    gastos_educacion: formatCurrency(caseData.gastosEducacion),
    gastos_salud: formatCurrency(caseData.gastosSalud),
    otros_gastos: formatCurrency(caseData.otrosGastos),
    total_gastos_mensuales: formatCurrency(caseData.totalGastosMensuales),
    capacidad_pago_estimada: formatCurrency(caseData.capacidadPagoEstimada),
    patrimonio_total_estimado: formatCurrency(caseData.patrimonioTotalEstimado),
    pasivo_total_estimado: formatCurrency(caseData.pasivoTotalEstimado),

    // Sección IV: Cesación de Pagos
    cesacion_pagos: boolToSiNo(caseData.cesacionPagos),
    fecha_cesacion_pagos: caseData.fechaCesacionPagos
      ? formatShortDate(caseData.fechaCesacionPagos)
      : '',
    numero_acreedores_actual: caseData.numeroAcreedoresActual?.toString() || '',
    porcentaje_pasivo_en_mora:
      caseData.porcentajePasivoEnMora?.toString() || '',
    obligaciones_en_mora_90_dias: boolToSiNo(caseData.obligacionesEnMora90Dias),
    procesos_ejecutivos_vigentes: boolToSiNo(
      caseData.procesosEjecutivosVigentes,
    ),

    // Sección VIII: Declaraciones
    declaracion_veracidad: boolToSiNo(caseData.declaracionVeracidadInformacion),
    manifestacion_buena_fe: boolToSiNo(caseData.manifestacionBuenaFe),
    manifestacion_no_ocultamiento: boolToSiNo(
      caseData.manifestacionNoOcultamientoBienes,
    ),
    autorizacion_notificaciones_correo: boolToSiNo(
      caseData.autorizacionNotificacionesCorreo,
    ),
    autorizacion_centrales_riesgo: boolToSiNo(
      caseData.autorizacionConsultaCentralesRiesgo,
    ),
    autorizacion_tratamiento_datos: boolToSiNo(
      caseData.autorizacionTratamientoDatos,
    ),

    // Sección IX: Propuesta Inicial
    propuesta_plazo_meses: caseData.propuestaPlazoMeses?.toString() || '',
    propuesta_periodicidad: caseData.propuestaPeriodicidadPago || '',
    propuesta_tasa_interes: caseData.propuestaTasaInteres?.toString() || '',
    propuesta_quita_promedio: caseData.propuestaQuitaPromedio?.toString() || '',
    propuesta_fecha_inicio: caseData.propuestaFechaInicioPago
      ? formatShortDate(caseData.propuestaFechaInicioPago)
      : '',
    propuesta_observaciones: caseData.propuestaObservaciones || '',

    // Sección X: Documentos Anexos
    anexa_soporte_ingresos: boolToSiNo(caseData.anexaSoporteIngresos),
    anexa_extractos_bancarios: boolToSiNo(caseData.anexaExtractosBancarios),
    anexa_certificados_deuda: boolToSiNo(caseData.anexaCertificadosDeuda),
    anexa_certificado_tradicion: boolToSiNo(caseData.anexaCertificadoTradicion),
    anexa_relacion_procesos: boolToSiNo(caseData.anexaRelacionProcesos),
    anexa_declaracion_renta: boolToSiNo(caseData.anexaDeclaracionRenta),
    anexa_documento_identidad: boolToSiNo(caseData.anexaDocumentoIdentidad),

    // Sección XI: Apoderado
    apoderado_nombre_completo: caseData.apoderadoNombreCompleto || '',
    apoderado_tipo_identificacion: caseData.apoderadoTipoIdentificacion || '',
    apoderado_identificacion: caseData.apoderadoIdentificacion || '',
    apoderado_tarjeta_profesional: caseData.apoderadoTarjetaProfesional || '',
    apoderado_direccion: caseData.apoderadoDireccion || '',
    apoderado_telefono: caseData.apoderadoTelefono || '',
    apoderado_correo: caseData.apoderadoCorreo || '',
    existe_poder_otorgado: boolToSiNo(caseData.existePoderOtorgado),

    // Sección XII: Radicación Interna
    expediente_numero: caseData.expedienteNumero || '',
    expediente_anio: caseData.expedienteAnio?.toString() || '',
    fecha_radicacion_interna: caseData.fechaRadicacion
      ? formatShortDate(caseData.fechaRadicacion)
      : '',
    centro_conciliacion: caseData.centroConciliacionNombre || '',
    conciliador_asignado: caseData.conciliadorAsignado || '',
    ciudad_radicacion: caseData.ciudadRadicacion || '',
  };
}

// Map Sentido del Voto variables (lowercase naming as per HTML template)
function mapSentidoVotoVariables(caseData: CaseWithRelations): PlaceholderMap {
  return {
    // Variables en minúsculas como están en el template Sentido Del Voto.html
    deudor_nombre: caseData.debtor.name,
    deudor_cedula: caseData.debtor.idNumber,
    fecha_documento: formatDate(new Date()),
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

// Generate Detalle de Bienes HTML
function generateDetalleBienes(assets: CaseWithRelations['assets']): string {
  if (!assets || assets.length === 0) {
    return 'El deudor manifiesta no tener bienes a su nombre.';
  }

  const inmuebles = assets.filter(
    (a) => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE',
  );
  const muebles = assets.filter(
    (a) => a.type !== 'INMUEBLE' && a.type !== 'REAL_ESTATE',
  );

  let html = '';

  if (inmuebles.length > 0) {
    html += '<strong>Bienes Inmuebles:</strong><br>';
    html += inmuebles
      .map(
        (a, i) =>
          `${i + 1}. ${a.propertyType || a.type}: ${a.address || a.name || 'Sin dirección'} - Matrícula: ${a.registrationNumber || 'N/A'} - Valor: ${formatCurrency(a.value)}`,
      )
      .join('<br>');
    html += '<br><br>';
  }

  if (muebles.length > 0) {
    html += '<strong>Bienes Muebles:</strong><br>';
    html += muebles
      .map(
        (a, i) =>
          `${i + 1}. ${a.type}: ${a.name || a.description || 'Sin descripción'} - Valor: ${formatCurrency(a.value)}`,
      )
      .join('<br>');
  }

  return html;
}

// Generate Detalle de Pago de Capital HTML
function generateDetallePagoCapital(
  debts: CaseWithRelations['debts'],
  monthlyAmount: number,
  totalCapital: number,
): string {
  if (!debts || debts.length === 0) {
    return '<em>Pendiente de registrar acreedores para calcular distribución de pagos.</em>';
  }

  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:11px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>Acreedor</th><th>Capital</th><th>% Participación</th><th>Cuota Mensual</th></tr>';

  debts.forEach((debt) => {
    const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
    const percentage = totalCapital > 0 ? (capital / totalCapital) * 100 : 0;
    const monthlyPayment = (percentage / 100) * monthlyAmount;

    html += `<tr>
      <td style="padding:5px;">${debt.creditor?.name || 'N/A'}</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(capital)}</td>
      <td style="padding:5px; text-align:center;">${percentage.toFixed(2)}%</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(monthlyPayment)}</td>
    </tr>`;
  });

  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td style="padding:5px;">TOTAL</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalCapital)}</td>
    <td style="padding:5px; text-align:center;">100%</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(monthlyAmount)}</td>
  </tr>`;
  html += '</table>';

  return html;
}

// Generate Forma de Pago a Acreedores HTML
function generateFormaPagoAcreedores(
  debts: CaseWithRelations['debts'],
): string {
  if (!debts || debts.length === 0) {
    return '<em>Pendiente de registrar acreedores.</em>';
  }

  return debts
    .map(
      (debt) =>
        `• <strong>${debt.creditor?.name || 'N/A'}:</strong> Consignación a cuenta bancaria o medio de pago acordado con el acreedor.`,
    )
    .join('<br>');
}

// Generate Proyección de Pagos HTML
function generateProyeccionPagos(
  totalCapital: number,
  months: number,
  monthlyAmount: number,
  startDate?: Date,
): string {
  if (!months || months <= 0 || !monthlyAmount) {
    return 'Proyección pendiente de definir.';
  }

  const start = startDate || new Date();
  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:10px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>#</th><th>Fecha</th><th>Cuota</th><th>Abono Capital</th><th>Saldo</th></tr>';

  let balance = totalCapital;

  // Generate ALL payment rows (no truncation)
  for (let i = 1; i <= months; i++) {
    const paymentDate = new Date(start);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    // Calculate payment applied to capital
    const capitalPayment = Math.min(monthlyAmount, balance);
    balance = Math.max(0, balance - monthlyAmount);

    html += `<tr>
      <td style="padding:3px; text-align:center;">${i}</td>
      <td style="padding:3px; text-align:center;">${paymentDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(monthlyAmount)}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(capitalPayment)}</td>
      <td style="padding:3px; text-align:right;">${formatCurrency(balance)}</td>
    </tr>`;
  }

  // Add totals row
  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td colspan="2" style="padding:5px; text-align:right;">TOTALES</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(monthlyAmount * months)}</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalCapital)}</td>
    <td style="padding:5px; text-align:right;">$0</td>
  </tr>`;

  html += '</table>';
  return html;
}

// Generate Inventario de Bienes HTML (for agreements)
function generateInventarioBienes(assets: CaseWithRelations['assets']): string {
  if (!assets || assets.length === 0) {
    return 'El deudor manifiesta no poseer bienes a su nombre.';
  }

  const totalValue = assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  let html =
    '<table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:11px;">';
  html +=
    '<tr style="background-color:#f0f0f0;"><th>Tipo</th><th>Descripción</th><th>Valor</th></tr>';

  assets.forEach((asset) => {
    html += `<tr>
      <td style="padding:5px;">${asset.type || 'N/A'}</td>
      <td style="padding:5px;">${asset.name || asset.description || asset.address || 'Sin descripción'}</td>
      <td style="padding:5px; text-align:right;">${formatCurrency(Number(asset.value) || 0)}</td>
    </tr>`;
  });

  html += `<tr style="background-color:#e0e0e0; font-weight:bold;">
    <td colspan="2" style="padding:5px; text-align:right;">TOTAL</td>
    <td style="padding:5px; text-align:right;">${formatCurrency(totalValue)}</td>
  </tr>`;
  html += '</table>';

  return html;
}

// Map dynamic tables (these generate HTML content)
function mapDynamicTables(caseData: CaseWithRelations): PlaceholderMap {
  // Build creditors list for edicto
  const creditorsList = caseData.debts
    .map(
      (d, i) =>
        `${i + 1}. ${d.creditor.name} - ${formatCurrency(Number(d.amount) || 0)}`,
    )
    .join('<br>');

  // Build total creditors table
  const totalCreditors = caseData.debts.length;
  const totalDebt = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0,
  );
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );
  const monthlyAmount = Number(caseData.monthlyPaymentAmount) || 0;

  // Build Calificación y Graduación table
  const calificacionTable = generateCalificacionGraduacionTable(
    caseData.debts,
    totalCapital,
  );

  // Build propuesta de pago HTML
  const propuestaPago = generatePropuestaPagoHtml(caseData);

  // Build new dynamic content
  const detalleBienes = generateDetalleBienes(caseData.assets);
  const detallePagoCapital = generateDetallePagoCapital(
    caseData.debts,
    monthlyAmount,
    totalCapital,
  );
  const formaPagoAcreedores = generateFormaPagoAcreedores(caseData.debts);
  const proyeccionPagos = generateProyeccionPagos(
    totalCapital,
    caseData.paymentTermMonths || 0,
    monthlyAmount,
  );
  const inventarioBienes = generateInventarioBienes(caseData.assets);

  return {
    // Dynamic table placeholders
    LISTA_ACREEDORES: creditorsList || '',

    // Creditor count for conditional rendering
    TIENE_ACREEDORES: caseData.debts.length > 0 ? 'SI' : 'NO',
    TIENE_BIENES: caseData.assets.length > 0 ? 'SI' : 'NO',
    TIENE_PROCESOS: (caseData.legalProcesses?.length || 0) > 0 ? 'SI' : 'NO',

    // Summary tables
    CUADRO_TOTAL_ACREEDORES: `
      <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse;">
        <tr><th style="text-align:left; padding:8px;">Total Acreedores</th><td style="padding:8px;">${totalCreditors}</td></tr>
        <tr><th style="text-align:left; padding:8px;">Total Deuda</th><td style="padding:8px;">${formatCurrency(totalDebt)}</td></tr>
      </table>
    `,

    // Calificación y Graduación completa
    CUADRO_CALIFICACION_GRADUACION: calificacionTable,
    CUADRO_CALIFICACION_FIRMADO: calificacionTable,

    // Fracaso tables
    CUADRO_ACUERDO_BILATERAL: calificacionTable,
    CUADRO_FRACASO_NEGOCIACION: calificacionTable,

    // Propuesta de pago
    PROPUESTA_PAGO: propuestaPago,
    PROPUESTA_REFORMA_PAGO: propuestaPago,

    // Proyecto calificación
    PROYECTO_CALIFICACION_GRADUACION: calificacionTable,

    // New dynamic content generators (FASE 2 del plan)
    DETALLE_BIENES: detalleBienes,
    INVENTARIO_BIENES: inventarioBienes,
    DETALLE_PAGO_CAPITAL: detallePagoCapital,
    FORMA_PAGO_ACREEDORES: formaPagoAcreedores,
    PROYECCION_PAGOS: proyeccionPagos,
  };
}

// Generate Calificación y Graduación table HTML
function generateCalificacionGraduacionTable(
  debts: CaseWithRelations['debts'],
  totalCapital: number,
): string {
  if (!debts || debts.length === 0) {
    // Return empty table structure instead of error message
    // The validation layer will prevent document generation if required
    return `
      <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
        <thead>
          <tr style="background-color:#f0f0f0;">
            <th style="padding:8px; border:1px solid #000;">ACREEDOR</th>
            <th style="padding:8px; border:1px solid #000;">No.</th>
            <th style="padding:8px; border:1px solid #000;">PRELACIÓN</th>
            <th style="padding:8px; border:1px solid #000;">CAPITAL</th>
            <th style="padding:8px; border:1px solid #000;">INTERESES</th>
            <th style="padding:8px; border:1px solid #000;">% PARTICIPACIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="6" style="padding:10px; text-align:center; color:#999;">Pendiente de registrar acreedores</td></tr>
        </tbody>
      </table>
    `;
  }

  const tableRows = debts
    .map((debt, index) => {
      const capital = Number(debt.capitalAmount) || Number(debt.amount) || 0;
      const interest = Number(debt.interestAmount) || 0;
      const percentage =
        totalCapital > 0 ? ((capital / totalCapital) * 100).toFixed(2) : '0.00';
      const prelacion = debt.creditorClass || 'Quirografario';

      return `
      <tr>
        <td style="padding:5px; border:1px solid #000;">${debt.creditor?.name || 'N/A'}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${index + 1}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${prelacion}</td>
        <td style="padding:5px; border:1px solid #000; text-align:right;">${formatCurrency(capital)}</td>
        <td style="padding:5px; border:1px solid #000; text-align:right;">${formatCurrency(interest)}</td>
        <td style="padding:5px; border:1px solid #000; text-align:center;">${percentage}%</td>
      </tr>
    `;
    })
    .join('');

  const totalInterest = debts.reduce(
    (sum, d) => sum + (Number(d.interestAmount) || 0),
    0,
  );

  return `
    <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
      <thead>
        <tr style="background-color:#f0f0f0;">
          <th style="padding:8px; border:1px solid #000;">ACREEDOR</th>
          <th style="padding:8px; border:1px solid #000;">No.</th>
          <th style="padding:8px; border:1px solid #000;">PRELACIÓN</th>
          <th style="padding:8px; border:1px solid #000;">CAPITAL</th>
          <th style="padding:8px; border:1px solid #000;">INTERESES</th>
          <th style="padding:8px; border:1px solid #000;">% PARTICIPACIÓN</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr style="background-color:#e0e0e0; font-weight:bold;">
          <td colspan="3" style="padding:8px; border:1px solid #000; text-align:right;">TOTALES</td>
          <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalCapital)}</td>
          <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalInterest)}</td>
          <td style="padding:8px; border:1px solid #000; text-align:center;">100.00%</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// Generate Propuesta de Pago HTML
function generatePropuestaPagoHtml(caseData: CaseWithRelations): string {
  const monthlyIncome =
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const monthlyExpenses =
    Number(caseData.monthlyExpenses) ||
    Number(caseData.debtor.monthlyExpenses) ||
    0;
  const available = monthlyIncome - monthlyExpenses;
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  return `
    <table border="1" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:12px;">
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Ingresos Mensuales:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(monthlyIncome)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Gastos Mensuales:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(monthlyExpenses)}</td>
      </tr>
      <tr style="background-color:#f0f0f0;">
        <td style="padding:8px; border:1px solid #000;"><strong>Disponible para Pago:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;"><strong>${formatCurrency(available)}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Total Capital Adeudado:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(totalCapital)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Plazo Propuesto:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.paymentTermMonths || '____'} meses</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Cuota Mensual Propuesta:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${formatCurrency(Number(caseData.monthlyPaymentAmount) || 0)}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Periodo de Gracia:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.gracePeriodRequested ? `${caseData.gracePeriodMonths} meses` : 'No solicitado'}</td>
      </tr>
      <tr>
        <td style="padding:8px; border:1px solid #000;"><strong>Condonación de Intereses:</strong></td>
        <td style="padding:8px; border:1px solid #000; text-align:right;">${caseData.forgiveAccruedInterest ? 'Causados y Futuros' : 'No solicitada'}</td>
      </tr>
    </table>
  `;
}

// Map payment proposal
function mapPaymentProposal(caseData: CaseWithRelations): PlaceholderMap {
  const monthlyIncome =
    Number(caseData.monthlyIncome) ||
    Number(caseData.debtor.monthlyIncome) ||
    0;
  const monthlyExpenses =
    Number(caseData.monthlyExpenses) ||
    Number(caseData.debtor.monthlyExpenses) ||
    0;
  const available = monthlyIncome - monthlyExpenses;

  // Calculate total capital from debts (Number() prevents Decimal string concatenation)
  const totalCapital = caseData.debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );

  // Parse payment order
  const paymentOrder =
    (caseData.paymentOrder as Record<string, string | null>) || {};

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
    PROP_CUOTA_MENSUAL: formatCurrency(
      Number(caseData.monthlyPaymentAmount) || 0,
    ),
    PROP_CUOTA_VARIABLE: formatCurrency(Number(caseData.variablePayment) || 0),

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
    PROP_QUITAS_VALOR: formatCurrency(
      totalCapital * (1 - (caseData.capitalReductionPercent || 0) / 100),
    ),

    // Insurance
    PROP_SEGURO_INCENDIO: caseData.insuranceOffering?.includes('incendio')
      ? 'X'
      : '',
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
    ANO_ACUERDO: new Date().getFullYear().toString(),
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
    DIA_FIRMA: getDayNumber(new Date()),
    MES_FIRMA: getMonthName(new Date()),
    ANO_FIRMA: new Date().getFullYear().toString(),
    ANO_ACTUAL: new Date().getFullYear().toString(),
  };

  // Merge all mappings
  return {
    ...basePlaceholders,
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
    // Formulario definitivo mappings (lowercase snake_case for new templates)
    ...mapAcreedoresDefinitivo(caseData),
    ...mapBienesDefinitivo(caseData),
    ...mapProcesosJudicialesDefinitivo(caseData),
    ...mapFormularioDefinitivoFields(caseData),
  };
}

/**
 * Replace placeholders in HTML content
 */
export function replacePlaceholders(
  html: string,
  placeholders: PlaceholderMap,
): string {
  let result = html;

  for (const [key, value] of Object.entries(placeholders)) {
    // Replace {{KEY}} pattern
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
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
  // Find all {{VARIABLE}} patterns in the HTML
  const regex = /\{\{([A-Za-z0-9_]+)\}\}/g;
  const matches = [...html.matchAll(regex)];
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
