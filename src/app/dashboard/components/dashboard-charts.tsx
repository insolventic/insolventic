'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPhaseColor } from '@/lib/case-phases';
import type { DashboardStats } from '@/features/case/schemas';

interface DashboardChartsProps {
  stats: DashboardStats;
}

const TYPE_COLORS: Record<string, string> = {
  Insolvencia: '#ef4444',
  Conciliación: '#3b82f6',
  'Acuerdo de Apoyo': '#10b981',
};

export function DashboardCharts({ stats }: Readonly<DashboardChartsProps>) {
  const hasTypeData = stats.casesByType.length > 0;
  const hasPhaseData = stats.casesByPhase.length > 0;
  const hasTimeData = stats.casesOverTime.some((d) => d.count > 0);

  if (!hasTypeData && !hasPhaseData && !hasTimeData) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pie chart - Casos por Tipo */}
      {hasTypeData && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Casos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer
                width="100%"
                height={200}
                className="max-w-[250px]"
              >
                <PieChart>
                  <Pie
                    data={stats.casesByType}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                  >
                    {stats.casesByType.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={TYPE_COLORS[entry.type] ?? '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend below/beside the chart so labels don't overlap */}
              <div className="flex flex-col gap-2">
                {stats.casesByType.map((entry) => (
                  <div
                    key={entry.type}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: TYPE_COLORS[entry.type] ?? '#6b7280',
                      }}
                    />
                    <span className="text-muted-foreground">{entry.type}:</span>
                    <span className="font-semibold">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar chart - Casos por Fase */}
      {hasPhaseData && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Casos por Fase
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ResponsiveContainer
              width="100%"
              height={Math.max(220, stats.casesByPhase.length * 35)}
            >
              <BarChart
                data={stats.casesByPhase}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="phase"
                  width={130}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="count" name="Casos" radius={[0, 4, 4, 0]}>
                  {stats.casesByPhase.map((entry) => (
                    <Cell key={entry.phase} fill={getPhaseColor(entry.phase)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Area chart - Casos en el tiempo (full width) */}
      {hasTimeData && (
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Casos Nuevos (Últimos 6 Meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={stats.casesOverTime}
                margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Casos"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
