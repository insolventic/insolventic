/**
 * Case phase constants, colors, transitions, and helpers.
 *
 * IMPORTANT: This file must NOT import Prisma or any Node-only module
 * because it is used in client components and potentially Edge Runtime.
 */

// ---------------------------------------------------------------------------
// Phase Definitions
// ---------------------------------------------------------------------------

export interface PhaseDefinition {
  value: string;
  label: string;
  color: string;
  badgeClass: string;
  order: number;
}

export const CASE_PHASES: readonly PhaseDefinition[] = [
  {
    value: 'Inicial',
    label: 'Inicial',
    color: '#6b7280',
    badgeClass:
      'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300',
    order: 0,
  },
  {
    value: 'Admisión',
    label: 'Admisión',
    color: '#3b82f6',
    badgeClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    order: 1,
  },
  {
    value: 'En negociación',
    label: 'En negociación',
    color: '#f59e0b',
    badgeClass:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    order: 2,
  },
  {
    value: 'Audiencia programada',
    label: 'Audiencia programada',
    color: '#8b5cf6',
    badgeClass:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    order: 3,
  },
  {
    value: 'Acuerdo aprobado',
    label: 'Acuerdo aprobado',
    color: '#10b981',
    badgeClass:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    order: 4,
  },
  {
    value: 'Acuerdo impugnado',
    label: 'Acuerdo impugnado',
    color: '#f97316',
    badgeClass:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    order: 5,
  },
  {
    value: 'Acuerdo reformado',
    label: 'Acuerdo reformado',
    color: '#6366f1',
    badgeClass:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    order: 6,
  },
  {
    value: 'Post-acuerdo',
    label: 'Post-acuerdo',
    color: '#06b6d4',
    badgeClass:
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    order: 7,
  },
  {
    value: 'Rechazo',
    label: 'Rechazo',
    color: '#f43f5e',
    badgeClass:
      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    order: 8,
  },
  {
    value: 'Retiro',
    label: 'Retiro',
    color: '#eab308',
    badgeClass:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    order: 9,
  },
  {
    value: 'Desistimiento',
    label: 'Desistimiento',
    color: '#ec4899',
    badgeClass:
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    order: 10,
  },
  {
    value: 'Fracaso',
    label: 'Fracaso',
    color: '#ef4444',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    order: 11,
  },
  {
    value: 'Terminado',
    label: 'Terminado',
    color: '#64748b',
    badgeClass:
      'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
    order: 12,
  },
] as const;

// ---------------------------------------------------------------------------
// Phase Transitions (valid next phases from each phase)
// ---------------------------------------------------------------------------

// Diseño: docs/DISENO_FASES_NUEVAS_2026-09-11.md §2. Se elimina
// `Inicial → Fracaso` y `Admisión → Fracaso`: un trámite que nunca se
// admitió no puede fracasar (el fracaso solo existe tras notificar e
// intentar negociar). Esos desenlaces tempranos ahora son Rechazo/Retiro
// (antes de Admisión) o Desistimiento (desde Admisión en adelante).
export const PHASE_TRANSITIONS: Record<string, string[]> = {
  Inicial: ['Admisión', 'Rechazo', 'Retiro'],
  Admisión: ['En negociación', 'Desistimiento'],
  'En negociación': [
    'Audiencia programada',
    'Acuerdo aprobado',
    'Desistimiento',
    'Fracaso',
  ],
  'Audiencia programada': [
    'Acuerdo aprobado',
    'En negociación',
    'Desistimiento',
    'Fracaso',
  ],
  'Acuerdo aprobado': ['Post-acuerdo', 'Acuerdo impugnado', 'Fracaso'],
  // ⓐ impugnación desestimada / nulidad saneada → Post-acuerdo.
  // ⓑ nulidad declarada, no saneable → Acuerdo reformado.
  'Acuerdo impugnado': ['Post-acuerdo', 'Acuerdo reformado'],
  // ⓒ corrección lograda en plazo → Post-acuerdo.
  // ⓓ corrección no lograda en plazo → Terminado.
  'Acuerdo reformado': ['Post-acuerdo', 'Terminado'],
  'Post-acuerdo': ['Terminado', 'Fracaso'],
  Fracaso: ['Terminado'],
  Rechazo: ['Terminado'],
  Retiro: ['Terminado'],
  Desistimiento: ['Terminado'],
  Terminado: [],
};

// ---------------------------------------------------------------------------
// Document Package → Phase Mapping
// ---------------------------------------------------------------------------

