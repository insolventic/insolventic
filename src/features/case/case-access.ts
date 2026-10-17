/**
 * Visibilidad de expedientes por rol — fuente única de verdad.
 *
 * POR QUÉ EXISTE. La regla de "qué expedientes puede ver este usuario" estaba
 * escrita a mano cuatro veces (`getAllCases`, `getCaseById`, `getCaseStats`,
 * `getDashboardStats`) y, en una quinta copia, dentro de
 * `batchGenerateDocuments`. Las cinco coincidían; el problema no era la
 * divergencia sino la ausencia: **ninguna mutación la aplicaba**. Un rol
 * limitado a sus propios expedientes podía editar, borrar o cambiar de fase
 * cualquier expediente del centro pasando el `id` directo a la server action,
 * porque el único filtro era `tenantId` (hallazgos G-A1, GC-A1, GD-M4 y GC-M5
 * de `docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md`).
 *
 * LAS DOS FORMAS DE LA MISMA REGLA. No son intercambiables y por eso hay dos
 * entradas:
 *
 *   - `resolveCaseVisibility` + `caseWhereFromVisibility` — para **listados,
 *     agregados y reportes**: devuelve el fragmento de `where` que hay que
 *     sumar a la consulta. `null` significa "no debe ver nada", que NO es lo
 *     mismo que un `where` vacío: un `where` vacío devuelve todo.
 *   - `assertCaseAccess` — para **una fila concreta**: el patrón de
 *     `getCaseById`, extraído. Lanza `CaseAccessError` si el expediente no
 *     existe en el tenant o si el rol no alcanza.
 *
 * SIN `'use server'` A PROPÓSITO. Lo consumen varias server actions de
 * features distintos (`case`, `document`, `report`, `search`); un módulo
 * compartido entre actions va en un archivo sin la directiva, como
 * `persistence.ts` o `generation-request.ts` (convención de `CLAUDE.md`).
 */

import prisma from '@/lib/prisma';
import { P } from '@/lib/permissions';

/**
 * Lo mínimo que estas funciones necesitan de la sesión. Deliberadamente más
 * estrecho que el usuario completo de `authenticateUser()`: así los tests
 * construyen un usuario de tres campos en vez de la fila entera de `User`.
 */
export interface CaseAccessUser {
  id: string;
  email: string;
  permissions: string[];
}

/** Fila mínima de `Case` que hace falta para decidir el acceso. */
export interface CaseAccessRow {
  operatorId: string | null;
  debtorId: string | null;
}

export type CaseVisibility =
  /** `Ver todos los casos` — Administrador, Operadora, Secretaria. */
  | { scope: 'all' }
  /** `Ver casos propios` — Abogado, Asistente Legal: donde es el operador. */
  | { scope: 'own'; operatorId: string }
  /** `Ver casos como cliente` — Usuario: donde es el deudor. */
  | { scope: 'client'; debtorId: string }
  /**
   * Sin permiso de alcance, o con `Ver casos como cliente` pero sin una fila
   * de `Debtor` que corresponda al correo de la sesión. Los dos casos colapsan
   * acá a propósito: en ambos el usuario no debe ver ningún expediente.
   */
  | { scope: 'none' };

/**
 * Traduce los permisos de la sesión al alcance de visibilidad.
 *
 * El orden de los `if` es el mismo de `getAllCases` y es significativo: un
 * usuario con `Ver todos los casos` **y** `Ver casos propios` ve todos. No se
 * invierte sin cambiar el comportamiento de los roles ya sembrados.
 */
export async function resolveCaseVisibility(
  user: CaseAccessUser,
  tenantId: string,
): Promise<CaseVisibility> {
  if (user.permissions.includes(P.VER_TODOS_CASOS)) {
    return { scope: 'all' };
  }

  if (user.permissions.includes(P.VER_CASOS_PROPIOS)) {
    return { scope: 'own', operatorId: user.id };
  }

  if (user.permissions.includes(P.VER_CASOS_CLIENTE)) {
    const debtor = await prisma.debtor.findFirst({
      where: { email: user.email, tenantId },
      select: { id: true },
    });
    // Sin fila de deudor no hay nada que mostrar. Antes, cada call-site
    // resolvía esto por su cuenta y devolvía una lista vacía; acá se unifica
    // en `none` para que ningún consumidor pueda olvidarse del caso.
    return debtor ? { scope: 'client', debtorId: debtor.id } : { scope: 'none' };
  }

  return { scope: 'none' };
}

