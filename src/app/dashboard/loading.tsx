import { Loader2, BarChart3 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <BarChart3 className="text-primary h-8 w-8" />
          <Loader2 className="text-primary absolute -top-1 -right-1 h-4 w-4 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm">Cargando dashboard...</p>
        <div className="text-muted-foreground text-xs">
          Preparando estadísticas y métricas
        </div>
      </div>
    </div>
  );
}
