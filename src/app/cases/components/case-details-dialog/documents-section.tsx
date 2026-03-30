'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FileText,
  FolderOpen,
  RefreshCw,
  FileCheck,
  FilePlus,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import type { CaseWithRelations } from '@/features/case/schemas';
import { PreGenerationForm } from './pre-generation-form';
import { getPhaseBadgeClass, getPhaseLabel } from '@/lib/case-phases';
import {
  generateInitialDocuments,
  generateAdmissionDocuments,
  generateAgreementDocuments,
  generateFailureDocuments,
} from '@/features/document/actions-generation';

interface DocumentsSectionProps {
  caseData: CaseWithRelations;
  onDocumentsGenerated?: () => void;
}

// Tipos de fracaso disponibles
const FAILURE_TYPES = [
  { id: 'acuerdo-bilateral', name: 'Fracaso por Acuerdo Bilateral' },
  { id: 'falta-pago-gastos', name: 'Fracaso por Falta de Pago de Gastos' },
  { id: 'impugnacion', name: 'Fracaso por Impugnación del Acuerdo' },
  {
    id: 'inasistencia-vencimiento',
    name: 'Fracaso por Inasistencia y Vencimiento',
  },
  {
    id: 'inasistencia-animo',
    name: 'Fracaso por Inasistencia sin Ánimo de Conciliar',
  },
  { id: 'incumplimiento', name: 'Fracaso por Incumplimiento' },
  { id: 'muerte-deudor', name: 'Fracaso por Muerte del Deudor' },
  { id: 'propuesta-mala', name: 'Fracaso por Propuesta Inadecuada' },
  {
    id: 'propuesta-vencimiento',
    name: 'Fracaso por Propuesta Mala y Vencimiento',
  },
  { id: 'propuesta-quorum', name: 'Fracaso por Propuesta Mala y Quórum' },
  { id: 'reforma-acuerdo', name: 'Fracaso por Reforma del Acuerdo' },
  { id: 'vencimiento-terminos', name: 'Fracaso por Vencimiento de Términos' },
];

