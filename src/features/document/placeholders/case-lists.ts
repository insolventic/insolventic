/**
 * Sub-mappers de listas simples del caso (Paso 2 de la división de
 * `placeholder-mapper.ts`; ver el plan y la red de seguridad en
 * `tests/unit/documents/mapper-golden.test.ts`).
 *
 * Se movieron aquí, SIN cambiar su código, los sub-mappers que cumplen las dos
 * condiciones que definen "menor riesgo" en el plan: no dependen de ningún otro
 * sub-mapper (solo del tipo `PlaceholderMap` y, en dos casos, de `formatCurrency`,
 * ya extraído en el Paso 1) y no participan en ninguna de las 19 colisiones del
 * contrato de orden de fusión (`mapper-merge-order.test.ts`).
 *
 * A propósito NO se movieron en este paso (quedan para más adelante):
 *   - `mapApplicantScope` y `mapExternalEntities`: son igual de simples, pero SÍ
 *     colisionan (`TIPO_SOLICITANTE` con `mapAgreementResult` — Hallazgo 3, en
 *     pausa; `NUMERO_JUZGADO`/`RADICADO_BILATERAL` con `mapFracasoVariables`) —
 *     mejor moverlos junto con su contraparte de colisión, no sueltos.
 *   - `mapDebts`/`mapAssets`: sin colisiones ni dependencias tampoco, pero mucho
 *     más grandes (107/156 líneas) — otro paso.
 *   - `mapCheckList`: tiene el hallazgo de los 3 párrafos sin resolver, en pausa
 *     pendiente de la abogada — se evita tocarlo aunque el movimiento en sí no
 *     cambiaría su comportamiento.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { formatCurrency } from './format';

// Map causes to individual placeholders
export function mapCauses(
  causes: string[],
  otherCauseDetail?: string | null,
): PlaceholderMap {
  // Match by DB value (SOBREENDEUDAMIENTO, PERDIDA_EMPLEO, etc.)
  // The form stores enum values, not display labels
  const causeValues = [
    'SOBREENDEUDAMIENTO',
    'PERDIDA_EMPLEO',
    'DIVORCIO',
    'ENFERMEDAD',
    'ACCIDENTE',
    'ESTAFA',
    'DISMINUCION_INGRESOS',
    'MALA_EDUCACION_FINANCIERA',
    'MUERTE_CONYUGE',
    'NUEVOS_CREDITOS',
    'MALA_INVERSION',
    'OTROS',
  ];

  const result: PlaceholderMap = {};
  for (let i = 0; i < 12; i++) {
    const causeKey = `CAUSA_${i + 1}`;
    result[causeKey] = causes.includes(causeValues[i]) ? 'SI' : 'NO';
  }
  result['CAUSA_12_DETALLE'] =
    otherCauseDetail || causes.find((c) => !causeValues.includes(c)) || '';
  return result;
}

// Map legal processes
export function mapLegalProcesses(
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
export function mapLibranzas(
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
export function mapSuspendedServices(
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
    // Alias for Restablecimiento de Servicios template
    NOMBRE_EMPRESA_SERVICIOS: svc?.creditorName || '____',
  };
}

// Map dependents (alimentary obligations)
export function mapDependents(
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
