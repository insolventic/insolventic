import { PermissionGuard } from '@/components/auth/permission-guard';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { ReportsContent } from './components/reports-content';

export default function ReportsPage() {
  return (
    <PermissionGuard
      permission="Ver reportes"
      redirectTo="/dashboard"
      fallback={
        <div className="bg-background min-h-screen">
          <DashboardHeader />
          <main className="container mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-foreground text-2xl font-bold">
                Acceso Denegado
              </h1>
              <p className="text-muted-foreground">
                No tienes permisos para ver reportes.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <ReportsContent />
    </PermissionGuard>
  );
}
