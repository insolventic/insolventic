import type { z } from 'zod';

import { updateCaseSchema } from '@/features/case/schemas';
import { isTypeSpecificField } from './type-specific-fields';

/**
 * Campos de `updateCaseSchema` que este diálogo maneja aparte de la lista
 * genérica de abajo — no por prefijo, como `conc*`/`apoyo*` (ver
 * `type-specific-fields.ts`), sino porque cada uno cae en alguno de estos
 * tres casos:
 *
 *  (a) Estructural: identifica el caso o decide qué pestañas se renderizan, y
 *      se fija en el `useForm` inicial antes de que termine de cargar
 *      (`id`, `version`, `debtorId`, `type`).
 *  (b) Ya tiene lógica propia que el derivado genérico rompería si la
 *      reemplazara: `phase` usa `'Inicial'` como default, no el blanco
 *      genérico; `creditors` en el submit se computa de `debts.length`, no es
 *      un passthrough; `hearingDate` usa `null` como blanco (el resto de las
 *      fechas usa `''`) por una dependencia del calendario que no se tocó
 *      acá; `monthlyIncome`/`monthlyExpenses`/`otherIncomeDescription`/
 *      `otherIncomeAmount`/`hasEmployerCertification` viven en
 *      `fullCase.debtor`, no en `fullCase` directamente.
 *  (c) Pertenece a otro flujo, no a este diálogo: `failureType`/`failureDate`
 *      y `resultType`/`resultDate` los escribe `updateCasePhase` (ver
 *      `phase-transition-dialog.tsx` y `actions.ts:2331-2336`), nunca este
 *      formulario.
 *
 * Si alguno de estos deja de necesitar su manejo especial, sacarlo de acá y
 * dejar que lo cubra `GENERAL_SCALAR_FIELDS`.
 */
export const HANDLED_ELSEWHERE = new Set([
  'id',
  'version',
  'debtorId',
  'type',
  'phase',
  'hearingDate',
  'creditors',
  'monthlyIncome',
  'monthlyExpenses',
  'otherIncomeDescription',
  'otherIncomeAmount',
  'hasEmployerCertification',
  'failureType',
  'failureDate',
  'resultType',
  'resultDate',
]);

/**
 * Todo lo demás de `updateCaseSchema`: ~230 columnas escalares (no arreglos
 * de relación — esos ni siquiera están en este schema, ver
 * `addDebtToCaseSchema` y hermanos) que antes había que enumerar a mano en el
 * `reset()` y en el `submitData` del diálogo de edición. Enumerarlas a mano
 * es exactamente cómo se llegó al hallazgo original: 19 campos de Sección
 * III, 10 de cónyuge, 6 de cesación de pagos, 8 de declaraciones, 8 del
 * apoderado legacy y `notificationCity`/`otherCauseDetail` quedaron afuera
 * sin que nada avisara.
 */
export const GENERAL_SCALAR_FIELDS: readonly string[] = Object.keys(
  updateCaseSchema.shape,
).filter((key) => !isTypeSpecificField(key) && !HANDLED_ELSEWHERE.has(key));

type ZodShape = Record<string, z.ZodTypeAny>;

/** Pela `Optional`/`Nullable`/`Default`/`Catch` hasta el tipo de fondo. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current: z.ZodTypeAny = schema;
  for (let i = 0; i < 10; i++) {
    const name = (current as { constructor: { name: string } }).constructor
      .name;
    if (
      name === 'ZodOptional' ||
      name === 'ZodNullable' ||
      name === 'ZodDefault' ||
      name === 'ZodCatch'
    ) {
      const def = (
        current as unknown as {
          _def: { innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny };
        }
      )._def;
      current = (def.innerType ?? def.schema) as z.ZodTypeAny;
    } else {
      break;
    }
  }
  return current;
}

function baseTypeName(key: string): string {
  const shape = updateCaseSchema.shape as ZodShape;
  const field = shape[key];
  return field ? unwrap(field).constructor.name : 'ZodString';
}

/** El valor en blanco para un campo sin dato, según su tipo real en el schema. */
function blankValueFor(key: string): unknown {
  switch (baseTypeName(key)) {
    case 'ZodBoolean':
      return false;
    case 'ZodArray':
      return [];
    case 'ZodObject':
      return {};
    case 'ZodNumber':
      return undefined;
    default:
      return '';
  }
}

/**
 * Los campos generales del caso guardado, listos para `form.reset()`.
 *
 * Normaliza los `null`/`undefined` de la base al blanco de su tipo (igual
 * criterio que `pickTypeSpecificFields`), y convierte `Date` y los números
 * Decimal-como-number que trae `caseSchema` (vía `decimalToNumber`) al string
 * que esperan los campos de texto del formulario — excepto cuando el campo
 * es realmente numérico (`gracePeriodMonths` y similares), que se deja tal
 * cual.
 */
export function pickGeneralFields(
  source: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source) return out;

  for (const key of GENERAL_SCALAR_FIELDS) {
    const raw = source[key];

    if (raw === null || raw === undefined) {
      out[key] = blankValueFor(key);
      continue;
    }
    if (raw instanceof Date) {
      out[key] = raw.toISOString().split('T')[0];
      continue;
    }
    if (typeof raw === 'number' && baseTypeName(key) !== 'ZodNumber') {
      out[key] = String(raw);
      continue;
    }
    out[key] = raw;
  }
  return out;
}

/**
 * Los campos generales tal como salen del formulario, para el `submitData`.
 *
 * Igual que `pickTypeSpecificValues`: NO se normaliza, lo que el formulario
 * tenga es lo que se manda. Un campo que el formulario activo no registró
 * llega `undefined` y `updateCase` deja esa columna como estaba.
 */
export function pickGeneralValues(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of GENERAL_SCALAR_FIELDS) {
    out[key] = data[key];
  }
  return out;
}
