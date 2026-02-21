'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function CesacionPagosSection() {
  const { register, watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección IV: Declaración de Cesación de Pagos
        </h3>
        <p className="text-sm text-muted-foreground">
          Información sobre la cesación de pagos del deudor
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label>Cesación de pagos</Label>
          <p className="text-sm text-muted-foreground">
            ¿El deudor se encuentra en cesación de pagos?
          </p>
        </div>
        <Switch
          checked={watch('cesacionPagos') || false}
          onCheckedChange={(checked) => setValue('cesacionPagos', checked)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Fecha de cesación de pagos</Label>
          <Input type="date" {...register('fechaCesacionPagos')} />
        </div>

        <div className="space-y-2">
          <Label>Número de acreedores actual</Label>
          <Input
            type="number"
            min={0}
            {...register('numeroAcreedoresActual', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label>Porcentaje de pasivo en mora (%)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            {...register('porcentajePasivoEnMora')}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Obligaciones en mora mayor a 90 días</Label>
            <p className="text-sm text-muted-foreground">
              ¿Tiene obligaciones con mora superior a 90 días?
            </p>
          </div>
          <Switch
            checked={watch('obligacionesEnMora90Dias') || false}
            onCheckedChange={(checked) =>
              setValue('obligacionesEnMora90Dias', checked)
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Procesos ejecutivos vigentes</Label>
            <p className="text-sm text-muted-foreground">
              ¿Existen procesos ejecutivos vigentes en su contra?
            </p>
          </div>
          <Switch
            checked={watch('procesosEjecutivosVigentes') || false}
            onCheckedChange={(checked) =>
              setValue('procesosEjecutivosVigentes', checked)
            }
          />
        </div>
      </div>
    </div>
  );
}
