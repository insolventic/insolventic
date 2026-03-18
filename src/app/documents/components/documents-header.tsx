'use client';

import { useTransition } from 'react';
import { Cloud, Loader2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';
import {
  syncTemplatesWithGoogleDrive,
  syncDocumentsWithGoogleDrive,
} from '@/features/document/actions';

interface DocumentsHeaderProps {
  onShowPlaceholders: () => void;
  onTemplatesSynced: () => void;
  onDocumentsSynced: () => void;
}

export function DocumentsHeader({
  onShowPlaceholders,
  onTemplatesSynced,
  onDocumentsSynced,
}: Readonly<DocumentsHeaderProps>) {
  const { checkPermission } = useAuth();
  const canGenerateDocuments = checkPermission(P.GENERAR_DOCUMENTOS);
  const canViewDocuments = checkPermission(P.VER_DOCUMENTOS);
  const [isPending, startTransition] = useTransition();

  const handleSyncAll = () => {
    console.log('Starting sync process...');
    startTransition(async () => {
      const { success: templatesSuccess, data: templatesData } =
        await syncTemplatesWithGoogleDrive();

      if (templatesSuccess) {
        console.log('Templates sync successful:', templatesData);
        onTemplatesSynced();
      } else {
        console.error('Templates sync error');
      }

      const { success: documentsSuccess, data: documentsData } =
        await syncDocumentsWithGoogleDrive();

      if (documentsSuccess) {
        console.log('Documents sync successful:', documentsData);
        onDocumentsSynced();
      } else {
        console.error('Documents sync error');
      }
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-foreground text-3xl font-bold">
          Gestión de Documentos
        </h1>
        <p className="text-muted-foreground">
          Administre documentos legales y sincronice plantillas desde Google
          Drive
        </p>
      </div>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          onClick={handleSyncAll}
          disabled={!canGenerateDocuments || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Sincronizar con Drive
            </>
          )}
        </Button>
        <Button onClick={onShowPlaceholders} disabled={!canViewDocuments}>
          <Info className="mr-2 h-4 w-4" />
          Ver Placeholders
        </Button>
      </div>
    </div>
  );
}
