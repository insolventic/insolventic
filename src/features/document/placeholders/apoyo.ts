/**
 * Acuerdo de Apoyo: sub-mapper de placeholders (Paso 8 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueve aquí, SIN cambiar su código, `mapApoyoFields`. Cumple las dos
 * condiciones de "menor riesgo" del plan: no depende de ningún otro
 * sub-mapper (solo del tipo `PlaceholderMap`/`CaseWithRelations` y de
 * `formatCurrency`, ya extraído en el Paso 1) y no participa en ninguna de
 * las 16 colisiones del contrato de orden de fusión
 * (`mapper-merge-order.test.ts`). Se llama desde un solo lugar,
 * `mapCaseToPlaceholders`.
 *
 * No llama a `escapePlaceholder`: no interpola texto libre del usuario en
 * HTML, solo formatea un monto y pasa el resto de los campos tal cual
 * (`PlaceholderMap` los escapa como string normal en el punto de fusión). No
 * repite la dependencia circular del Paso 4.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { formatCurrency } from './format';

// ============================================================
// ACUERDO DE APOYO — placeholder mapping
// ============================================================
export function mapApoyoFields(caseData: CaseWithRelations): PlaceholderMap {
  const raw = caseData as Record<string, unknown>;
  const debtor = caseData.debtor;

  // Beneficiario defaults to the debtor if not explicitly set
  const beneficiarioName = (raw.apoyoBeneficiarioName as string) || debtor.name;
  const beneficiarioTipoId = (raw.apoyoBeneficiarioTipoId as string) || 'CC';
  const beneficiarioId = (raw.apoyoBeneficiarioId as string) || debtor.idNumber;
  const beneficiarioDir =
    (raw.apoyoBeneficiarioDireccion as string) || debtor.address;
  const beneficiarioCiudad =
    (raw.apoyoBeneficiarioCiudad as string) || debtor.city || '';
  const beneficiarioCorreo =
    (raw.apoyoBeneficiarioCorreo as string) || debtor.email;
  const beneficiarioCel = (raw.apoyoBeneficiarioCel as string) || debtor.phone;

  // Prestador (the supporting party)
  const prestadorName = (raw.apoyoPrestadorName as string) || '';
  const prestadorTipoId = (raw.apoyoPrestadorTipoId as string) || 'CC';
  const prestadorId = (raw.apoyoPrestadorId as string) || '';
  const prestadorDir = (raw.apoyoPrestadorDireccion as string) || '';
  const prestadorCiudad = (raw.apoyoPrestadorCiudad as string) || '';
  const prestadorCorreo = (raw.apoyoPrestadorCorreo as string) || '';
  const prestadorCel = (raw.apoyoPrestadorCel as string) || '';
  const prestadorRelacion = (raw.apoyoPrestadorRelacion as string) || '';

  // Conciliadora
  const conciliadoraName =
    (raw.apoyoConciliadoraName as string) || caseData.operator?.name || '';
  const conciliadoraCC = (raw.apoyoConciliadoraCC as string) || '';
  const conciliadoraTP = (raw.apoyoConciliadoraTP as string) || '';

  // Agreement content
  const asunto = (raw.apoyoAsunto as string) || '';
  const hechos = (raw.apoyoDescripcionHechos as string) || '';
  const pretensiones = (raw.apoyoPretensiones as string) || '';
  const montoMensual = (raw.apoyoMontoMensual as string) || '';
  const plazoMeses = (raw.apoyoPlazoMeses as string) || '';
  const condiciones = (raw.apoyoCondiciones as string) || '';
  const tipoApoyo = (raw.apoyoTipoApoyo as string) || '';
  const acuerdoTexto = (raw.apoyoAcuerdo as string) || '';
  const resultado = (raw.apoyoResultado as string) || '';
  const causaTerminacion = (raw.apoyoCausaTerminacion as string) || '';

  // Dynamic clauses array
  const asArray = <T = Record<string, unknown>>(v: unknown): T[] =>
    Array.isArray(v) ? (v as T[]) : [];
  const clausulas = asArray<{
    NUMERO_CLAUSULA: string;
    TEXTO_CLAUSULA: string;
  }>(raw.apoyoClausulas);

  return {
    // Beneficiario
    NOMBRE_BENEFICIARIO: beneficiarioName,
    TIPO_ID_BENEFICIARIO: beneficiarioTipoId,
    ID_BENEFICIARIO: beneficiarioId,
    DIRECCION_BENEFICIARIO: beneficiarioDir,
    CIUDAD_BENEFICIARIO: beneficiarioCiudad,
    CORREO_BENEFICIARIO: beneficiarioCorreo,
    CEL_BENEFICIARIO: beneficiarioCel,

    // Prestador
    NOMBRE_PRESTADOR: prestadorName,
    TIPO_ID_PRESTADOR: prestadorTipoId,
    ID_PRESTADOR: prestadorId,
    DIRECCION_PRESTADOR: prestadorDir,
    CIUDAD_PRESTADOR: prestadorCiudad,
    CORREO_PRESTADOR: prestadorCorreo,
    CEL_PRESTADOR: prestadorCel,
    RELACION_PRESTADOR: prestadorRelacion,

    // Conciliadora
    NOMBRE_CONCILIADORA_APOYO: conciliadoraName,
    CC_CONCILIADORA_APOYO: conciliadoraCC,
    TP_CONCILIADORA_APOYO: conciliadoraTP,

    // Solicitud
    ASUNTO_APOYO: asunto,
    HECHOS_APOYO: hechos,
    PRETENSIONES_APOYO: pretensiones,
    MONTO_MENSUAL_APOYO: montoMensual
      ? formatCurrency(parseFloat(montoMensual.replace(/[^0-9.]/g, '')) || 0)
      : '',
    MONTO_MENSUAL_APOYO_RAW: montoMensual,
    PLAZO_MESES_APOYO: plazoMeses,
    CONDICIONES_APOYO: condiciones,
    TIPO_APOYO: tipoApoyo,

    // Acuerdo
    ACUERDO_APOYO: acuerdoTexto,
    RESULTADO_APOYO: resultado,
    CAUSA_TERMINACION_APOYO: causaTerminacion,

    // Clauses for {{#each CLAUSULAS_APOYO}}
    CLAUSULAS_APOYO: clausulas as unknown as string,
    TIENE_CLAUSULAS_APOYO: clausulas.length > 0 ? 'SI' : 'NO',
  };
}
