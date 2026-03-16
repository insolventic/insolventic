import { Loader2, Bell } from 'lucide-react';

export default function NotificationsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Bell className="text-primary h-8 w-8" />
          <Loader2 className="text-primary absolute -top-1 -right-1 h-4 w-4 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm">
          Cargando notificaciones...
        </p>
        <div className="text-muted-foreground text-xs">
          Sincronizando alertas del sistema
        </div>
      </div>
    </div>
  );
}
