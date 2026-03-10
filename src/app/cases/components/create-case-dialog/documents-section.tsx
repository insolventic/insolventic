'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  REQUIRED_DOCUMENTS,
  CONDITIONAL_DOCUMENTS,
  OPTIONAL_DOCUMENTS,
  getRequiredDocuments,
} from '@/features/case/validation-rules';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ACCEPT_STRING =
  ALLOWED_MIME_TYPES.join(',') + ',' + ALLOWED_EXTENSIONS.join(',');

interface DocumentsSectionProps {
  onFilesSelected?: (
    selections: Array<{ docName: string; docKey: string; files: File[] }>,
  ) => void;
  applicantScope?: string[];
}

type DocConfig = { key: string; label: string; multiple?: boolean };

function isAllowedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return (
    ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext)
  );
}

export function DocumentsSection({
  onFilesSelected,
  applicantScope = [],
}: Readonly<DocumentsSectionProps>) {
  // Build mandatory docs list based on case data
  const caseDataPartial: Partial<CreateCaseFormInput> = { applicantScope };
  const requiredIds = useMemo(
    () => getRequiredDocuments(caseDataPartial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(applicantScope)],
  );

  const mandatoryDocs: DocConfig[] = useMemo(() => {
    const allRequiredDocs = [...REQUIRED_DOCUMENTS, ...CONDITIONAL_DOCUMENTS];
    return requiredIds.map((id) => {
      const doc = allRequiredDocs.find((d) => d.id === id);
      return { key: id, label: doc?.name ?? id };
    });
  }, [requiredIds]);

  const optionalDocs: DocConfig[] = useMemo(
    () =>
      OPTIONAL_DOCUMENTS.map((d) => ({
        key: d.id,
        label: d.name,
        multiple: d.multiple,
      })),
    [],
  );

  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, File[]>>({});

  const allDocs = [...mandatoryDocs, ...optionalDocs];

  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleChoose = (key: string) => {
    inputsRef.current[key]?.click();
  };

  const notifyParent = (newMap: Record<string, File[]>) => {
    onFilesSelected?.(
      Object.entries(newMap)
        .filter(([, fs]) => fs && fs.length > 0)
        .map(([docKey, fs]) => ({
          docName: allDocs.find((d) => d.key === docKey)?.label || docKey,
          docKey,
          files: fs!,
        })),
    );
  };

  const handleChange = (key: string, files: FileList | null) => {
    const fileArray = files ? Array.from(files) : [];

    const invalidType = fileArray.filter((f) => !isAllowedFile(f));
    const tooLarge = fileArray.filter((f) => f.size > MAX_FILE_SIZE);

    if (invalidType.length > 0) {
      toast.error('Solo se permiten archivos PDF, JPG o PNG');
    }
    if (tooLarge.length > 0) {
      toast.error(`Cada archivo debe ser menor a ${MAX_FILE_SIZE_MB} MB`);
    }

    const validFiles = fileArray.filter(
      (f) => isAllowedFile(f) && f.size <= MAX_FILE_SIZE,
    );

    const newMap = { ...selectedMap, [key]: validFiles };
    setSelectedMap(newMap);
    notifyParent(newMap);
  };

  const renderDocRow = (doc: DocConfig, isRequired: boolean) => {
    const hasFile = (selectedMap[doc.key]?.length ?? 0) > 0;
    const borderClass = isRequired
      ? hasFile
        ? 'border-green-300 bg-green-50'
        : 'border-red-300 bg-red-50'
      : hasFile
        ? 'border-green-300 bg-green-50'
        : '';

    return (
      <div
        key={doc.key}
        className={`flex items-center justify-between rounded border p-2 ${borderClass}`}
      >
        <input
          ref={(el) => {
            inputsRef.current[doc.key] = el;
          }}
          type="file"
          className="hidden"
          multiple={!!doc.multiple}
          accept={ACCEPT_STRING}
          onChange={(e) => handleChange(doc.key, e.target.files)}
        />
        <div className="flex items-center gap-2">
          {isRequired &&
            (hasFile ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            ))}
          <span className="text-sm">
            {doc.label}
            {selectedMap[doc.key]?.length
              ? ` — ${selectedMap[doc.key].length} archivo(s)`
              : ''}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleChoose(doc.key)}
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cargar Documentos</CardTitle>
        <CardDescription>
          Suba los documentos necesarios para el caso (PDF, JPG, PNG — max 10MB)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-semibold text-red-700">
              Documentos Obligatorios
            </Label>
            <div className="space-y-2">
              {mandatoryDocs.map((doc) => renderDocRow(doc, true))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Documentos Opcionales</Label>
            <div className="space-y-2">
              {optionalDocs.map((doc) => renderDocRow(doc, false))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
