'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
        <p className="text-sm text-muted-foreground">
          Declaraciones y autorizaciones requeridas por el deudor
        </p>
      </div>

      <div className="space-y-3">
        {declaraciones.map((decl) => (
          <div
            key={decl.field}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-medium">{decl.label}</Label>
              <p className="text-sm text-muted-foreground">
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
