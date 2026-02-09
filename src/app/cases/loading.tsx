import { Loader2, FileText } from 'lucide-react';

export default function CasesLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <FileText className="h-8 w-8 text-blue-600" />
          <Loader2 className="absolute -top-1 -right-1 h-4 w-4 animate-spin text-blue-600" />
        </div>
        <p className="text-muted-foreground text-sm">Cargando casos...</p>
        <div className="text-xs text-gray-400">
          Obteniendo información de casos de insolvencia
        </div>
      </div>
    </div>
  );
}
