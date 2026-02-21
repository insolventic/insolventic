'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const documentosAnexos = [
  {
    field: 'anexaSoporteIngresos' as const,
    label: 'Soporte de ingresos',
    description: 'Certificación laboral, declaración de renta o equivalente',
  },
  {
    field: 'anexaExtractosBancarios' as const,
    label: 'Extractos bancarios',
    description: 'Extractos de los últimos 3 meses',
  },
  {
    field: 'anexaCertificadosDeuda' as const,
    label: 'Certificados de deuda',
    description: 'Certificados emitidos por los acreedores',
  },
  {
    field: 'anexaCertificadoTradicion' as const,
    label: 'Certificado de tradición y libertad',
    description: 'Certificado de bienes inmuebles',
  },
  {
    field: 'anexaRelacionProcesos' as const,
    label: 'Relación de procesos judiciales',
    description: 'Certificado de la Rama Judicial',
  },
  {
    field: 'anexaDeclaracionRenta' as const,
    label: 'Declaración de renta',
    description: 'Última declaración de renta presentada',
  },
  {
    field: 'anexaDocumentoIdentidad' as const,
    label: 'Documento de identidad',
    description: 'Copia del documento de identidad del solicitante',
  },
];

export function DocumentosAnexosSection() {
  const { watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección X: Documentos Anexos
        </h3>
        <p className="text-sm text-muted-foreground">
          Indique los documentos que se anexan a la solicitud
        </p>
      </div>

      <div className="space-y-3">
        {documentosAnexos.map((doc) => (
          <div
            key={doc.field}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-0.5">
              <Label>{doc.label}</Label>
              <p className="text-sm text-muted-foreground">
                {doc.description}
              </p>
            </div>
            <Switch
              checked={watch(doc.field) || false}
              onCheckedChange={(checked) => setValue(doc.field, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
