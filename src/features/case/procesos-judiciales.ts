/**
 * Procesos judiciales de un caso: datos para crearlos y plan de cambios de la
 * edición (crear, actualizar, eliminar).
 *
 * Reglas de la edición (aprobadas el 2026-11-26):
 *  - Se crean las filas sin `id` y se actualizan las que traen uno.
 *  - Solo se elimina lo que la persona quitó explícitamente en la interfaz
 *    (`legalProcessesEliminados`); una fila que simplemente no llega no se
 *    toca.
 *  - Todo `id` debe pertenecer al caso (y por lo tanto al centro): si no, se
 *    rechaza la edición entera.
 *  - Si el caso ya tiene documentos generados que citan procesos (Solicitud de
 *    Insolvencia u oficio de Suspensión a juzgados), cada eliminación exige
 *    confirmación explícita (`legalProcessesEliminacionConfirmada`): esos
 *    documentos son archivos fijos que seguirán citando el proceso hasta que
 *    se regeneren. Sin esos documentos no se exige.
 *
 * Ningún otro modelo apunta a `LegalProcess`, así que eliminar no deja
 * referencias huérfanas en la base.
 *
 * Este archivo no lleva `'use server'`: lo importan componentes cliente.
 */
import {
  requiresOtherDetail,
  tipoProcesoLabel,
} from './proceso-judicial-tipos';

/**
 * Nombres con que se guardan (`Document.name`) los documentos generados que
 * citan procesos judiciales. Deben coincidir con `templates-config.ts`
 * (`solicitud-insolvencia` y `suspension-juzgados`); lo fija un test. Los
 * oficios por juzgado se guardan como "<nombre> — <juzgado>".
 */
export const NOMBRES_DOCUMENTOS_QUE_CITAN_PROCESOS = [
  'Solicitud de Insolvencia',
  'Suspension Juzgados',
] as const;

export function documentoCitaProcesos(doc: {
  name: string;
  isGenerated?: boolean | null;
}): boolean {
  if (!doc.isGenerated) return false;
  return NOMBRES_DOCUMENTOS_QUE_CITAN_PROCESOS.some(
    (n) => doc.name === n || doc.name.startsWith(`${n} — `),
  );
}

/** Lo que llega del formulario por cada proceso. */
export interface ProcesoEntrada {
  id?: string;
  processType: string;
  processTypeOther?: string;
  plaintiff: string;
  court: string;
  originCourt?: string | null;
  courtEmail?: string;
  fileNumber: string;
  precautionaryMeasure?: string;
}

/** Columnas de `LegalProcess` a partir de la entrada (sin ids ni tenant). */
export function columnasDeProceso(p: ProcesoEntrada) {
  return {
    // La descripción es el resumen que se muestra en listados: en "Otros" el
    // valor crudo no dice nada, así que se usa el texto que escribió el usuario.
    description: `${tipoProcesoLabel(p.processType, p.processTypeOther)} - ${p.plaintiff}`,
    processType: p.processType,
    processTypeOther: requiresOtherDetail(p.processType)
      ? (p.processTypeOther ?? null)
      : null,
    plaintiff: p.plaintiff,
    court: p.court,
    originCourt: p.originCourt?.trim() || null,
    courtEmail: p.courtEmail || null,
    fileNumber: p.fileNumber,
    precautionaryMeasure: p.precautionaryMeasure ?? null,
  };
}

export interface ProcesoExistente {
  id: string;
  court: string | null;
  processType: string | null;
}

export const ERROR_PROCESO_AJENO =
  'Uno de los procesos judiciales no pertenece a este caso. Recargue el caso e intente de nuevo.';
export const ERROR_PROCESO_CONTRADICTORIO =
  'Un proceso judicial no puede editarse y eliminarse a la vez.';
export const ERROR_FALTA_CONFIRMACION =
  'El caso ya tiene documentos generados que citan los procesos judiciales (Solicitud u oficio de Suspensión). Para quitar un proceso hay que confirmarlo: esos documentos no cambian y habrá que regenerarlos y reenviarlos si ya se entregaron.';

export type PlanDeProcesos =
  | {
      ok: true;
      crear: ProcesoEntrada[];
      actualizar: Array<ProcesoEntrada & { id: string }>;
      eliminar: ProcesoExistente[];
      /** Cuántos procesos quedan en el caso tras aplicar el plan. */
      totalFinal: number;
    }
  | { ok: false; error: string };

export function planificarCambiosDeProcesos(params: {
  existentes: readonly ProcesoExistente[];
  entrada: readonly ProcesoEntrada[] | undefined;
  eliminados: readonly string[];
  confirmados: readonly string[];
  hayDocumentosQueCitan: boolean;
}): PlanDeProcesos {
  const { existentes, eliminados, confirmados, hayDocumentosQueCitan } = params;
  const entrada = params.entrada ?? [];
  const porId = new Map(existentes.map((e) => [e.id, e]));

  const actualizar: Array<ProcesoEntrada & { id: string }> = [];
  const crear: ProcesoEntrada[] = [];
  for (const p of entrada) {
    if (p.id) {
      if (!porId.has(p.id)) return { ok: false, error: ERROR_PROCESO_AJENO };
      actualizar.push({ ...p, id: p.id });
    } else {
      crear.push(p);
    }
  }

  const unicos = [...new Set(eliminados)];
  const eliminar: ProcesoExistente[] = [];
  for (const id of unicos) {
    const existente = porId.get(id);
    if (!existente) return { ok: false, error: ERROR_PROCESO_AJENO };
    if (actualizar.some((a) => a.id === id)) {
      return { ok: false, error: ERROR_PROCESO_CONTRADICTORIO };
    }
    eliminar.push(existente);
  }

  if (
    hayDocumentosQueCitan &&
    eliminar.some((e) => !confirmados.includes(e.id))
  ) {
    return { ok: false, error: ERROR_FALTA_CONFIRMACION };
  }

  return {
    ok: true,
    crear,
    actualizar,
    eliminar,
    totalFinal: existentes.length - eliminar.length + crear.length,
  };
}
