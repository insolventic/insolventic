'use client';

import { useState, useEffect, useTransition } from 'react';
import { Wand2, Check, FileDown, Loader2, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

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
import { getAllCases } from '@/features/case/actions';
import { batchGenerateDocuments } from '@/features/document/actions';

interface DocumentGenerationProps {
  onDocumentsGenerated: () => void;
}

export function DocumentGeneration({
  onDocumentsGenerated,
}: Readonly<DocumentGenerationProps>) {
  const { checkPermission } = useAuth();
  const canGenerateDocuments = checkPermission('Generar documentos');
  const [selectedCaseForGeneration, setSelectedCaseForGeneration] =
    useState('');
  const [open, setOpen] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
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
      status: 'success' | 'error';
      error?: string;
    }>;
    generatedAt: Date;
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
  } | null>(null);

  const [cases, setCases] = useState<
    Array<{
      id: string;
      caseNumber: string;
      debtorName: string;
      type: string;
    }>
  >([]);
  const [isPending, startTransition] = useTransition();

  const handleBatchGeneration = () => {
    if (!selectedCaseForGeneration) return;

    setGenerationResult(null);

    startTransition(async () => {
      const { success, data, message } = await batchGenerateDocuments({
        caseId: selectedCaseForGeneration,
        outputFormat: 'docx',
      });

      if (success && data) {
        setGenerationResult(data);
        onDocumentsGenerated();
        toast.success('Documentos generados exitosamente');
      } else {
        console.error('Error in batch generation');
        toast.error(
          'Error al generar documentos: ' + (message || 'Error desconocido'),
        );
      }
    });
  };

  useEffect(() => {
    const loadCases = async () => {
      const { success, data } = await getAllCases();
      if (success && data) {
        setCases(
          data.map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            debtorName: c.debtorName,
            type: c.type,
          })),
        );
      }
    };

    loadCases();
  }, []);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Generación de Documentos
        </CardTitle>
        <CardDescription>
          Genera todos los documentos de plantilla para un caso específico
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="case-select">Buscar y Seleccionar Caso</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                  disabled={isPending}
                >
                  {selectedCaseForGeneration
                    ? (() => {
                        const selectedCase = cases.find(
                          (caseItem) =>
                            caseItem.id === selectedCaseForGeneration,
                        );
                        return selectedCase
                          ? `${selectedCase.caseNumber} - ${selectedCase.debtorName}`
                          : 'Selecciona un caso...';
                      })()
                    : 'Selecciona un caso...'}
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
                    <CommandGroup>
                      {cases.map((caseItem) => (
                        <CommandItem
                          key={caseItem.id}
                          value={`${caseItem.caseNumber} ${caseItem.debtorName} ${caseItem.type}`}
                          onSelect={() => {
                            setSelectedCaseForGeneration(
                              caseItem.id === selectedCaseForGeneration
                                ? ''
                                : caseItem.id,
                            );
                            setOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {caseItem.caseNumber}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              {caseItem.debtorName}
                            </span>
                          </div>
                          <Check
                            className={cn(
                              'ml-auto h-4 w-4',
                              selectedCaseForGeneration === caseItem.id
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
          <Button
            onClick={handleBatchGeneration}
            disabled={
              !selectedCaseForGeneration || isPending || !canGenerateDocuments
            }
            className="w-full lg:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Generar Documentos
              </>
            )}
          </Button>
        </div>

        {generationResult && (
          <div className="mt-6 rounded-lg border bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-800">
              <Check className="h-5 w-5" />
              <h3 className="font-semibold">Documentos Generados</h3>
            </div>
            <div className="mt-2 space-y-2">
              <p className="text-sm text-green-700">
                Se generaron {generationResult.successfulDocuments} de{' '}
                {generationResult.totalDocuments} documentos para el caso{' '}
                <strong>{generationResult.caseNumber}</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {generationResult.documents.map((doc, index) => (
                  <Badge
                    key={doc.documentId || `doc-${index}-${doc.templateId}`}
                    variant={
                      doc.status === 'success' ? 'default' : 'destructive'
                    }
                  >
                    {doc.templateName}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
