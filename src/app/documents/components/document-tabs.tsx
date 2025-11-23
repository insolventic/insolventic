'use client';

import { useState, useEffect } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  DocumentFromDrive,
  DocumentTemplate,
} from '@/features/document/schemas';
import {
  getTemplatesFromDatabase,
  getDocumentsFromDrive,
} from '@/features/document/actions';

import { DocumentFileTree } from './document-file-tree';
import { DocumentTemplateLibrary } from './document-template-library';

interface DocumentTabsProps {
  refreshTrigger: number;
}

export function DocumentTabs({ refreshTrigger }: Readonly<DocumentTabsProps>) {
  const [documentsFromDrive, setDocumentsFromDrive] = useState<
    DocumentFromDrive[]
  >([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { success: templatesSuccess, data: templatesData } =
        await getTemplatesFromDatabase();
      if (templatesSuccess && templatesData) {
        setTemplates(templatesData);
      }

      const { success: documentsSuccess, data: documentsData } =
        await getDocumentsFromDrive();
      if (documentsSuccess && documentsData) {
        setDocumentsFromDrive(documentsData);
      }
    };

    loadData();
  }, [refreshTrigger]);

  return (
    <Tabs defaultValue="documents" className="space-y-4">
      <TabsList>
        <TabsTrigger value="documents">Documentos</TabsTrigger>
        <TabsTrigger value="templates">Plantillas</TabsTrigger>
      </TabsList>

      <TabsContent value="documents" className="space-y-4">
        <DocumentFileTree documentsFromDrive={documentsFromDrive} />
      </TabsContent>

      <TabsContent value="templates">
        <DocumentTemplateLibrary templates={templates} />
      </TabsContent>
    </Tabs>
  );
}
