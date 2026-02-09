import { Loader2, BarChart3 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-blue-600" />
        </div>
        <p className="text-muted-foreground text-sm">Cargando dashboard...</p>
        <div className="text-xs text-gray-400">
          Preparando estadísticas y métricas
        </div>
      </div>
    </div>
  );
}
