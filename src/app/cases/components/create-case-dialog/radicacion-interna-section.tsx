'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function RadicacionInternaSection() {
  const { register } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección XII: Datos de Radicación Interna
        </h3>
        <p className="text-sm text-muted-foreground">
          Información interna del expediente y radicación
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Número de expediente</Label>
          <Input
            placeholder="Ej: EXP-2025-001"
            {...register('expedienteNumero')}
          />
        </div>

        <div className="space-y-2">
          <Label>Año del expediente</Label>
          <Input
            type="number"
            placeholder="Ej: 2025"
            {...register('expedienteAnio', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label>Fecha de radicación interna</Label>
          <Input type="date" {...register('fechaRadicacion')} />
        </div>

        <div className="space-y-2">
          <Label>Centro de conciliación</Label>
          <Input
            placeholder="Nombre del centro de conciliación"
            {...register('centroConciliacionNombre')}
          />
        </div>

        <div className="space-y-2">
          <Label>Conciliador asignado</Label>
          <Input
            placeholder="Nombre del conciliador"
            {...register('conciliadorAsignado')}
          />
        </div>

        <div className="space-y-2">
          <Label>Ciudad de radicación</Label>
          <Input
            placeholder="Ej: Bogotá"
            {...register('ciudadRadicacion')}
          />
        </div>
      </div>
    </div>
  );
}
