import { Loader2, LogIn } from 'lucide-react';

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <LogIn className="h-8 w-8 text-blue-600" />
          <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-blue-600" />
        </div>
        <p className="text-muted-foreground text-sm">Iniciando sesión...</p>
        <div className="text-xs text-gray-400">Verificando credenciales</div>
      </div>
    </div>
  );
}
