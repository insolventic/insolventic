import { requirePageAuth } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { AuditLogManagement } from './components/audit-log-management';

export default async function AuditLogPage() {
  // Verify authentication server-side before rendering (M-9)
  await requirePageAuth('/audit-log');

  return (
    <PermissionGuard
      permission="Ver auditoría"
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
                No tienes permisos para ver la auditoría del sistema.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <AuditLogManagement />
    </PermissionGuard>
  );
}
