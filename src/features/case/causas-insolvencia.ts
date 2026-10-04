/**
 * Causas de la insolvencia — lista única del sistema.
 *
 * Mismo patrón que `proceso-judicial-tipos.ts`, y por la misma razón: había
 * TRES listas distintas para la misma pregunta, y ninguna hablaba con las otras.
 *
 *   1. `create-case-dialog.tsx` guardaba ETIQUETAS en español
 *      (`'Pérdida de empleo'`).
 *   2. `validation-rules.ts` declaraba `CAUSE_OPTIONS` con pares value/label
 *      (`{ value: 'PERDIDA_EMPLEO', … }`) que no consumía nadie.
 *   3. `placeholders/case-lists.ts` comparaba contra VALORES de enum
 *      (`causes.includes('PERDIDA_EMPLEO')`).
 *
 * Como el formulario escribía (1) y el mapper leía (3), la comparación nunca
 * daba verdadera: **las 12 filas de la Sección 2 de la Solicitud de Insolvencia
 * salían "NO"**, aunque el deudor hubiera marcado tres causas — en un documento
 * que se firma bajo juramento. Medido en los 195 PDF de
 * `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md` (hallazgo T2).
 *
 * Había una cuarta divergencia: `edit-case-dialog.tsx` tenía su propia copia de
 * la lista, con 11 ítems en vez de 12 — sin "Otros", así que esa causa no se
 * podía marcar al editar un expediente.
 *
 * EL ORDEN IMPORTA Y NO SE TOCA. `mapCauses` emite `CAUSA_1 … CAUSA_12` por
 * posición, y esas 12 claves son las 12 filas de la tabla de la plantilla. El
 * orden de esta lista es, fila por fila, el de
 * `templates/insolvency/Solicitud de Insolvencia.html`. Reordenarla mueve los
 * SI/NO de renglón.
 *
 * Sigue siendo `String[]` en Prisma, no un enum de la base: el schema no usa
 * enums en ninguna parte. El contrato se sostiene desde acá.
 */

/** Valor de la causa que exige el texto libre "¿cuál?". */
export const CAUSA_OTROS = 'OTROS';

export interface CausaInsolvenciaOption {
  /** Valor que se persiste. */
  readonly value: string;
  /** Texto que ve el usuario (y que imprime la plantilla en su renglón). */
  readonly label: string;
  /**
   * Etiquetas con las que ESTA causa quedó guardada antes de la unificación.
   *
   * Los expedientes que ya están en producción tienen la etiqueta, no el valor:
   * sin esta tabla, arreglar el formulario dejaría bien los casos nuevos y
   * seguiría imprimiendo "NO" en todos los viejos. Se incluyen las dos
   * redacciones que convivían (la del wizard y la de `CAUSE_OPTIONS`).
   */
  readonly legacyLabels?: readonly string[];
}

export const CAUSAS_INSOLVENCIA: readonly CausaInsolvenciaOption[] = [
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
    label: 'Falta de educación financiera y malos hábitos financieros',
    legacyLabels: [
      'Falta de educación financiera',
      'Falta de educación financiera y malos hábitos',
    ],
  },
  { value: 'MUERTE_CONYUGE', label: 'Muerte de cónyuge' },
  {
    value: 'NUEVOS_CREDITOS',
    label: 'Acudí a nuevos créditos para cubrir otros',
    legacyLabels: ['Nuevos créditos para cubrir otros'],
  },
  { value: 'MALA_INVERSION', label: 'Mala inversión' },
  { value: CAUSA_OTROS, label: 'Otros' },
] as const;

/** Valores válidos, para validar y para los tests. */
export const CAUSAS_VALUES: readonly string[] = CAUSAS_INSOLVENCIA.map(
  (c) => c.value,
);

/** Clave de comparación: sin tildes, sin mayúsculas, sin espacios de más. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** valor | etiqueta | etiqueta histórica → valor canónico. */
const LOOKUP: ReadonlyMap<string, string> = new Map(
  CAUSAS_INSOLVENCIA.flatMap((causa) =>
    [causa.value, causa.label, ...(causa.legacyLabels ?? [])].map(
      (alias) => [normalizeKey(alias), causa.value] as const,
    ),
  ),
);

/**
 * Lleva a su valor canónico una causa guardada, venga como valor o como
 * cualquiera de las etiquetas con las que se guardó históricamente.
 *
 * Devuelve `null` cuando no reconoce el texto: eso es una causa escrita a mano,
 * y `mapCauses` la trata como "Otros" en vez de descartarla.
 */
export function normalizeCausa(stored: string): string | null {
  return LOOKUP.get(normalizeKey(stored)) ?? null;
}

/** Normaliza la lista completa, sin duplicados y conservando el orden. */
export function normalizeCausas(stored: readonly string[]): string[] {
  const out: string[] = [];
  for (const causa of stored) {
    const value = normalizeCausa(causa);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/** Las entradas que no corresponden a ninguna causa conocida. */
export function unknownCausas(stored: readonly string[]): string[] {
  return stored.filter((causa) => causa.trim() && !normalizeCausa(causa));
}

/** Texto a mostrar para una causa guardada (acepta valores y etiquetas viejas). */
export function causaLabel(stored: string): string {
  const value = normalizeCausa(stored);
  if (!value) return stored;
  return CAUSAS_INSOLVENCIA.find((c) => c.value === value)!.label;
}

/** ¿La selección exige el texto libre de "Otros"? */
export function requiresOtherCauseDetail(stored: readonly string[]): boolean {
  return normalizeCausas(stored).includes(CAUSA_OTROS);
}
