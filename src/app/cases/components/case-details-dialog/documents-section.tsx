'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, FolderOpen, RefreshCw, FileCheck, FilePlus } from 'lucide-react';
import { toast } from 'sonner';

import type { CaseWithRelations } from '@/features/case/schemas';
import {
  generateInitialDocuments,
  generateAdmissionDocuments,
  generateAgreementDocuments,
} from '@/features/document/actions-generation';

interface DocumentsSectionProps {
  caseData: CaseWithRelations;
  onDocumentsGenerated?: () => void;
}

export function DocumentsSection({ caseData, onDocumentsGenerated }: DocumentsSectionProps) {
  const [generatingInitial, setGeneratingInitial] = useState(false);
  const [generatingAdmission, setGeneratingAdmission] = useState(false);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);

  const generatedDocuments = caseData.documents?.filter(d => d.isGenerated) || [];
  const hasDriveFolder = !!caseData.driveFolderId;

  const handleGenerateInitial = async () => {
    setGeneratingInitial(true);
    try {
      const result = await generateInitialDocuments(caseData.id);
      if (result.success) {
        toast.success(`Se generaron ${result.data?.documents.length || 0} documentos iniciales`);
        onDocumentsGenerated?.();
      } else {
        toast.error(result.error || 'Error al generar documentos');
      }
    } catch (error) {
      toast.error('Error al generar documentos');
      console.error(error);
    } finally {
      setGeneratingInitial(false);
    }
  };

  const handleGenerateAdmission = async () => {
    if (!hasDriveFolder) {
      toast.error('Primero debe generar los documentos iniciales');
      return;
    }

    setGeneratingAdmission(true);
    try {
      const result = await generateAdmissionDocuments(caseData.id);
      if (result.success) {
        toast.success(`Se generaron ${result.data?.length || 0} documentos de admisión`);
        onDocumentsGenerated?.();
      } else {
        toast.error(result.error || 'Error al generar documentos');
      }
    } catch (error) {
      toast.error('Error al generar documentos');
      console.error(error);
    } finally {
      setGeneratingAdmission(false);
    }
  };

  const handleGenerateAgreement = async () => {
    if (!hasDriveFolder) {
      toast.error('Primero debe generar los documentos iniciales');
      return;
    }

    setGeneratingAgreement(true);
    try {
      const result = await generateAgreementDocuments(caseData.id);
      if (result.success) {
        toast.success(`Se generaron ${result.data?.length || 0} documentos de acuerdo`);
        onDocumentsGenerated?.();
      } else {
        toast.error(result.error || 'Error al generar documentos');
      }
    } catch (error) {
      toast.error('Error al generar documentos');
      console.error(error);
    } finally {
      setGeneratingAgreement(false);
    }
  };

  const openDriveFolder = () => {
    if (caseData.driveFolderId) {
      window.open(`https://drive.google.com/drive/folders/${caseData.driveFolderId}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Estado de Documentos
          </CardTitle>
          <CardDescription>
            Gestione la generación de documentos del caso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Carpeta en Google Drive</p>
              <p className="text-sm text-muted-foreground">
                {hasDriveFolder ? 'Creada' : 'No creada aún'}
              </p>
            </div>
            {hasDriveFolder && (
              <Button variant="outline" size="sm" onClick={openDriveFolder}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Abrir carpeta
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Documentos generados</p>
              <p className="text-sm text-muted-foreground">
                {generatedDocuments.length} documento(s)
              </p>
            </div>
            <Badge variant={generatedDocuments.length > 0 ? 'default' : 'secondary'}>
              {generatedDocuments.length > 0 ? 'Activo' : 'Sin documentos'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Botones de generación por etapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus className="h-5 w-5" />
            Generar Documentos por Etapa
          </CardTitle>
          <CardDescription>
            Genere documentos según la etapa del proceso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Etapa 1: Documentos Iniciales */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">1. Documentos de Solicitud</p>
              <p className="text-sm text-muted-foreground">
                Solicitud, Check List, Certificado de Ingresos, Declaración, Hoja Guía
              </p>
            </div>
            <Button
              onClick={handleGenerateInitial}
              disabled={generatingInitial}
              variant={hasDriveFolder ? 'outline' : 'default'}
            >
              {generatingInitial ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : hasDriveFolder ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerar
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Generar
                </>
              )}
            </Button>
          </div>

          {/* Etapa 2: Documentos de Admisión */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">2. Documentos de Admisión</p>
              <p className="text-sm text-muted-foreground">
                Auto Admisión, Designación, Aceptación, Notificación, Edicto, Suspensiones
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Requiere fechas de radicación, designación y aceptación ingresadas
              </p>
            </div>
            <Button
              onClick={handleGenerateAdmission}
              disabled={generatingAdmission || !hasDriveFolder}
              variant="outline"
            >
              {generatingAdmission ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Generar Admisión
                </>
              )}
            </Button>
          </div>

          {/* Etapa 3: Documentos de Acuerdo */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">3. Documentos de Acuerdo</p>
              <p className="text-sm text-muted-foreground">
                Acuerdo de Pago, Acuerdo Bilateral, Remisión Resultado
              </p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Requiere datos de votación y vigencia del acuerdo
              </p>
            </div>
            <Button
              onClick={handleGenerateAgreement}
              disabled={generatingAgreement || !hasDriveFolder}
              variant="outline"
            >
              {generatingAgreement ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Generar Acuerdo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de documentos generados */}
      {generatedDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos Generados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {generatedDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">{doc.name}</span>
                  </div>
                  {doc.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.url!, '_blank')}
                    >
                      Ver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
