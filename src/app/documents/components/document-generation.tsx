'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import {
  Wand2,
  Check,
  FileDown,
  Loader2,
  ChevronsUpDown,
  Package,
  ExternalLink,
  AlertCircle,
  FolderOpen,
  Info,
  XCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { P } from '@/lib/permissions';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCasesForSelector } from '@/features/case/actions';
import {
  batchGenerateDocuments,
  planBatchGeneration,
} from '@/features/document/actions';
import {
  ALL_TEMPLATES,
  getPackageInfo,
} from '@/features/document/templates-config';

/**
 * Revisión de PR #140: los conteos eran literales escritos a mano (49, 27...)
 * y habían quedado desactualizados contra `templates-config.ts` (65 y 29
 * reales — ver docs/IMPLEMENTACION_SEMANA_7.md §2.1). Ahora se calculan de la
 * misma fuente que resuelve `planBatchGeneration` (`getPackageInfo`/
 * `ALL_TEMPLATES`), así que no pueden volver a divergir — el test de guardia
 * (`document-generation.test.tsx`, "las etiquetas de paquete muestran el
 * conteo real") falla si alguna vez vuelven a hardcodearse.
 */
const PACKAGES = [
  { value: 'all', label: 'Todos los paquetes', count: ALL_TEMPLATES.length },
  ...getPackageInfo().map((pkg) => ({
    value: String(pkg.packageNumber),
    label: `Paquete ${pkg.packageNumber} - ${pkg.name}`,
    count: pkg.templateCount,
  })),
];

