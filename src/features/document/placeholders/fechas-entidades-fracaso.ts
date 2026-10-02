/**
 * Fechas extendidas + entidades externas + variables de fracaso (Paso 9b de
 * la división de `placeholder-mapper.ts`; ver el plan en
 * `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `mapExtendedDates`,
 * `mapExternalEntities` y `mapFracasoVariables`. Colisionan entre sí —
 * `mapExtendedDates` con `mapFracasoVariables` en `ANO_BILATERAL`,
 * `NUMERO_CONSTANCIA` y `ANO_CONSTANCIA`; `mapExternalEntities` con
 * `mapFracasoVariables` en `NUMERO_JUZGADO` y `RADICADO_BILATERAL`— así que
 * se mueven juntas: es uno de los pares (en este caso trío) de colisión del
 * Paso 9, y separarlas dejaría el contrato de orden de fusión
 * (`mapper-merge-order.test.ts`) analizando dos archivos para las mismas
 * claves sin ganar nada. `mapExtendedDates` también colisiona con
 * `mapConciliationFields` (Paso 7, ya en su propio archivo) en
 * `ANO_CONSTANCIA`/`DIA_DESISTIMIENTO`/`MES_DESISTIMIENTO`/`ANO_DESISTIMIENTO`
 * — esa colisión ya quedó cruzando archivos desde el Paso 7, sin que nada se
 * rompiera, porque el contrato ya sabe seguir `./placeholders/*`.
 *
 * Ninguna llama a `escapePlaceholder` (solo formatean fechas y pasan campos
 * planos), así que no repiten la dependencia circular del Paso 4.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { tipoProcesoLabel } from '../../case/proceso-judicial-tipos';
import {
  getYear,
  getDayNumber,
  getMonthName,
  formatDateComplete,
  formatDate,
} from './format';
import { nowColombia } from '@/lib/date-colombia';

// Map additional date variables (ANO_*, DIA_*, MES_*)
export function mapExtendedDates(caseData: CaseWithRelations): PlaceholderMap {
  const now = nowColombia();
  const filingDate = caseData.filingDate ? new Date(caseData.filingDate) : null;

  return {
    // Year variables
    ANO: getYear(now),
    ANO_RADICADO: getYear(filingDate) || getYear(now),
    ANO_TRAMITE: getYear(filingDate) || getYear(now),
    ANO_CONSTANCIA: getYear(now),
    ANO_BILATERAL: getYear(now),
    // DIA/MES/ANO_FRACASO no se definen aquí: los produce mapFracasoVariables
    // desde failureDate (con marcador manual si falta). Tenerlos duplicados
    // con valores distintos dependía del orden del spread en
    // mapCaseToPlaceholders, y el "// Manual" de aquí nunca llegaba al documento.
    // ANO_INICIO_PAGO/ANO_VIGENCIA: ídem, los produce mapAgreementResult desde
    // paymentStartDate/agreementValidityDate (Hallazgo-2).
    // resultDate guarda la fecha del desistimiento (docs/DISENO_FASES_NUEVAS_2026-09-11.md
    // §6); cae a "now" si todavía no se registró, igual que ANO_RADICADO con filingDate.
    ANO_DESISTIMIENTO: getYear(caseData.resultDate) || getYear(now),

    // Day variables
    DIA: getDayNumber(now),
    DIA_DESISTIMIENTO: getDayNumber(caseData.resultDate) || getDayNumber(now),

    // Month variables
    MES: getMonthName(now),
    MES_DESISTIMIENTO: getMonthName(caseData.resultDate) || getMonthName(now),

    // Complete date
    FECHA_COMPLETA: formatDateComplete(now),

    // Constancia
    NUMERO_CONSTANCIA: caseData.caseNumber || '',
  };
}

// Map external entities (judges, plaintiffs, etc.)
export function mapExternalEntities(
  caseData: CaseWithRelations,
): PlaceholderMap {
  // Get first legal process if exists
  const firstProcess = caseData.legalProcesses?.[0];

  // Get first libranza if exists
  const firstLibranza = caseData.libranzas?.[0];

  return {
    // Judge information (Manual - filled during suspension)
    NOMBRE_JUZGADO: firstProcess?.court || '',
    NUMERO_JUZGADO: firstProcess?.fileNumber || '',
    NOMBRE_DEMANDANTE: firstProcess?.plaintiff || '',
    // La ETIQUETA, no el valor persistido: los tipos se guardan como
    // 'RESTITUCION_INMUEBLE' / 'OTROS' (ver proceso-judicial-tipos.ts) y eso es
    // lo que salia impreso en el oficio que lee el juzgado. En 'OTROS' el
    // helper devuelve el texto libre que escribio el operador.
    TIPO_PROCESO: tipoProcesoLabel(
      firstProcess?.processType,
      firstProcess?.processTypeOther,
    ),

    // Payer entity (from libranzas)
    NOMBRE_ENTIDAD_PAGADORA: firstLibranza?.payerName || '',

    // Bilateral agreement (Manual)
    RADICADO_BILATERAL: '',
  };
}

// Map fracaso (failure) specific variables
export function mapFracasoVariables(
  caseData: CaseWithRelations,
): PlaceholderMap {
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
    ANO_BILATERAL: getYear(nowColombia()),
    ES_BILATERAL: caseData.isBilateral ? 'SI' : 'NO',

    // Constancia
    NUMERO_CONSTANCIA: caseData.caseNumber?.replace(/[^0-9]/g, '') || '',
    ANO_CONSTANCIA: getYear(nowColombia()),
  };
}