export function DocumentsSection({
  caseData,
  onDocumentsGenerated,
}: DocumentsSectionProps) {
  const [generatingInitial, setGeneratingInitial] = useState(false);
  const [generatingAdmission, setGeneratingAdmission] = useState(false);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [generatingFailure, setGeneratingFailure] = useState(false);
  const [selectedFailureType, setSelectedFailureType] = useState<string>('');
  const [showPreGenForm, setShowPreGenForm] = useState(false);
  const [preGenPackage, setPreGenPackage] = useState<2 | 3>(2);

  const generatedDocuments =
    caseData.documents?.filter((d) => d.isGenerated) || [];
  const hasDriveFolder = !!caseData.driveFolderId;

  const handleGenerateInitial = async () => {
    setGeneratingInitial(true);
    try {
      const result = await generateInitialDocuments(caseData.id);
      if (result.success) {
        toast.success(
          `Se generaron ${result.data?.documents.length || 0} documentos iniciales`,
        );
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

    const missingAdmissionData =
      !caseData.filingDate ||
      !caseData.designationDate ||
      !caseData.positionAcceptanceDate;

    if (missingAdmissionData) {
      setPreGenPackage(2);
      setShowPreGenForm(true);
      return;
    }

    setGeneratingAdmission(true);
    try {
      const result = await generateAdmissionDocuments(caseData.id);
      if (result.success) {
        toast.success(
          `Se generaron ${result.data?.length || 0} documentos de admisión`,
        );
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

    const missingAgreementData =
      caseData.approvalPercentage == null || !caseData.agreementValidityDate;

    if (missingAgreementData) {
      setPreGenPackage(3);
      setShowPreGenForm(true);
      return;
    }

    setGeneratingAgreement(true);
    try {
      const result = await generateAgreementDocuments(caseData.id);
      if (result.success) {
        toast.success(
          `Se generaron ${result.data?.length || 0} documentos de acuerdo`,
        );
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

  const handleGenerateFailure = async () => {
    if (!hasDriveFolder) {
      toast.error('Primero debe generar los documentos iniciales');
      return;
    }

    if (!selectedFailureType) {
      toast.error('Seleccione un tipo de fracaso');
      return;
    }

    setGeneratingFailure(true);
    try {
      const result = await generateFailureDocuments(
        caseData.id,
        selectedFailureType,
      );
      if (result.success) {
        toast.success(
          `Se generaron ${result.data?.length || 0} documentos de fracaso`,
        );
        onDocumentsGenerated?.();
      } else {
        toast.error(result.error || 'Error al generar documentos');
      }
    } catch (error) {
      toast.error('Error al generar documentos');
      console.error(error);
    } finally {
      setGeneratingFailure(false);
    }
  };

  const handlePreGenSaved = () => {
    setShowPreGenForm(false);
    onDocumentsGenerated?.();
  };

  const openDriveFolder = () => {
    if (caseData.driveFolderId) {
      window.open(
        `https://drive.google.com/drive/folders/${caseData.driveFolderId}`,
        '_blank',
      );
    }
  };

  const phaseDocumentHint = (() => {
    const phase = caseData.phase ?? 'Inicial';
    if (['Inicial'].includes(phase))
      return 'Genere los documentos iniciales para esta fase.';
    if (['Admisión'].includes(phase))
      return 'Genere los documentos de admisión para avanzar.';
    if (['En negociación', 'Audiencia programada'].includes(phase))
      return 'Documentos de negociación y audiencia disponibles.';
    if (['Acuerdo aprobado', 'Post-acuerdo'].includes(phase))
      return 'Genere los documentos del acuerdo.';
    if (['Fracaso'].includes(phase)) return 'Genere los documentos de fracaso.';
    return 'Documentos del caso.';
  })();

  return (
    <div className="space-y-6">
      {/* Phase context indicator */}
      <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
        <span className="text-muted-foreground text-sm">Fase actual:</span>
        <Badge className={getPhaseBadgeClass(caseData.phase)}>
          {getPhaseLabel(caseData.phase)}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {phaseDocumentHint}
        </span>
      </div>

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
              <p className="text-muted-foreground text-sm">
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
              <p className="text-muted-foreground text-sm">
                {generatedDocuments.length} documento(s)
              </p>
            </div>
            <Badge
              variant={generatedDocuments.length > 0 ? 'default' : 'secondary'}
            >
              {generatedDocuments.length > 0 ? 'Activo' : 'Sin documentos'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pre-generation form */}
      {showPreGenForm && (
        <PreGenerationForm
          caseData={caseData}
          packageNumber={preGenPackage}
          onDataSaved={handlePreGenSaved}
        />
      )}

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
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">1. Documentos de Solicitud</p>
              <p className="text-muted-foreground text-sm">
                Solicitud, Check List, Certificado de Ingresos, Declaración,
                Hoja Guía
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
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">2. Documentos de Admisión</p>
              <p className="text-muted-foreground text-sm">
                Auto Admisión, Designación, Aceptación, Notificación, Edicto,
                Suspensiones
              </p>
              <p className="mt-1 text-xs text-amber-600">
                ⚠️ Requiere fechas de radicación, designación y aceptación
                ingresadas
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
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">3. Documentos de Acuerdo</p>
              <p className="text-muted-foreground text-sm">
                Acuerdo de Pago, Acuerdo Bilateral, Remisión Resultado
              </p>
              <p className="mt-1 text-xs text-amber-600">
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

          {/* Etapa 4: Documentos de Fracaso */}
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/50">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="font-medium text-red-700">
                4. Documentos de Fracaso
              </p>
            </div>
            <p className="text-muted-foreground mb-3 text-sm">
              Constancia de No Acuerdo y Remisión al Juzgado
            </p>
            <div className="flex gap-3">
              <Select
                value={selectedFailureType}
                onValueChange={setSelectedFailureType}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccione tipo de fracaso..." />
                </SelectTrigger>
                <SelectContent>
                  {FAILURE_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerateFailure}
                disabled={
                  generatingFailure || !hasDriveFolder || !selectedFailureType
                }
                variant="destructive"
              >
                {generatingFailure ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-4 w-4" />
                    Generar Fracaso
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-red-600">
              ⚠️ Esta acción genera documentos para enviar el caso al juzgado
              por liquidación patrimonial
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de documentos generados */}
      {generatedDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Documentos Generados ({generatedDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {generatedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary h-4 w-4" />
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
