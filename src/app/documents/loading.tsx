import { Loader2, FolderOpen } from 'lucide-react';

export default function DocumentsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <FolderOpen className="text-primary h-8 w-8" />
          <Loader2 className="text-primary absolute -top-1 -right-1 h-4 w-4 animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm">Cargando documentos...</p>
        <div className="text-muted-foreground text-xs">
          Preparando biblioteca de documentos
        </div>
      </div>
    </div>
  );
}
