import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardStats() {
  const stats = [
    {
      title: 'Casos de Insolvencia Activos',
      value: '24',
      change: '+3 nuevos este mes',
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      title: 'Acreedores Registrados',
      value: '156',
      change: '+12 registros nuevos',
      icon: Users,
      color: 'text-green-600',
    },
    {
      title: 'Documentos Pendientes',
      value: '8',
      change: 'Requieren revisión urgente',
      icon: Clock,
      color: 'text-orange-600',
    },
    {
      title: 'Casos Resueltos',
      value: '42',
      change: '+5 finalizados esta semana',
      icon: CheckCircle,
      color: 'text-emerald-600',
    },
    {
      title: 'Audiencias Programadas Hoy',
      value: '3',
      change: 'Próximas en 2 horas',
      icon: AlertTriangle,
      color: 'text-red-600',
    },
    {
      title: 'Eficiencia en Resolución',
      value: '94%',
      change: 'Casos resueltos a tiempo (+2%)',
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <Card key={index} className="border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="mt-1 text-xs text-gray-500">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
