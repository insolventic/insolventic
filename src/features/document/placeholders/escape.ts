/**
 * El corte de seguridad del mapper: escape HTML OWASP safe-by-default.
 *
 * Nace en el commit 758b733 (P2, Sesión 1 de `CLAUDE.md`): `escapePlaceholder`
 * + la allowlist de placeholders HTML del sistema + `escapeAllUnlessHtml`,
 * aplicado una sola vez al final de `mapCaseToPlaceholders` ("el punto de
 * fusión"). Se extrae aquí SIN cambiar su código, en un PR propio e
 * independiente del plan de división de `placeholder-mapper.ts`
 * (`docs/PLAN_DIVISION_MAPPER.md`), después de confirmar que "el punto de
 * fusión" nombra un lugar en el FLUJO DE EJECUCIÓN —el final de
 * `mapCaseToPlaceholders`, donde confluyen por spread los ~30 sub-mappers—,
 * no un archivo. El commit original y la Sesión 1 de `CLAUDE.md` solo
 * discuten CUÁNDO escapar (centralizado al fusionar, en vez de valor por
 * valor en cada sub-mapper); ninguno de los dos dice nada sobre en qué
 * archivo debe vivir el código.
 *
 * Mover el archivo no mueve el punto de fusión: `mapCaseToPlaceholders` sigue
 * en `placeholder-mapper.ts` y sigue llamando a `escapeAllUnlessHtml` como
 * última operación (lo verifica `html-escape-guard.test.ts`, parte 5.3); cada
 * builder HTML sigue llamando a `escapePlaceholder` en el mismo punto exacto
 * de su código (comparación byte a byte, igual que en cualquier otro paso de
 * la división).
 *
 * Efecto colateral deseado: el Paso 4 (`placeholders/income.ts`) había creado
 * una dependencia circular real —`placeholder-mapper.ts` → `income.ts` →
 * `placeholder-mapper.ts`— solo para que `income.ts` pudiera llamar a
 * `escapePlaceholder`. Con las tres piezas acá, ese ciclo desaparece:
 * `placeholder-mapper.ts` e `income.ts` importan de este archivo, ninguno del
 * otro. Los Pasos 6, 7 y 9 del plan (que también llaman a `escapePlaceholder`
 * desde fuera de `placeholder-mapper.ts`) importan de acá directamente, sin
 * repetir el patrón circular.
 */

import type { PlaceholderMap } from '../placeholder-mapper';

/**
 * Escapa caracteres HTML especiales en un valor string (regla OWASP: & < > " ').
 * Usado para datos capturados del usuario (nombres, direcciones, descripciones)
 * que se insertan en las plantillas HTML de los documentos.
 *
 * @param value Valor a escapar (puede ser null/undefined/number)
 * @returns String escapado o convertido
 */
export function escapePlaceholder(value: unknown): string {
  if (typeof value !== 'string') {
    return String(value ?? '');
  }

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Allowlist de placeholders HTML — construidos por el sistema (tablas, listas,
 * narrativas). Sus interpolaciones de datos de usuario se escapan DENTRO del
 * builder correspondiente. Todo lo demás se escapa automáticamente en el punto
 * de fusión (safe-by-default): cualquier placeholder escalar nuevo queda
 * protegido sin tocar código; agregar HTML del sistema requiere listarlo aquí.
 */
export const HTML_PLACEHOLDERS_ALLOWLIST = new Set<string>([
  'LISTA_ANEXOS',
  'NARRATIVA_INGRESOS',
  'LISTA_ACREEDORES',
  'CUADRO_TOTAL_ACREEDORES',
  'CUADRO_CALIFICACION_GRADUACION',
  'CUADRO_CALIFICACION_FIRMADO',
  'CUADRO_ACUERDO_BILATERAL',
  'CUADRO_FRACASO_NEGOCIACION',
  'PROYECTO_CALIFICACION_GRADUACION',
  'PROPUESTA_PAGO',
  'PROPUESTA_REFORMA_PAGO',
  'DETALLE_BIENES',
  'INVENTARIO_BIENES',
  'DETALLE_PAGO_CAPITAL',
  'FORMA_PAGO_ACREEDORES',
  'PROYECCION_PAGOS',
]);

/**
 * Escapa todos los valores string del mapa excepto los HTML del sistema
 * (allowlist). Aplicado una sola vez, en el punto de fusión final de
 * mapCaseToPlaceholders.
 */
export function escapeAllUnlessHtml(map: PlaceholderMap): PlaceholderMap {
  const escaped: PlaceholderMap = {};
  for (const [key, value] of Object.entries(map)) {
    escaped[key] = HTML_PLACEHOLDERS_ALLOWLIST.has(key)
      ? value
      : escapePlaceholder(value);
  }
  return escaped;
}
