import { PermissionGuard } from '@/components/auth/permission-guard';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { NotificationManagement } from './components/notification-management';

export default function NotificationsPage() {
  return (
    <PermissionGuard
      permission="Ver notificaciones"
      redirectTo="/dashboard"
      fallback={
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <main className="container mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Acceso Denegado
              </h1>
              <p className="text-gray-600">
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
