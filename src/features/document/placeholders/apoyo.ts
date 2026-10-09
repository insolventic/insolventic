/**
 * Acuerdo de Apoyo: sub-mapper de placeholders (Paso 8 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * `mapApoyoFields` llena el mapa escalar (string-only), que
 * `mapCaseToPlaceholders` pasa por `escapeAllUnlessHtml` en el punto de
 * fusión. `buildApoyoContext` llena el contexto de BLOQUES —arrays para
 * `{{#each}}`, booleanos para `{{#if}}`—, que viaja por `extraContext` y
 * NUNCA pasa por ese escape (`renderDocumentHtml` lo funde tal cual:
 * `{...extraContext, ...placeholders}`). Misma separación que
 * `buildConciliationContext`/`mapConciliationFields` en `conciliacion.ts`.
 *
 * Antes de este archivo, `CLAUSULAS_APOYO` viajaba por el mapa escalar con
 * un cast (`as unknown as string`): `escapeAllUnlessHtml` llama
 * `escapePlaceholder` sobre cualquier valor no-string con `String(value)`, y
 * un array de objetos se convierte en `"[object Object],[object Object],..."`
 * — el `{{#each}}` de la plantilla recibía un string, `Array.isArray` daba
 * `false`, y el bloque renderizaba vacío. Hallazgo §4.3 de
 * `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { formatCurrency } from './format';
import { escapePlaceholder } from './escape';

/**
 * Escapa los strings de un item de un array que va a `{{#each}}` — mismo
 * patrón que `buildConciliationContext`: el item se inserta en el HTML sin
 * más procesamiento (no pasa por `escapeAllUnlessHtml`), así que se escapa
 * acá, campo por campo, sin tocar valores que no son string.
 */
function escapeItem<T extends object>(item: T): T {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      typeof value === 'string' ? escapePlaceholder(value) : value,
    ]),
  ) as T;
}

/**
 * Contexto de bloques del Acuerdo de Apoyo: las cláusulas numeradas
 * (`{{#each CLAUSULAS_APOYO}}`) y la bandera que decide si se imprime la
 * sección.
 *
 * `TIENE_CLAUSULAS_APOYO` es un booleano de JS, no la cadena `'SI'`/`'NO'`
 * que tenía antes: `handlebars-lite` trata como verdadero cualquier string
 * no vacío —`'NO'` incluido—, así que `{{#if TIENE_CLAUSULAS_APOYO}}`
 * imprimía el encabezado "CLÁUSULAS" aunque la lista estuviera vacía.
 */
export function buildApoyoContext(
  caseData: CaseWithRelations,
): Record<string, unknown> {
  const raw = caseData as Record<string, unknown>;

  const clausulas = (
    Array.isArray(raw.apoyoClausulas) ? raw.apoyoClausulas : []
  ).map((item) =>
    item && typeof item === 'object'
      ? escapeItem(item as { NUMERO_CLAUSULA: string; TEXTO_CLAUSULA: string })
      : item,
  );

  return {
    CLAUSULAS_APOYO: clausulas,
    TIENE_CLAUSULAS_APOYO: clausulas.length > 0,
  };
}

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
  // LIMITACIÓN (igual que el hallazgo A6 de conciliacion.ts): la cédula no
  // tiene respaldo. `User` no guarda ninguna identificación —su único número
  // es la tarjeta profesional—, así que usarla también acá imprimiría el
  // mismo número en dos renglones que dicen cosas distintas, en un documento
  // legal. Queda en blanco hasta que exista el dato.
  const conciliadoraCC = (raw.apoyoConciliadoraCC as string) || '';
  // La tarjeta profesional SÍ tiene respaldo: es `User.professionalCard` del
  // operador asignado al caso. Antes no caía acá, y el bloque de firma salía
  // con "T.P. " en blanco pese a que el dato estaba disponible.
  const conciliadoraTP =
    (raw.apoyoConciliadoraTP as string) ||
    caseData.operator?.professionalCard ||
    '';

  // Agreement content
  const asunto = (raw.apoyoAsunto as string) || '';
  const hechos = (raw.apoyoDescripcionHechos as string) || '';
  const pretensiones = (raw.apoyoPretensiones as string) || '';
  const montoMensualRaw = (raw.apoyoMontoMensual as string) || '';
  const plazoMeses = (raw.apoyoPlazoMeses as string) || '';
  const condiciones = (raw.apoyoCondiciones as string) || '';
  const tipoApoyo = (raw.apoyoTipoApoyo as string) || '';
  const acuerdoTexto = (raw.apoyoAcuerdo as string) || '';
  const resultado = (raw.apoyoResultado as string) || '';
  const causaTerminacion = (raw.apoyoCausaTerminacion as string) || '';

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
    MONTO_MENSUAL_APOYO: montoMensualRaw
      ? formatCurrency(parseFloat(montoMensualRaw.replace(/[^0-9.]/g, '')) || 0)
      : 'N/A',
    MONTO_MENSUAL_APOYO_RAW: montoMensualRaw,
    // 'N/A', no vacío: la plantilla imprime "{{PLAZO_MESES_APOYO}} meses" sin
    // condicional, así que un acuerdo sin plazo (A2 de la verificación de
    // punta a punta) salía como la fila "meses" sola, sin nada antes.
    PLAZO_MESES_APOYO: plazoMeses || 'N/A',
    CONDICIONES_APOYO: condiciones,
    TIPO_APOYO: tipoApoyo,

    // Acuerdo
    ACUERDO_APOYO: acuerdoTexto,
    RESULTADO_APOYO: resultado,
    CAUSA_TERMINACION_APOYO: causaTerminacion,
  };
}
