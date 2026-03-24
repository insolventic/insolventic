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
    value: 'Post-acuerdo',
    label: 'Post-acuerdo',
    color: '#06b6d4',
    badgeClass:
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    order: 5,
  },
  {
    value: 'Fracaso',
    label: 'Fracaso',
    color: '#ef4444',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    order: 6,
  },
  {
    value: 'Terminado',
    label: 'Terminado',
    color: '#64748b',
    badgeClass:
      'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
    order: 7,
  },
] as const;

// ---------------------------------------------------------------------------
// Phase Transitions (valid next phases from each phase)
// ---------------------------------------------------------------------------

export const PHASE_TRANSITIONS: Record<string, string[]> = {
  Inicial: ['Admisión', 'Fracaso'],
  Admisión: ['En negociación', 'Fracaso'],
  'En negociación': ['Audiencia programada', 'Acuerdo aprobado', 'Fracaso'],
  'Audiencia programada': ['Acuerdo aprobado', 'En negociación', 'Fracaso'],
  'Acuerdo aprobado': ['Post-acuerdo', 'Fracaso'],
  'Post-acuerdo': ['Terminado', 'Fracaso'],
  Fracaso: ['Terminado'],
  Terminado: [],
};

// ---------------------------------------------------------------------------
// Document Package → Phase Mapping
// ---------------------------------------------------------------------------

export const PACKAGE_PHASE_MAP: Record<number, string[]> = {
  1: ['Inicial', 'Admisión'],
  2: ['Admisión', 'En negociación'],
  3: ['En negociación', 'Audiencia programada'],
  4: ['Acuerdo aprobado', 'Post-acuerdo'],
  5: ['Post-acuerdo', 'Terminado'],
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
