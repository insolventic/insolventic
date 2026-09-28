'use client';

import dynamic from 'next/dynamic';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats } from '@/features/case/schemas';

import { getChartAvailability } from './dashboard-charts-data';

/**
 * Esqueleto mientras baja el chunk de recharts. Reserva el mismo espacio que las
 * tarjetas reales (rejilla de 2 columnas, alturas de 200/220 px) para que
 * "Casos recientes", que va debajo, no salte al cargar los gráficos.
 */
function DashboardChartsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando gráficos"
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      {[200, 220].map((height) => (
        <Card key={height} className="border">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="w-full" style={{ height }} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// `recharts` pesa ~127 kB gzip y era el 95 % del JS exclusivo de /dashboard. Los
// gráficos van debajo de las tarjetas y `ResponsiveContainer` mide el DOM, así
// que renderizarlos en el servidor no aporta nada visible: se cargan solo en el
// cliente y después de la carga inicial. (`ssr: false` no se puede usar desde
// un Server Component, por eso este wrapper es un Client Component.)
const DashboardCharts = dynamic(
  () => import('./dashboard-charts').then((mod) => mod.DashboardCharts),
  { ssr: false, loading: () => <DashboardChartsSkeleton /> },
);

/**
 * Versión diferida de `DashboardCharts` para `page.tsx`. Si no hay datos que
 * graficar no renderiza nada y no descarga recharts (mismo comportamiento que
 * antes, donde `DashboardCharts` devolvía null).
 */
export function DashboardChartsLazy({
  stats,
}: Readonly<{ stats: DashboardStats }>) {
  if (!getChartAvailability(stats).hasAny) return null;

  return <DashboardCharts stats={stats} />;
}
