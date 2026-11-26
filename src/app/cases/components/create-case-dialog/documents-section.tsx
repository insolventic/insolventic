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
import { errorDeTamanoDeArchivo, MAX_ARCHIVO_MB } from '@/lib/limite-archivos';
import { motivoContenidoInvalidoDeArchivo } from '@/lib/contenido-archivo';
import { Badge } from '@/components/ui/badge';
import {
  ID_PODER,
  PIEZAS_PODER,
  esPiezaPoder,
  estadoDelPoder,
  type DocumentoDelCaso,
  type PiezaPoder,
} from '@/features/case/poder';
import { registrarRechazoPorTamano } from '@/lib/rechazo-tamano';

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
  /**
   * Documentos ya subidos al caso (edición): las piezas del Poder ya cargadas
   * cuentan para su estado, y un anexo único anterior cuenta como "poder
   * firmado".
   */
  documentosCargados?: readonly DocumentoDelCaso[];
  /**
   * Fuerza el bloque del Poder aunque la sección no reciba los apoderados
   * (la edición lo calcula a partir del caso guardado).
   */
  poderRequerido?: boolean;
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
  documentosCargados = [],
  poderRequerido = false,
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

  // El Poder se carga en dos piezas (poder.ts): en lugar del anexo único
  // `poder`, dos zonas propias. Para crear el caso basta una; el bloque marca
  // "Completo" con las dos.
  const conPoder = poderRequerido || requiredIds.includes(ID_PODER);

  const mandatoryDocs: DocConfig[] = useMemo(() => {
    const allRequiredDocs = [...REQUIRED_DOCUMENTS, ...CONDITIONAL_DOCUMENTS];
    const docs: DocConfig[] = requiredIds
      .filter((id) => id !== ID_PODER)
      .map((id) => {
        const doc = allRequiredDocs.find((d) => d.id === id);
        return { key: id, label: doc?.name ?? id };
      });
    if (conPoder) {
      for (const pieza of PIEZAS_PODER) {
        docs.push({ key: pieza.id, label: pieza.nombre });
      }
    }

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
  }, [requiredIds, inmuebleCount, vehicleCount, conPoder]);

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

  const handleChange = async (key: string, files: FileList | null) => {
    const fileArray = files ? Array.from(files) : [];

    const invalidType = fileArray.filter((f) => !isAllowedFile(f));

    if (invalidType.length > 0) {
      toast.error('Solo se permiten archivos PDF, JPG o PNG');
    }
    for (const f of fileArray) {
      const errorDeTamano = errorDeTamanoDeArchivo(f.size);
      if (errorDeTamano) {
        registrarRechazoPorTamano('documento-caso', f);
        toast.error(`${f.name}: ${errorDeTamano}`);
      }
    }

    const candidatos = fileArray.filter(
      (f) => isAllowedFile(f) && !errorDeTamanoDeArchivo(f.size),
    );
    // Contenido real (cabecera del archivo): misma regla que el servidor.
    const motivos = await Promise.all(
      candidatos.map((f) => motivoContenidoInvalidoDeArchivo(f)),
    );
    motivos.forEach((m) => {
      if (m) toast.error(m);
    });
    const validFiles = candidatos.filter((_, i) => !motivos[i]);

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
          onChange={(e) => {
            const elegidos = e.target.files;
            void handleChange(doc.key, elegidos);
            // Vacío para que volver a elegir el mismo archivo, ya reducido,
            // dispare `change`.
            e.target.value = '';
          }}
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

  // --- Poder: dos piezas, cada una con su zona de carga y su estado ---
  const estadoCargado = estadoDelPoder(documentosCargados);
  const piezaLista = (pieza: PiezaPoder) =>
    (selectedMap[pieza.id]?.length ?? 0) > 0 ||
    (pieza.id === 'poder_captura_correo'
      ? estadoCargado.tieneCaptura
      : estadoCargado.tieneFirmado);
  const poderCompleto = PIEZAS_PODER.every(piezaLista);
  const poderConAlguna = PIEZAS_PODER.some(piezaLista);
  const poderFalta = mostrarFaltantes && !poderConAlguna;

  const renderPiezaPoder = (pieza: PiezaPoder) => {
    const elegidos = selectedMap[pieza.id] ?? [];
    const yaEnElCaso =
      pieza.id === 'poder_captura_correo'
        ? estadoCargado.capturaCorreo
        : [...estadoCargado.firmado, ...estadoCargado.firmadoAnterior];
    const lista = piezaLista(pieza);
    const idAyuda = `ayuda-${pieza.id}`;
    return (
      <div
        key={pieza.id}
        data-testid={`zona-${pieza.id}`}
        className={`space-y-2 rounded-lg border p-3 ${
          lista
            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
            : ''
        }`}
      >
        <input
          ref={(el) => {
            inputsRef.current[pieza.id] = el;
          }}
          type="file"
          className="hidden"
          accept={ACCEPT_STRING}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const archivos = e.target.files;
            void handleChange(pieza.id, archivos);
            e.target.value = '';
          }}
        />
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {lista ? (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400"
              />
            ) : (
              <Upload
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0"
              />
            )}
            <div>
              <p className="text-sm font-medium">{pieza.nombre}</p>
              <p className="text-muted-foreground text-xs" aria-live="polite">
                {elegidos.length > 0
                  ? `Listo para subir: ${elegidos.map((f) => f.name).join(', ')}`
                  : yaEnElCaso.length > 0
                    ? `Ya cargado en el caso: ${yaEnElCaso.map((d) => d.name).join(', ')}`
                    : 'Sin cargar'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleChoose(pieza.id)}
            aria-label={`Cargar ${pieza.nombre}`}
            aria-describedby={idAyuda}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p id={idAyuda} className="text-muted-foreground text-xs">
          {pieza.ayuda}
        </p>
      </div>
    );
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cargar Documentos</CardTitle>
        <CardDescription>
          Suba los documentos necesarios para el caso (PDF, JPG, PNG — máx.{' '}
          {MAX_ARCHIVO_MB} MB por archivo)
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
              {mandatoryDocs
                .filter((doc) => !esPiezaPoder(doc.key))
                .map((doc) => renderDocRow(doc, true))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Documentos Opcionales</Label>
            <div className="space-y-2">
              {optionalDocs.map((doc) => renderDocRow(doc, false))}
            </div>
          </div>
        </div>
        {conPoder && (
          <section
            aria-labelledby="titulo-poder"
            data-falta={poderFalta || undefined}
            className={`space-y-3 rounded-lg border p-3 ${
              poderFalta
                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
                : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 id="titulo-poder" className="text-sm font-semibold">
                Poder
              </h4>
              <Badge
                data-testid="estado-poder"
                variant={poderCompleto ? 'default' : 'secondary'}
                className={
                  poderCompleto
                    ? 'bg-green-600 text-white hover:bg-green-600'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100'
                }
              >
                {poderCompleto ? 'Completo' : 'Incompleto'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Se compone de dos archivos. Para crear el caso basta con uno; el
              poder queda completo cuando están los dos.
            </p>
            {estadoCargado.firmadoAnterior.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Este caso tiene un poder cargado como anexo único (formato
                anterior); cuenta como poder firmado.
              </p>
            )}
            {poderFalta && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle
                  aria-label="Falta este documento"
                  className="h-4 w-4 flex-shrink-0"
                />
                Cargue al menos una de las dos piezas del poder.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {PIEZAS_PODER.map(renderPiezaPoder)}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