/**
 * El fragmento de `where` que corresponde a un alcance.
 *
 * ⚠️ `null` significa **"no devolver ninguna fila"**. Tratarlo como `{}` es
 * exactamente el bug que esta función existe para evitar: `{}` no filtra nada.
 * Los consumidores tienen que cortar antes de consultar.
 */
export function caseWhereFromVisibility(
  visibility: CaseVisibility,
): { operatorId?: string; debtorId?: string } | null {
  switch (visibility.scope) {
    case 'all':
      return {};
    case 'own':
      return { operatorId: visibility.operatorId };
    case 'client':
      return { debtorId: visibility.debtorId };
    case 'none':
      return null;
  }
}

/**
 * `where` de Prisma sobre `Case` que no coincide con ninguna fila.
 *
 * Para los agregados y reportes, que no pueden "cortar antes" como un listado:
 * su forma de salida se calcula a partir de las consultas, así que lo correcto
 * es consultar un conjunto vacío y dejar que el código de abajo produzca un
 * reporte en ceros. No es un parche: es el mismo estado que ya atraviesa un
 * centro recién creado sin expedientes, y los consumidores ya lo manejan
 * (`_sum.totalDebt ? Number(...) : 0`).
 */
export const CASE_WHERE_MATCHES_NOTHING: { id: { in: string[] } } = {
  id: { in: [] },
};

/**
 * El `where` listo para usar, con el "no ver nada" ya resuelto.
 *
 * Azúcar sobre `caseWhereFromVisibility` para los call-sites que no pueden
 * cortar antes de consultar. Un listado debe usar la versión que devuelve
 * `null` y cortar; un agregado usa esta.
 */
export function caseWhereOrNothing(
  visibility: CaseVisibility,
): { operatorId?: string; debtorId?: string } | { id: { in: string[] } } {
  return caseWhereFromVisibility(visibility) ?? CASE_WHERE_MATCHES_NOTHING;
}

/**
 * Error de control de acceso a un expediente.
 *
 * Clase propia para que los call-sites puedan distinguirlo de un fallo técnico
 * y no mandarlo a Sentry como error: un acceso denegado es un evento
 * **esperado** (`CLAUDE.md`, sección del logger).
 */
export class CaseAccessError extends Error {
  readonly reason: 'not-found' | 'forbidden';

  constructor(reason: 'not-found' | 'forbidden') {
    super(
      reason === 'not-found'
        ? 'Caso no encontrado'
        : 'No tienes permisos para acceder a este caso',
    );
    this.name = 'CaseAccessError';
    this.reason = reason;
  }
}

/** true si el error vino de este módulo. Sobrevive al cruce de bundles. */
export function isCaseAccessError(error: unknown): error is CaseAccessError {
  return error instanceof Error && error.name === 'CaseAccessError';
}

/**
 * Decide el acceso a una fila **ya cargada y ya acotada por `tenantId`**.
 *
 * Variante para los call-sites que tienen el expediente en la mano
 * (`batchGenerateDocuments` lo carga con `fetchCaseForGeneration`): evita una
 * segunda consulta. El contrato de que la fila venga del tenant correcto es
 * del llamador — acá no se puede verificar.
 */
export async function assertCaseAccessOnRow(params: {
  caseRow: CaseAccessRow;
  user: CaseAccessUser;
  tenantId: string;
}): Promise<void> {
  const { caseRow, user, tenantId } = params;
  const visibility = await resolveCaseVisibility(user, tenantId);

  switch (visibility.scope) {
    case 'all':
      return;
    case 'own':
      if (caseRow.operatorId === visibility.operatorId) return;
      throw new CaseAccessError('forbidden');
    case 'client':
      if (caseRow.debtorId === visibility.debtorId) return;
      throw new CaseAccessError('forbidden');
    case 'none':
      throw new CaseAccessError('forbidden');
  }
}

/**
 * Guard de acceso a UN expediente. El patrón de `getCaseById`, extraído.
 *
 * Carga la fila acotada por `tenantId` y aplica la visibilidad por rol. Lanza
 * `CaseAccessError` en los dos modos de falla y devuelve la fila mínima cuando
 * pasa, para que el llamador no la vuelva a consultar.
 *
 * SOBRE LOS DOS MENSAJES. Se conserva la distinción que ya hacía `getCaseById`
 * entre "no encontrado" y "sin permisos": decirle a un atacante si un id
 * existe dentro de su propio tenant es una fuga mínima, y unificarlos cambiaría
 * el mensaje que hoy ve el usuario legítimo al abrir un caso borrado. Si se
 * decide unificar, es un cambio de una línea en `CaseAccessError`.
 */