// Rechazo, Retiro, Acuerdo impugnado y Acuerdo reformado quedan sin
// paquete a propósito: sus plantillas todavía no existen (bloqueado por
// el abogado, ver docs/DISENO_FASES_NUEVAS_2026-09-11.md §3). Hasta que
// existan y se les asigne un packageNumber real, getPackageForPhase cae
// a 1 para esas cuatro fases — el mismo comportamiento, ya conocido, que
// tenía Fracaso antes de esta corrección.
export const PACKAGE_PHASE_MAP: Record<number, string[]> = {
  1: ['Inicial', 'Admisión'],
  2: ['Admisión', 'En negociación'],
  3: ['En negociación', 'Audiencia programada'],
  4: ['Acuerdo aprobado', 'Post-acuerdo', 'Desistimiento'],
  5: ['Post-acuerdo', 'Terminado', 'Fracaso'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getPhaseDefinition(
  phase: string | null | undefined,
): PhaseDefinition {
  return CASE_PHASES.find((p) => p.value === phase) ?? CASE_PHASES[0];
}

export function getPhaseColor(phase: string | null | undefined): string {
  return getPhaseDefinition(phase).color;
}

export function getPhaseLabel(phase: string | null | undefined): string {
  return getPhaseDefinition(phase).label;
}

export function getPhaseBadgeClass(phase: string | null | undefined): string {
  return getPhaseDefinition(phase).badgeClass;
}

export function getPhaseOrder(phase: string | null | undefined): number {
  return getPhaseDefinition(phase).order;
}

export function getValidTransitions(
  currentPhase: string | null | undefined,
): string[] {
  return PHASE_TRANSITIONS[currentPhase ?? 'Inicial'] ?? [];
}

export function getPackageForPhase(phase: string | null | undefined): number {
  const phaseValue = phase ?? 'Inicial';
  for (const [pkg, phases] of Object.entries(PACKAGE_PHASE_MAP)) {
    if (phases.includes(phaseValue)) return Number(pkg);
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Transition guard (C-1) — fuente única de verdad para el backend
// ---------------------------------------------------------------------------
//
// Antes, `updateCasePhase` validaba la transición inline y `updateCase`
// escribía `phase` directo desde el spread del payload, así que bastaba con
// llamar a `updateCase` para saltarse la máquina de estados por completo.
// Estas dos funciones son puras (sin Prisma, sin I/O) para que las consuman
// por igual las server actions, los componentes cliente y los tests.

/** Fases conocidas del expediente, en orden de avance. */
export const CASE_PHASE_VALUES = CASE_PHASES.map((p) => p.value);

/** Fase con la que nace todo expediente. */
export const INITIAL_CASE_PHASE = 'Inicial';

export function isKnownPhase(phase: string | null | undefined): boolean {
  return typeof phase === 'string' && CASE_PHASE_VALUES.includes(phase);
}

export type PhaseTransitionCheck =
  | { valid: true; isNoop: boolean }
  | { valid: false; reason: string };

/**
 * Decide si `nextPhase` es alcanzable desde `currentPhase`.
 *
 * Reglas:
 *  - `currentPhase` nulo/desconocido se trata como 'Inicial' (casos legacy).
 *  - Reescribir la misma fase es un no-op válido: `updateCase` reenvía siempre
 *    la fase actual en el payload del formulario de edición, y eso no es un
 *    intento de transición.
 *  - Una fase destino fuera de CASE_PHASES se rechaza siempre (antes se podía
 *    escribir cualquier string y romper filtros, dashboard y PACKAGE_PHASE_MAP).
 *  - En cualquier otro caso debe estar en PHASE_TRANSITIONS[currentPhase].
 */
export function validatePhaseTransition(
  currentPhase: string | null | undefined,
  nextPhase: string | null | undefined,
): PhaseTransitionCheck {
  if (nextPhase == null || nextPhase === '') {
    return { valid: false, reason: 'La fase destino es requerida' };
  }

  // Igualdad cruda ANTES de normalizar: un expediente legacy puede tener en BD
  // una fase que hoy ya no es válida (la columna aceptaba cualquier string
  // antes de C-1). Reescribir esa misma fase es un no-op y no debe bloquear la
  // edición del caso; solo se le exige validez a un cambio real de fase.
  if (currentPhase === nextPhase) {
    return { valid: true, isNoop: true };
  }

  const from = isKnownPhase(currentPhase)
    ? (currentPhase as string)
    : INITIAL_CASE_PHASE;

  if (!isKnownPhase(nextPhase)) {
    return { valid: false, reason: `Fase desconocida: "${nextPhase}"` };
  }

  if (from === nextPhase) {
    return { valid: true, isNoop: true };
  }

  const allowed = getValidTransitions(from);
  if (!allowed.includes(nextPhase)) {
    return {
      valid: false,
      reason:
        allowed.length > 0
          ? `Transición no permitida: ${from} → ${nextPhase}. Desde "${from}" solo se puede pasar a: ${allowed.join(', ')}.`
          : `Transición no permitida: "${from}" es una fase terminal, el expediente no admite más cambios de fase.`,
    };
  }

  return { valid: true, isNoop: false };
}
