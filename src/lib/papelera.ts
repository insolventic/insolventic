/**
 * Papelera de expedientes (soft-delete).
 *
 * `deleteCase` ya no borra: marca `deletedAt` y el caso desaparece de toda la
 * app. Para que "toda la app" sea cierto sin tocar las ~60 consultas sobre
 * `Case` repartidas en 13 módulos, el filtro se aplica en UN punto: la
 * extensión del cliente de `src/lib/prisma.ts` pasa cada operación sobre
 * `Case` por `conFiltroDePapelera`. Mismo criterio que el escapado de
 * placeholders en el punto de fusión: escribirlo consulta por consulta
 * garantizaba omisiones futuras.
 *
 * LA REGLA: si el `where` de la operación no nombra `deletedAt`, se le agrega
 * `deletedAt: null`. Para ver otra cosa hay que pedirlo explícitamente:
 *
 *   - `...soloPapelera`        → solo los eliminados (la papelera, el purgado).
 *   - `...incluyendoPapelera`  → todos (la numeración de casos: un número de
 *                                un caso en la papelera sigue ocupado).
 *
 * Solo mira la clave de primer nivel del `where`: un `deletedAt` dentro de un
 * `OR`/`AND` no cuenta como "lo pidió", y el filtro se agrega igual.
 *
 * LO QUE NO CUBRE: las lecturas anidadas desde otro modelo (`debtor` con
 * `include: { cases }`, `payment` con `case`). Prisma aplica las extensiones
 * de query solo a la operación de primer nivel. Esas consultas filtran a mano
 * con `CASO_ACTIVO`; el test de `tests/unit/cases/papelera.test.ts` las fija.
 *
 * Sin 'use server': lo importan `src/lib/prisma.ts` y varias actions.
 */

/** Operaciones sobre `Case` que llevan `where` y por lo tanto se filtran. */
export const OPERACIONES_CON_FILTRO = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);
// Fuera a propósito: `create`/`createMany` (no tienen `where`) y `upsert`
// (con `deletedAt: null` en su `where`, un caso en la papelera haría que el
// upsert intentara CREAR otro con el mismo número y chocara con el único
// `[caseNumber, tenantId]`). Hoy solo el seed usa `upsert`.

/** Filtro de "caso activo" para lecturas anidadas que la extensión no ve. */
export const CASO_ACTIVO = { deletedAt: null } as const;

/**
 * Spread en un `where` sobre Notification: oculta los avisos de un caso en la
 * papelera y deja los que no tienen caso (avisos generales, o el propio aviso
 * de "caso eliminado", que se crea sin `caseId`).
 */
export const AVISO_SIN_CASO_EN_PAPELERA = {
  OR: [{ caseId: null }, { case: { is: CASO_ACTIVO } }],
};

/** Spread en un `where` sobre Case: solo casos en la papelera. */
export const soloPapelera = { deletedAt: { not: null } } as const;

/**
 * Spread en un `where` sobre Case: activos y en la papelera. `undefined` hace
 * que Prisma no filtre por la columna, y la presencia de la clave hace que la
 * extensión no agregue el suyo.
 */
export const incluyendoPapelera = { deletedAt: undefined } as const;

/**
 * Devuelve los `args` con el filtro de papelera aplicado, sin mutar los
 * originales. Pura, para poder probarla sin Prisma.
 */
export function conFiltroDePapelera<T>(operation: string, args: T): T {
  if (!OPERACIONES_CON_FILTRO.has(operation)) return args;

  const actuales = (args ?? {}) as { where?: Record<string, unknown> };
  const where = actuales.where ?? {};
  if (Object.prototype.hasOwnProperty.call(where, 'deletedAt')) return args;

  return {
    ...actuales,
    where: { ...where, deletedAt: null },
  } as T;
}
