import { PermissionGuard } from '@/components/auth/permission-guard';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { NotificationManagement } from './components/notification-management';

export default function NotificationsPage() {
  return (
    <PermissionGuard
      permission="Ver notificaciones"
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
                No tienes permisos para ver notificaciones.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <NotificationManagement />
    </PermissionGuard>
  );
}
