'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale } from 'lucide-react';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const declaraciones = [
  {
    field: 'declaracionVeracidadInformacion' as const,
    label: 'Veracidad de la información',
    description:
      'Declaro bajo la gravedad del juramento que la información suministrada es veraz y completa.',
  },
  {
    field: 'manifestacionBuenaFe' as const,
    label: 'Buena fe',
    description:
      'Manifiesto que actúo de buena fe y que no pretendo defraudar a mis acreedores.',
  },
  {
    field: 'manifestacionNoOcultamientoBienes' as const,
    label: 'No ocultamiento de bienes',
    description:
      'Manifiesto que no he ocultado, distraído ni disipado bienes, ni he realizado actos en perjuicio de mis acreedores.',
  },
  {
    field: 'autorizacionNotificacionesCorreo' as const,
    label: 'Notificaciones por correo electrónico',
    description:
      'Autorizo que las notificaciones del procedimiento se realicen por correo electrónico.',
  },
  {
    field: 'autorizacionConsultaCentralesRiesgo' as const,
    label: 'Consulta en centrales de riesgo',
    description:
      'Autorizo la consulta de mi información en las centrales de riesgo crediticio.',
  },
  {
    field: 'autorizacionTratamientoDatos' as const,
    label: 'Tratamiento de datos personales',
    description:
      'Autorizo el tratamiento de mis datos personales conforme a la política de privacidad.',
  },
];

export function DeclaracionesSection() {
  const { watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección VIII: Declaraciones del Deudor
        </h3>
        <p className="text-muted-foreground text-sm">
          Declaraciones y autorizaciones requeridas por el deudor
        </p>
      </div>

      {/* Marco normativo */}
      <Alert className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950">
        <Scale className="h-4 w-4 text-indigo-600" />
        <AlertDescription className="text-sm text-indigo-800 dark:text-indigo-200">
          <strong>Marco Normativo Aplicable:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <strong>Ley 1564 de 2012</strong> — Código General del Proceso,
              Título IV: Insolvencia de la Persona Natural No Comerciante (Arts.
              531-576).
            </li>
            <li>
              <strong>Ley 2445 de 2025</strong> — Modificaciones al régimen de
              insolvencia de persona natural.
            </li>
            <li>
              <strong>Decreto 2677 de 2012</strong> — Reglamentación del
              procedimiento de negociación de deudas ante centros de
              conciliación.
            </li>
            <li>
              <strong>Decreto 1069 de 2015</strong> — Decreto Único
              Reglamentario del Sector Justicia y del Derecho (Parte 2, Título
              4).
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Declaración de veracidad */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
          <strong>DECLARACI&Oacute;N DE VERACIDAD:</strong> El solicitante
          declara bajo la gravedad del juramento que toda la información
          consignada en esta solicitud y sus anexos es veraz, completa y
          fidedigna. Cualquier omisión o falsedad en los datos suministrados
          podrá dar lugar a la terminación del procedimiento y a las sanciones
          legales correspondientes, conforme al artículo 564 del Código General
          del Proceso.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {declaraciones.map((decl) => (
          <div
            key={decl.field}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-medium">{decl.label}</Label>
              <p className="text-muted-foreground text-sm">
                {decl.description}
              </p>
            </div>
            <Switch
              checked={watch(decl.field) || false}
              onCheckedChange={(checked) => setValue(decl.field, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
