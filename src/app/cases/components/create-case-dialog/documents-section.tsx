'use client';

import { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

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

interface DocumentsSectionProps {
  onFilesSelected?: (
    selections: Array<{ docName: string; files: File[] }>,
  ) => void;
}

type DocConfig = { key: string; label: string; multiple?: boolean };

export function DocumentsSection({
  onFilesSelected,
}: Readonly<DocumentsSectionProps>) {
  const mandatoryDocs: DocConfig[] = useMemo(
    () => [
      { key: 'cedula', label: 'Cédula de ciudadanía' },
      { key: 'redam', label: 'Certificado REDAM' },
      { key: 'cert_ingresos', label: 'Certificado de ingresos' },
      { key: 'extractos', label: 'Extractos bancarios', multiple: true },
      { key: 'relacion_acreedores', label: 'Relación de acreedores' },
    ],
    [],
  );

  const optionalDocs: DocConfig[] = useMemo(
    () => [
      {
        key: 'tradicion_libertad',
        label: 'Certificado de tradición y libertad',
        multiple: true,
      },
      { key: 'matricula', label: 'Constancia matrícula mercantil' },
      { key: 'poder', label: 'Poder notariado' },
      { key: 'gastos_manutencion', label: 'Gastos de manutención' },
      {
        key: 'procesos_judiciales',
        label: 'Procesos judiciales',
        multiple: true,
      },
    ],
    [],
  );

  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, File[]>>({});

  const allDocs = [...mandatoryDocs, ...optionalDocs];

  const MAX_FILE_SIZE_MB = 10; // tamaño razonable por archivo
  const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleChoose = (key: string) => {
    inputsRef.current[key]?.click();
  };

  const handleChange = (key: string, files: FileList | null) => {
    const fileArray = files ? Array.from(files) : [];

    const invalidType = fileArray.filter(
      (f) =>
        !(
          f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        ),
    );
    const tooLarge = fileArray.filter((f) => f.size > MAX_FILE_SIZE);

    if (invalidType.length > 0) {
      toast.error('Solo se permiten archivos PDF');
    }
    if (tooLarge.length > 0) {
      toast.error(`Cada archivo debe ser menor a ${MAX_FILE_SIZE_MB} MB`);
    }

    const validFiles = fileArray.filter(
      (f) =>
        (f.type === 'application/pdf' ||
          f.name.toLowerCase().endsWith('.pdf')) &&
        f.size <= MAX_FILE_SIZE,
    );

    const newMap = { ...selectedMap, [key]: validFiles };
    setSelectedMap(newMap);
    onFilesSelected?.(
      Object.entries(newMap)
        .filter(([, fs]) => fs && fs.length > 0)
        .map(([docKey, fs]) => ({
          docName: allDocs.find((d) => d.key === docKey)?.label || docKey,
          files: fs!,
        })),
    );
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cargar Documentos</CardTitle>
        <CardDescription>
          Suba los documentos necesarios para el caso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Documentos Obligatorios</Label>
            <div className="space-y-2">
              {mandatoryDocs.map((doc) => (
                <div
                  key={doc.key}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <input
                    ref={(el) => {
                      inputsRef.current[doc.key] = el;
                    }}
                    type="file"
                    className="hidden"
                    multiple={!!doc.multiple}
                    accept="application/pdf,.pdf"
                    onChange={(e) => handleChange(doc.key, e.target.files)}
                  />
                  <span className="text-sm">
                    {doc.label}
                    {selectedMap[doc.key]?.length
                      ? ` — ${selectedMap[doc.key].length} archivo(s)`
                      : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChoose(doc.key)}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Documentos Opcionales</Label>
            <div className="space-y-2">
              {optionalDocs.map((doc) => (
                <div
                  key={doc.key}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <input
                    ref={(el) => {
                      inputsRef.current[doc.key] = el;
                    }}
                    type="file"
                    className="hidden"
                    multiple={!!doc.multiple}
                    accept="application/pdf,.pdf"
                    onChange={(e) => handleChange(doc.key, e.target.files)}
                  />
                  <span className="text-sm">
                    {doc.label}
                    {selectedMap[doc.key]?.length
                      ? ` — ${selectedMap[doc.key].length} archivo(s)`
                      : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChoose(doc.key)}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
