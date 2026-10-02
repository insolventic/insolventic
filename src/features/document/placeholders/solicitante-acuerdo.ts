/**
 * Alcance del solicitante + resultado del acuerdo (Paso 9a de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `mapApplicantScope` y
 * `mapAgreementResult`. Colisionan en `TIPO_SOLICITANTE`: las dos lo emiten
 * y, en el orden de fusión, gana `mapAgreementResult` (se llama después en
 * `mapCaseToPlaceholders`) — el único caso real es cuando el alcance viene en
 * texto libre y no coincide con el código (`PERSONA_NATURAL_PEQUENA_COMERCIANTE`),
 * ver el escenario `insolvencia-alcance-texto`. Por eso se mueven juntas: es
 * uno de los pares de colisión del Paso 9, y separarlas dejaría el contrato
 * de orden de fusión (`mapper-merge-order.test.ts`) analizando dos archivos
 * para la misma clave sin ganar nada.
 *
 * No llaman a `escapePlaceholder` (solo formatean números/fechas y pasan
 * campos planos), así que no repiten la dependencia circular del Paso 4.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import {
  formatCurrency,
  getGenderArticle,
  getYear,
  formatIdNumber,
} from './format';
import { nowColombia } from '@/lib/date-colombia';

// Map applicant scope
export function mapApplicantScope(scope: string[]): PlaceholderMap {
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

// Map agreement and result variables
export function mapAgreementResult(
  caseData: CaseWithRelations,
): PlaceholderMap {
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
    ANO_FIRMA: getYear(nowColombia()),

    // Nombres en formatos adicionales
    NOMBRE_DEUDOR_MAYUSCULAS: caseData.debtor.name?.toUpperCase() || '',
    CEDULA_DEUDOR_FORMATO: formatIdNumber(caseData.debtor.idNumber),
  };
}
