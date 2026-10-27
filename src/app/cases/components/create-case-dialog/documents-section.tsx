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
  casePoderOtorgado,
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
  /**
   * Lista de la Sección XI. Hace falta además de `hasAttorney`: decide si el
   * documento "poder" es obligatorio (`casePoderOtorgado`, dentro de
   * `getRequiredDocuments`) — un apoderado puede estar identificado sin que
   * el poder ya esté otorgado, así que `hasAttorney` solo no alcanza.
   */
  apoderados?: Array<{
    nombreCompleto?: string;
    existePoderOtorgado?: boolean;
  }>;
  /**
   * Espejo legado de UN apoderado (el bloque "Apoderado Principal" que
   * ApoderadoSection sigue mostrando cuando `apoderados[]` está vacío).
   * `casePoderOtorgado` también lo reconoce — sin esto, marcar "poder
   * otorgado" en ese bloque nunca llegaba a esta pantalla.
   */
  apoderadoNombreCompleto?: string;
  existePoderOtorgado?: boolean;
  /**
   * Pinta en rojo los obligatorios que faltan. Regla de producto: los errores
   * se muestran solo después de una acción del usuario, así que al entrar a
   * la pestaña los obligatorios llevan una etiqueta neutra "Obligatorio" y el
   * rojo lo prende el wizard tras intentar "Crear Caso" o al salir de la
   * pestaña con documentos faltantes. En la edición de un caso no se exigen
   * documentos al guardar, así que ahí nunca se prende.
   */
  mostrarFaltantes?: boolean;
  /**
   * Archivos ya elegidos que guarda el wizard. La pestaña se desmonta al
   * salir de ella, así que sin esto la sección volvía vacía (y, con
   * `mostrarFaltantes`, marcaba como faltante un documento ya cargado).
   */
  seleccionActual?: Array<{ docKey: string; files: File[] }>;
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
  apoderados = [],
  apoderadoNombreCompleto,
  existePoderOtorgado,
  mostrarFaltantes = false,
  seleccionActual,
}: Readonly<DocumentsSectionProps>) {
  const caseDataPartial: Partial<CreateCaseFormInput> & {
    hasAttorney?: boolean;
  } = {
    applicantScope,
    assets: assets as CreateCaseFormInput['assets'],
    hasAttorney,
    apoderados: apoderados as CreateCaseFormInput['apoderados'],
    apoderadoNombreCompleto,
    existePoderOtorgado,
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

  const applicantScopeKey = JSON.stringify(applicantScope);
  const assetTypesKey = JSON.stringify(assets.map((a) => a.type));
  // Lo que decide "poder" en getRequiredDocuments: el nombre (si hay
  // apoderado) y existePoderOtorgado de cada uno — no el objeto completo,
  // que cambiaría de referencia en cada watch() sin que nada de esto haya
  // cambiado de verdad.
  const apoderadosKey = JSON.stringify(
    apoderados.map((a) => [a.nombreCompleto, a.existePoderOtorgado]),
  );

  const requiredIds = useMemo(
    () => getRequiredDocuments(caseDataPartial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      applicantScopeKey,
      assetTypesKey,
      hasAttorney,
      apoderadosKey,
      apoderadoNombreCompleto,
      existePoderOtorgado,
    ],
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
  const [seleccionInicial] = useState<Record<string, File[]>>(() =>
    Object.fromEntries(
      (seleccionActual ?? []).map(({ docKey, files }) => [docKey, files]),
    ),
  );
  const filesMapRef = useRef<Record<string, File[]>>(seleccionInicial);
  const [selectedMap, setSelectedMap] =
    useState<Record<string, File[]>>(seleccionInicial);

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
    const falta = isRequired && !hasFile && mostrarFaltantes;
    const borderClass = hasFile
      ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
      : falta
        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
        : '';

    return (
      <div
        key={doc.key}
        data-falta={falta || undefined}
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
          {isRequired && hasFile && (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
          )}
          {falta && (
            <AlertCircle
              aria-label="Falta este documento"
              className="h-4 w-4 flex-shrink-0 text-red-500"
            />
          )}
          <span className="text-sm">
            {doc.label}
            {selectedMap[doc.key]?.length
              ? ` — ${selectedMap[doc.key].length} archivo(s)`
              : ''}
          </span>
          {isRequired && !hasFile && !falta && (
            <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-xs">
              Obligatorio
            </span>
          )}
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
              {casePoderOtorgado(caseDataPartial)
                ? 'El caso tiene apoderado con poder otorgado. Se requieren el poder, la cédula del apoderado y su tarjeta profesional.'
                : 'El caso tiene apoderado. Se requieren la cédula del apoderado y su tarjeta profesional. El poder solo se exige cuando se marca "poder otorgado" en la Sección XI.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="font-semibold">Documentos Obligatorios</Label>
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
