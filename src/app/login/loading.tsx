import { Loader2, LogIn } from 'lucide-react';

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <LogIn className="text-primary h-8 w-8" />
          <Loader2 className="text-primary absolute -top-1 -right-1 h-4 w-4 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm">Iniciando sesión...</p>
        <div className="text-muted-foreground text-xs">
          Verificando credenciales
        </div>
      </div>
    </div>
  );
}