const TYPE_COLORS: Record<string, string> = {
  Insolvencia:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Conciliación:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Acuerdo de Apoyo':
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

interface CaseOption {
  id: string;
  caseNumber: string;
  debtorName: string;
  type: string;
  documentCount: number;
  driveFolderId?: string | null;
  phase?: string | null;
}

interface GenerationResultData {
  caseId: string;
  caseNumber: string;
  folderId: string;
  folderUrl: string;
  documents: Array<{
    templateId: string;
    templateName: string;
    documentId: string;
    documentName: string;
    documentUrl: string;
    status: 'success' | 'error' | 'skipped';
    error?: string;
    /** Campos obligatorios faltantes que bloquearon la generación (C-3). */
    missingFields?: string[];
  }>;
  generatedAt: Date;
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  skippedDocuments?: number;
  /** GD-A1 (issue #3): id de la `DocumentGenerationRequest` compartida por
   * todas las tandas de este lote — se necesita para encadenar la siguiente
   * tanda o para reintentar esta si falla. */
  requestId?: string;
}

interface DocumentGenerationProps {
  onDocumentsGenerated: () => void;
}

export function DocumentGeneration({
  onDocumentsGenerated,
}: Readonly<DocumentGenerationProps>) {
  const { checkPermission } = useAuth();
  const canGenerateDocuments = checkPermission(P.GENERAR_DOCUMENTOS);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx' | 'both'>(
    'pdf',
  );
  const [open, setOpen] = useState(false);
  const [generationResult, setGenerationResult] =
    useState<GenerationResultData | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // GD-A1 (issue #3): progreso de la generación por tandas, y lo necesario
  // para reintentar SOLO la tanda que falló (no todo el lote desde cero).
  const [tandaProgress, setTandaProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [pendingRetry, setPendingRetry] = useState<{
    caseId: string;
    tandas: string[][];
    nextIndex: number;
    requestId: string;
    outputFormat: 'pdf' | 'docx' | 'both';
    accumulated: GenerationResultData;
  } | null>(null);

  const [cases, setCases] = useState<CaseOption[]>([]);
  /** Cuántos casos quedaron fuera del tope del selector. */
  const [casosOcultos, setCasosOcultos] = useState(0);
  const [isPending, startTransition] = useTransition();

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const selectedPkg = useMemo(
    () => PACKAGES.find((p) => p.value === selectedPackage),
    [selectedPackage],
  );

  const handleCaseSelect = (caseId: string) => {
    const newCaseId = caseId === selectedCaseId ? '' : caseId;
    setSelectedCaseId(newCaseId);
    setGenerationResult(null);
    setShowErrors(false);
    setOpen(false);
  };

  /**
   * Suma el resultado de una tanda al acumulado de las anteriores.
   * `caseId`/`caseNumber`/`folderId`/`folderUrl` son los mismos en todas las
   * tandas de un mismo caso — se toman de la más reciente. `documents` se
   * concatena y los 4 conteos se suman.
   */
  function mergeTandaResult(
    acumulado: GenerationResultData | null,
    tanda: GenerationResultData,
  ): GenerationResultData {
    if (!acumulado) return tanda;
    return {
      ...tanda,
      documents: [...acumulado.documents, ...tanda.documents],
      totalDocuments: acumulado.totalDocuments + tanda.totalDocuments,
      successfulDocuments:
        acumulado.successfulDocuments + tanda.successfulDocuments,
      failedDocuments: acumulado.failedDocuments + tanda.failedDocuments,
      skippedDocuments:
        (acumulado.skippedDocuments ?? 0) + (tanda.skippedDocuments ?? 0),
    };
  }

  /**
   * GD-A1 (issue #3): corre las tandas desde `startIndex` en adelante, en
   * orden, encadenando `requestId` para que todas escriban sobre la MISMA
   * `DocumentGenerationRequest` (ver generation-request.ts). Si una tanda
   * falla, no sigue con las siguientes: guarda el punto exacto donde se
   * puede reintentar (`pendingRetry`) y no toca lo que las tandas
   * anteriores ya generaron.
   */
  async function runTandas(params: {
    caseId: string;
    tandas: string[][];
    startIndex: number;
    requestId: string | undefined;
    outputFormat: 'pdf' | 'docx' | 'both';
    accumulated: GenerationResultData | null;
  }): Promise<void> {
    const { caseId, tandas, outputFormat } = params;
    let requestId = params.requestId;
    let accumulated = params.accumulated;

    for (let i = params.startIndex; i < tandas.length; i++) {
      setTandaProgress({ current: i + 1, total: tandas.length });

      const { success, data, message } = await batchGenerateDocuments({
        caseId,
        templateIds: tandas[i],
        outputFormat,
        requestId,
        isFinalTanda: i === tandas.length - 1,
      });

      if (!success || !data) {
        setPendingRetry({
          caseId,
          tandas,
          nextIndex: i,
          requestId: requestId ?? '',
          outputFormat,
          accumulated: accumulated ?? {
            caseId,
            caseNumber: '',
            folderId: '',
            folderUrl: '',
            documents: [],
            generatedAt: new Date(),
            totalDocuments: 0,
            successfulDocuments: 0,
            failedDocuments: 0,
            skippedDocuments: 0,
          },
        });
        setTandaProgress(null);
        toast.error(
          `Tanda ${i + 1} de ${tandas.length} falló: ${message || 'Error desconocido'}. Las tandas anteriores ya generadas no se pierden — puede reintentar solo esta.`,
        );
        return;
      }

      requestId = data.requestId ?? requestId;
      accumulated = mergeTandaResult(accumulated, data);
      setGenerationResult(accumulated);
    }

    setTandaProgress(null);
    setPendingRetry(null);
    onDocumentsGenerated();
    if (accumulated) {
      toast.success(
        `${accumulated.successfulDocuments} documentos generados exitosamente`,
      );
    }
  }

  const handleBatchGeneration = () => {
    if (!selectedCaseId) return;

    setGenerationResult(null);
    setShowErrors(false);
    setPendingRetry(null);

    startTransition(async () => {
      const packageNumber =
        selectedPackage !== 'all'
          ? (Number(selectedPackage) as 1 | 2 | 3 | 4 | 5)
          : undefined;

      const plan = await planBatchGeneration({
        caseId: selectedCaseId,
        packageNumber,
      });

      if (!plan.success || !plan.data) {
        toast.error(
          'Error al planificar la generación: ' +
            (plan.message || 'Error desconocido'),
        );
        return;
      }
      if (plan.data.tandas.length === 0) {
        toast.error('No se encontraron plantillas para procesar.');
        return;
      }

      await runTandas({
        caseId: selectedCaseId,
        tandas: plan.data.tandas,
        startIndex: 0,
        requestId: undefined,
        outputFormat: selectedFormat,
        accumulated: null,
      });
    });
  };

  const handleRetryTanda = () => {
    if (!pendingRetry) return;
    const retry = pendingRetry;
    setPendingRetry(null);

    startTransition(async () => {
      await runTandas({
        caseId: retry.caseId,
        tandas: retry.tandas,
        startIndex: retry.nextIndex,
        requestId: retry.requestId || undefined,
        outputFormat: retry.outputFormat,
        accumulated: retry.accumulated,
      });
    });
  };

  useEffect(() => {
    const loadCases = async () => {
      // `getCasesForSelector` y no el listado paginado: este combobox filtra en
      // el cliente, así que necesita el conjunto, no una página de 20. Trae
      // solo las seis columnas que se mapean abajo, sin la relación del
      // deudor, y con un tope — que es el que `casosOcultos` informa, para no
      // hacer pasar un recorte por la lista completa.
      const { success, data } = await getCasesForSelector();
      if (success && data) {
        setCases(
          data.items.map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            debtorName: c.debtorName,
            type: c.type,
            documentCount: c._count?.documents ?? 0,
            driveFolderId: c.driveFolderId,
            phase: c.phase,
          })),
        );
        setCasosOcultos(Math.max(0, data.total - data.items.length));
      }
    };

    loadCases();
  }, []);

  const successDocs = generationResult?.documents.filter(
    (d) => d.status === 'success',
  );
  const failedDocs = generationResult?.documents.filter(
    (d) => d.status === 'error',
  );
  // C-3: documentos NO generados por datos incompletos. Se separan de los
  // errores técnicos porque la acción del usuario es distinta: completar el
  // expediente, no reintentar.
  const incompleteDocs = generationResult?.documents.filter(
    (d) => d.status === 'skipped',
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Generación de Documentos
        </CardTitle>
        <CardDescription>
          Selecciona un caso, paquete y formato para generar documentos. Los
          documentos se guardan automáticamente en Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Case & Package selectors */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          {/* Case selector */}
          <div className="space-y-2">
            <Label htmlFor="case-select">Caso</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                  disabled={isPending}
                >
                  {selectedCase
                    ? `${selectedCase.caseNumber} - ${selectedCase.debtorName}`
                    : 'Buscar y seleccionar caso...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar por número de caso, deudor o tipo..."
                    className="h-9"
                  />
                  <CommandList>
                    <CommandEmpty>No se encontraron casos.</CommandEmpty>
                    {casosOcultos > 0 && (
                      <div className="text-muted-foreground border-b px-3 py-2 text-xs">
                        Mostrando los {cases.length} casos más recientes. Quedan{' '}
                        {casosOcultos} fuera de la lista: buscá por número de
                        caso desde el listado de casos.
                      </div>
                    )}
                    <CommandGroup>
                      {cases.map((caseItem) => (
                        <CommandItem
                          key={caseItem.id}
                          value={`${caseItem.caseNumber} ${caseItem.debtorName} ${caseItem.type}`}
                          onSelect={() => handleCaseSelect(caseItem.id)}
                        >
                          <div className="flex flex-1 items-center gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {caseItem.caseNumber}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {caseItem.debtorName}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'ml-auto text-xs',
                                TYPE_COLORS[caseItem.type] || '',
                              )}
                            >
                              {caseItem.type}
                            </Badge>
                          </div>
                          <Check
                            className={cn(
                              'ml-2 h-4 w-4 shrink-0',
                              selectedCaseId === caseItem.id
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Package selector */}
          <div className="space-y-2">
            <Label htmlFor="package-select">Paquete de Documentos</Label>
            <Select
              value={selectedPackage}
              onValueChange={setSelectedPackage}
              disabled={isPending}
            >
              <SelectTrigger>
                <Package className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Selecciona un paquete" />
              </SelectTrigger>
              <SelectContent>
                {PACKAGES.map((pkg) => (
                  <SelectItem key={pkg.value} value={pkg.value}>
                    {pkg.label} ({pkg.count} doc.)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format selector */}
          <div className="space-y-2">
            <Label htmlFor="format-select">Formato</Label>
            <Select
              value={selectedFormat}
              onValueChange={(v) =>
                setSelectedFormat(v as 'pdf' | 'docx' | 'both')
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">Solo PDF</SelectItem>
                <SelectItem value="docx">Solo Word (.docx)</SelectItem>
                <SelectItem value="both">Ambos (PDF + Word)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleBatchGeneration}
            disabled={!selectedCaseId || isPending || !canGenerateDocuments}
            className="w-full lg:w-auto"
            size="default"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tandaProgress
                  ? `Generando tanda ${tandaProgress.current} de ${tandaProgress.total}...`
                  : 'Generando...'}
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Generar Documentos
              </>
            )}
          </Button>
        </div>

        {/* GD-A1 (issue #3): una tanda falló — las anteriores ya generaron
            sus documentos, no se pierden. El reintento retoma SOLO la que
            falló, sobre la misma DocumentGenerationRequest. */}
        {pendingRetry && !isPending && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                La tanda {pendingRetry.nextIndex + 1} de{' '}
                {pendingRetry.tandas.length} no se completó. Los documentos de
                las tandas anteriores ya están generados.
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleRetryTanda}>
              Reintentar
            </Button>
          </div>
        )}

        {/* Selected case info panel */}
        {selectedCase && !generationResult && (
          <div className="bg-muted/40 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <FileText className="text-muted-foreground h-4 w-4" />
                <span className="font-medium">{selectedCase.caseNumber}</span>
              </div>

              <span className="text-muted-foreground">
                {selectedCase.debtorName}
              </span>

              <Badge
                variant="outline"
                className={cn('text-xs', TYPE_COLORS[selectedCase.type] || '')}
              >
                {selectedCase.type}
              </Badge>

              {selectedCase.phase && (
                <Badge variant="secondary" className="text-xs">
                  {selectedCase.phase}
                </Badge>
              )}

              <span className="text-muted-foreground text-xs">
                {selectedCase.documentCount} doc. existentes
              </span>
            </div>

            {/* Warning: existing documents */}
            {selectedCase.documentCount > 0 && (
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Este caso ya tiene {selectedCase.documentCount} documento(s)
                  generado(s). Al generar nuevamente se crearán documentos
                  adicionales sin reemplazar los existentes.
                </span>
              </div>
            )}

            {/* Info: what will be generated */}
            {selectedPkg && (
              <div className="text-muted-foreground mt-2 flex items-start gap-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Se generarán <strong>{selectedPkg.count}</strong> documento(s)
                  del {selectedPkg.label.toLowerCase()} para este caso.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Generation results */}
        {generationResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div
              className={cn(
                'rounded-lg border p-4',
                generationResult.failedDocuments > 0
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check
                    className={cn(
                      'h-5 w-5',
                      generationResult.failedDocuments > 0
                        ? 'text-amber-700'
                        : 'text-green-700',
                    )}
                  />
                  <h3
                    className={cn(
                      'font-semibold',
                      generationResult.failedDocuments > 0
                        ? 'text-amber-800'
                        : 'text-green-800',
                    )}
                  >
                    Generación Completada
                  </h3>
                </div>

                {/* Google Drive folder link */}
                {generationResult.folderUrl && (
                  <a
                    href={generationResult.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-card text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Abrir en Drive
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <p
                className={cn(
                  'mt-2 text-sm',
                  generationResult.failedDocuments > 0
                    ? 'text-amber-700'
                    : 'text-green-700',
                )}
              >
                Se generaron{' '}
                <strong>{generationResult.successfulDocuments}</strong> de{' '}
                <strong>{generationResult.totalDocuments}</strong> documentos
                para el caso <strong>{generationResult.caseNumber}</strong>.
                {generationResult.failedDocuments > 0 && (
                  <span className="text-red-600">
                    {' '}
                    {generationResult.failedDocuments} documento(s) fallaron.
                  </span>
                )}
              </p>
            </div>

            {/* Successful documents */}
            {successDocs && successDocs.length > 0 && (
              <div>
                <h4 className="text-foreground mb-2 text-sm font-medium">
                  Documentos generados ({successDocs.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {successDocs.map((doc, index) =>
                    doc.documentUrl ? (
                      <a
                        key={doc.documentId || `doc-${index}-${doc.templateId}`}
                        href={doc.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                        title={doc.documentName}
                      >
                        <Badge
                          variant="default"
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        >
                          {doc.templateName}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Badge>
                      </a>
                    ) : (
                      <Badge
                        key={doc.documentId || `doc-${index}-${doc.templateId}`}
                        variant="default"
                        title={doc.documentName}
                      >
                        {doc.templateName}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Blocked by incomplete data (C-3) */}
            {incompleteDocs && incompleteDocs.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  {incompleteDocs.length} documento(s) no generados por datos
                  incompletos
                </h4>
                <div className="space-y-1">
                  {incompleteDocs.map((doc, index) => (
                    <div
                      key={`skip-${index}-${doc.templateId}`}
                      className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950"
                    >
                      <span className="font-medium text-amber-800">
                        {doc.templateName}
                      </span>
                      {doc.missingFields && doc.missingFields.length > 0 && (
                        <p className="mt-0.5 text-xs text-amber-700">
                          Falta: {doc.missingFields.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  Complete estos datos en el expediente y vuelva a generar. No
                  se subió ningún archivo incompleto a Drive.
                </p>
              </div>
            )}

            {/* Failed documents */}
            {failedDocs && failedDocs.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowErrors(!showErrors)}
                  className="mb-2 flex items-center gap-1 text-sm font-medium text-red-700 hover:underline"
                >
                  <XCircle className="h-4 w-4" />
                  {failedDocs.length} documento(s) con error
                  <span className="text-xs">
                    {showErrors ? '(ocultar)' : '(ver detalles)'}
                  </span>
                </button>
                {showErrors && (
                  <div className="space-y-1">
                    {failedDocs.map((doc, index) => (
                      <div
                        key={`err-${index}-${doc.templateId}`}
                        className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-800 dark:bg-red-950"
                      >
                        <span className="font-medium text-red-800">
                          {doc.templateName}
                        </span>
                        {doc.error && (
                          <p className="mt-0.5 text-xs text-red-600">
                            {doc.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Permission notice */}
        {!canGenerateDocuments && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No tienes permisos para generar documentos. Contacta al
            administrador.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
