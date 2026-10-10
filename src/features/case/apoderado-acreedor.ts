/**
 * Del formulario de acreedores a las filas de `apoderados_acreedor`.
 *
 * Módulo sin `'use server'` a propósito: lo comparten `createCase` y, cuando
 * llegue, la ruta de edición. Misma razón que `persistence.ts`.
 *
 * CONTEXTO. La decisión legal del 2026-10-09 (ítem 13 de
 * `docs/PENDIENTES_DECISION_LEGAL.md`) es que el sistema no elija entre el
 * registro de poderes y el acta de la audiencia cuando se contradicen. Para eso
 * las dos fuentes se guardan por separado, una fila por fuente. El plan completo
 * está en `docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md`.
 *
 * Este módulo solo traduce. **No compara ni valida nada**: la detección de la
 * discrepancia y el bloqueo de la generación son el PR 3.
 */

/** Las fuentes posibles. `MANUAL` la escribe el conciliador al resolver. */
export const FUENTES_APODERADO = ['REGISTRO', 'ACTA', 'MANUAL'] as const;
export type FuenteApoderado = (typeof FUENTES_APODERADO)[number];

/** Lo que el formulario trae por fila de acreedor, para una fuente. */
interface ApoderadoDelFormulario {
  nombre?: string;
  tipoId?: string;
  id?: string;
  tp?: string;
  correo?: string;
  telefono?: string;
}

/** Una fila lista para el `create` anidado de Prisma. */
export interface FilaApoderadoAcreedor {
  tenantId: string;
  fuente: FuenteApoderado;
  nombreCompleto: string;
  tipoIdentificacion: string | null;
  identificacion: string | null;
  tarjetaProfesional: string | null;
  correo: string | null;
  telefono: string | null;
}

/** `''` y `'   '` son "no cargado", igual que `undefined`. */
function limpiar(valor?: string): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

/**
 * Una fila, o `null` si esa fuente no tiene nada cargado.
 *
 * **El nombre es lo que define que la fuente existe.** Sin nombre no hay
 * apoderado que registrar, aunque vengan los demás campos: una fila con solo un
 * teléfono no es un apoderado, y entraría a la comparación del PR 3 como un
 * dato que nadie puso.
 */
function filaDeFuente(
  fuente: FuenteApoderado,
  datos: ApoderadoDelFormulario,
  tenantId: string,
): FilaApoderadoAcreedor | null {
  const nombreCompleto = limpiar(datos.nombre);
  if (!nombreCompleto) return null;

  return {
    tenantId,
    fuente,
    nombreCompleto,
    tipoIdentificacion: limpiar(datos.tipoId),
    // Se guarda TAL COMO lo escribió el operador. La normalización para
    // comparar es del PR 3: acá normalizar perdería el dato original, que es el
    // que el conciliador ve y reconoce.
    identificacion: limpiar(datos.id),
    tarjetaProfesional: limpiar(datos.tp),
    correo: limpiar(datos.correo),
    telefono: limpiar(datos.telefono),
  };
}

/** Lo que el formulario manda por acreedor, en la forma de `debtSchema`. */
export interface DebtConApoderados {
  apoderadoRegistroNombre?: string;
  apoderadoRegistroTipoId?: string;
  apoderadoRegistroId?: string;
  apoderadoRegistroTP?: string;
  apoderadoRegistroCorreo?: string;
  apoderadoRegistroTelefono?: string;

  apoderadoActaNombre?: string;
  apoderadoActaTipoId?: string;
  apoderadoActaId?: string;
  apoderadoActaTP?: string;
  apoderadoActaCorreo?: string;
  apoderadoActaTelefono?: string;
}

/**
 * Las filas a crear para un acreedor. Vacío si no cargaron ninguna fuente, que
 * es el caso normal: la mayoría de los acreedores no tiene apoderado, y la
 * ausencia no bloquea nada.
 */
export function filasApoderadoDesdeFormulario(
  debt: DebtConApoderados,
  tenantId: string,
): FilaApoderadoAcreedor[] {
  const filas: FilaApoderadoAcreedor[] = [];

  const registro = filaDeFuente(
    'REGISTRO',
    {
      nombre: debt.apoderadoRegistroNombre,
      tipoId: debt.apoderadoRegistroTipoId,
      id: debt.apoderadoRegistroId,
      tp: debt.apoderadoRegistroTP,
      correo: debt.apoderadoRegistroCorreo,
      telefono: debt.apoderadoRegistroTelefono,
    },
    tenantId,
  );
  if (registro) filas.push(registro);

  const acta = filaDeFuente(
    'ACTA',
    {
      nombre: debt.apoderadoActaNombre,
      tipoId: debt.apoderadoActaTipoId,
      id: debt.apoderadoActaId,
      tp: debt.apoderadoActaTP,
      correo: debt.apoderadoActaCorreo,
      telefono: debt.apoderadoActaTelefono,
    },
    tenantId,
  );
  if (acta) filas.push(acta);

  return filas;
}
