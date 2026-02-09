import { Loader2, Bell } from 'lucide-react';

export default function NotificationsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Bell className="h-8 w-8 text-blue-600" />
          <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-blue-600" />
        </div>
        <p className="text-muted-foreground text-sm">
          Cargando notificaciones...
        </p>
        <div className="text-xs text-gray-400">
          Sincronizando alertas del sistema
        </div>
      </div>
    </div>
  );
}
