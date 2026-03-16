'use client';

import { useState } from 'react';

import { PermissionGuard } from '@/components/auth/permission-guard';
import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { DocumentsHeader } from './components/documents-header';
import { DocumentGeneration } from './components/document-generation';
import { PlaceholdersDialog } from './components/placeholders-dialog';
import { DocumentTabs } from './components/document-tabs';

export default function DocumentsPage() {
  const [showPlaceholdersDialog, setShowPlaceholdersDialog] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTemplatesSynced = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDocumentsSynced = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDocumentsGenerated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <PermissionGuard
      permission="Ver documentos"
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
                No tienes permisos para ver documentos.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <div className="bg-background min-h-screen">
        <DashboardHeader />

        <main className="container mx-auto px-4 py-6">
          <div className="space-y-6">
            <DocumentsHeader
              onShowPlaceholders={() => setShowPlaceholdersDialog(true)}
              onTemplatesSynced={handleTemplatesSynced}
              onDocumentsSynced={handleDocumentsSynced}
            />

            <DocumentGeneration
              onDocumentsGenerated={handleDocumentsGenerated}
            />

            <DocumentTabs refreshTrigger={refreshTrigger} />

            <PlaceholdersDialog
              open={showPlaceholdersDialog}
              onOpenChange={setShowPlaceholdersDialog}
            />
          </div>
        </main>
      </div>
    </PermissionGuard>
  );
}
