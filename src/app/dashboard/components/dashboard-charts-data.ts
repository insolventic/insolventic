import type { DashboardStats } from '@/features/case/schemas';

/**
 * Qué gráficos del /dashboard tienen datos que mostrar.
 *
 * Vive aparte de `dashboard-charts.tsx` a propósito: ese archivo importa
 * `recharts` (~127 kB gzip), y el wrapper diferido necesita saber si hay algo
 * que graficar SIN importarlo — si no hay datos, el chunk no se descarga nunca.
 */
export function getChartAvailability(
  stats: Pick<DashboardStats, 'casesByType' | 'casesByPhase' | 'casesOverTime'>,
) {
  const hasTypeData = stats.casesByType.length > 0;
  const hasPhaseData = stats.casesByPhase.length > 0;
  const hasTimeData = stats.casesOverTime.some((d) => d.count > 0);

  return {
    hasTypeData,
    hasPhaseData,
    hasTimeData,
    hasAny: hasTypeData || hasPhaseData || hasTimeData,
  };
}
