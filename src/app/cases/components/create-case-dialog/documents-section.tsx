'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Car,
  Home,
  FileWarning,
} from 'lucide-react';

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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  assets?: Array<{ type?: string; name?: string }>;
  hasAttorney?: boolean;
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
  assets = [],
  hasAttorney = false,
}: Readonly<DocumentsSectionProps>) {
  const caseDataPartial: Partial<CreateCaseFormInput> & {
    hasAttorney?: boolean;
  } = {
    applicantScope,
    assets: assets as CreateCaseFormInput['assets'],
    hasAttorney,
  };

  const noAssets = assets.length === 0;

  // Count asset types for dynamic alerts
  const vehicleCount = useMemo(
    () => assets.filter((a) => a.type === 'VEHICULO').length,
    [assets],
  );
  const inmuebleCount = useMemo(
    () =>
      assets.filter((a) => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE')
        .length,
    [assets],
  );

  const requiredIds = useMemo(
    () => getRequiredDocuments(caseDataPartial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(applicantScope), JSON.stringify(assets.map((a) => a.type))],
  );

  const mandatoryDocs: DocConfig[] = useMemo(() => {
    const allRequiredDocs = [...REQUIRED_DOCUMENTS, ...CONDITIONAL_DOCUMENTS];
    const docs = requiredIds.map((id) => {
      const doc = allRequiredDocs.find((d) => d.id === id);
      return { key: id, label: doc?.name ?? id };
    });

    // Add dynamic per-asset docs
    if (inmuebleCount > 1) {
      for (let i = 1; i < inmuebleCount; i++) {
        docs.push({
          key: `tradicion_libertad_${i + 1}`,
          label: `Certificado de tradición y libertad — Inmueble #${i + 1}`,
        });
      }
    }
    if (vehicleCount > 1) {
      for (let i = 1; i < vehicleCount; i++) {
        docs.push({
          key: `tarjeta_propiedad_${i + 1}`,
          label: `Tarjeta de propiedad — Vehículo #${i + 1}`,
        });
      }
    }

    return docs;
  }, [requiredIds, inmuebleCount, vehicleCount]);

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
  // Use ref-backed state to persist files across tab switches
  const filesMapRef = useRef<Record<string, File[]>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, File[]>>({});

  const allDocs = [...mandatoryDocs, ...optionalDocs];

  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleChoose = (key: string) => {
    inputsRef.current[key]?.click();
  };

  const notifyParent = useCallback(
    (newMap: Record<string, File[]>) => {
      onFilesSelected?.(
        Object.entries(newMap)
          .filter(([, fs]) => fs && fs.length > 0)
          .map(([docKey, fs]) => ({
            docName: allDocs.find((d) => d.key === docKey)?.label || docKey,
            docKey,
            files: fs!,
          })),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allDocs.length],
  );

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

    const newMap = { ...filesMapRef.current, [key]: validFiles };
    filesMapRef.current = newMap;
    setSelectedMap({ ...newMap });
    notifyParent(newMap);
  };

  const renderDocRow = (doc: DocConfig, isRequired: boolean) => {
    const hasFile = (selectedMap[doc.key]?.length ?? 0) > 0;
    const borderClass = isRequired
      ? hasFile
        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
        : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
      : hasFile
        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
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
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
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
      <CardContent className="space-y-4">
        {/* Dynamic context alerts */}
        {noAssets && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
              No se han registrado bienes en la Página 4. Si el deudor posee
              bienes, regrese y agréguelos para que se generen los documentos
              condicionales correspondientes.
            </AlertDescription>
          </Alert>
        )}

        {inmuebleCount > 0 && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <Home className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
              Se registraron <strong>{inmuebleCount} inmueble(s)</strong>. Se
              requiere un certificado de tradición y libertad por cada uno.
            </AlertDescription>
          </Alert>
        )}

        {vehicleCount > 0 && (
          <Alert className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
            <Car className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-sm text-purple-800 dark:text-purple-200">
              Se registraron <strong>{vehicleCount} vehículo(s)</strong>. Se
              requiere tarjeta de propiedad por cada uno.
            </AlertDescription>
          </Alert>
        )}

        {hasAttorney && (
          <Alert className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950">
            <FileWarning className="h-4 w-4 text-indigo-600" />
            <AlertDescription className="text-sm text-indigo-800 dark:text-indigo-200">
              El caso tiene apoderado. Se requieren el poder otorgado, la cédula
              del apoderado y su tarjeta profesional.
            </AlertDescription>
          </Alert>
        )}

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