export async function assertCaseAccess(params: {
  caseId: string;
  user: CaseAccessUser;
  tenantId: string;
}): Promise<{ id: string; operatorId: string; debtorId: string }> {
  const { caseId, user, tenantId } = params;

  const caseRow = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: { id: true, operatorId: true, debtorId: true },
  });

  if (!caseRow) {
    throw new CaseAccessError('not-found');
  }

  await assertCaseAccessOnRow({ caseRow, user, tenantId });

  return caseRow;
}

/**
 * GC-M2 — el operador asignado tiene que ser un usuario de ESTE centro.
 *
 * `operatorId` y `debtorId` llegaban del cliente validados solo como
 * `z.string()`. El deudor sí se comprobaba contra la base
 * (`prisma.debtor.findUnique({ where: { id, tenantId } })`); el operador **no**:
 * se escribía con un `operator: { connect: { id: operatorId } }` a secas, y
 * como el `connect` de Prisma solo exige que el id exista, bastaba mandar el id
 * de un usuario del OTRO centro para dejarle un expediente asignado.
 *
 * Qué califica como operador asignable está definido por
 * `getAssignableOperators`: cualquier usuario del tenant. Esta función es su
 * contraparte en el servidor — el `<select>` ofrece solo los del centro, y esto
 * es lo que lo hace exigible cuando la action se invoca sin pasar por él.
 *
 * Lanza un `Error` normal (no `CaseAccessError`): no es un problema de
 * visibilidad del usuario que llama, es un payload inválido, y el `catch` de
 * cada action lo convierte en `{ success: false, error }`.
 */
export async function assertOperatorInTenant(
  operatorId: string,
  tenantId: string,
): Promise<void> {
  const operador = await prisma.user.findFirst({
    where: { id: operatorId, tenantId },
    select: { id: true },
  });

  if (!operador) {
    throw new Error(
      'El operador asignado no pertenece a este centro de conciliación.',
    );
  }
}

/**
 * Las sub-entidades de un expediente que se borran por su propio id.
 *
 * Las seis `remove*FromCase` reciben el id de la fila hija, no el del
 * expediente, así que antes de decidir el acceso hay que subir al padre. Sin
 * esto el único filtro era `tenantId`: cualquier rol con `EDITAR_CASOS` podía
 * borrar la deuda, el bien o el apoderado de un expediente que no le toca.
 */
export type CaseSubEntity =
  | 'debt'
  | 'libranza'
  | 'suspendedService'
  | 'asset'
  | 'dependent'
  | 'apoderado';

/**
 * `caseId` del expediente al que pertenece una sub-entidad, o `null` si no
 * existe en este tenant.
 *
 * El `switch` es explícito y no un mapa indexado por string a propósito: los
 * delegates de Prisma no comparten un tipo común que acepte `findUnique` con
 * este `select`, y resolverlo con un índice obligaría a un `as any` que es
 * justo lo que deja pasar los errores de campo (el patrón de los 18
 * `as unknown as` del módulo de documentos). Verbosidad a cambio de que `tsc`
 * valide cada rama.
 *
 * Devuelve `null` en vez de lanzar para que cada action dé su propio mensaje
 * ("Deuda no encontrada", "Bien no encontrado"): un `CaseAccessError` diría
 * "Caso no encontrado", que sería inexacto.
 */
export async function findParentCaseId(
  model: CaseSubEntity,
  id: string,
  tenantId: string,
): Promise<string | null> {
  const where = { id, tenantId };
  const select = { caseId: true } as const;

  switch (model) {
    case 'debt':
      return (await prisma.debt.findUnique({ where, select }))?.caseId ?? null;
    case 'libranza':
      return (
        (await prisma.libranza.findUnique({ where, select }))?.caseId ?? null
      );
    case 'suspendedService':
      return (
        (await prisma.suspendedService.findUnique({ where, select }))?.caseId ??
        null
      );
    case 'asset':
      return (await prisma.asset.findUnique({ where, select }))?.caseId ?? null;
    case 'dependent':
      return (
        (await prisma.dependent.findUnique({ where, select }))?.caseId ?? null
      );
    case 'apoderado':
      return (
        (await prisma.apoderado.findUnique({ where, select }))?.caseId ?? null
      );
  }
}
