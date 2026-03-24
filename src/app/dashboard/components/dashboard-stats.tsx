'use client';

import {
  FileText,
  Users,
  Calendar,
  TrendingUp,
  DollarSign,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPhaseBadgeClass } from '@/lib/case-phases';
import type { DashboardStats } from '@/features/case/schemas';

interface DashboardStatsProps {
  stats: DashboardStats;
}

export function DashboardStatsCards({ stats }: Readonly<DashboardStatsProps>) {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const cards = [
    {
      title: 'Total Casos',
      value: stats.totalCases.toString(),
      subtitle: `${stats.casesByType.length} tipos diferentes`,
      icon: FileText,
      color: 'text-primary',
    },
    {
      title: 'Casos este Mes',
      value: stats.casesThisMonth.toString(),
      subtitle: 'Nuevos casos ingresados',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Audiencias Próximas',
      value: stats.upcomingHearings.toString(),
      subtitle: 'En los próximos 7 días',
      icon: Calendar,
      color: 'text-violet-600 dark:text-violet-400',
    },
    {
      title: 'Deuda Total',
      value: formatCurrency(stats.totalDebt),
      subtitle: 'Suma de todos los casos',
      icon: DollarSign,
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      title: 'Acreedores Totales',
      value: (stats.totalCreditors ?? 0).toString(),
      subtitle: 'Registrados en casos',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
    },
    ...(stats.overduePayments > 0
      ? [
          {
            title: 'Pagos Vencidos',
            value: stats.overduePayments.toString(),
            subtitle: 'Cuotas sin pagar',
            icon: AlertTriangle,
            color: 'text-red-600 dark:text-red-400',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <Card key={index} className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 shrink-0 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div
                className="truncate text-xl font-bold sm:text-2xl"
                title={card.value}
              >
                {card.value}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.casesByPhase.length > 0 && (
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Casos por Fase
            </CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.casesByPhase.map((item) => (
                <Badge
                  key={item.phase}
                  className={`${getPhaseBadgeClass(item.phase)} text-xs`}
                >
                  {item.phase}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
