'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function PropuestaInicialSection() {
  const { register, watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección IX: Propuesta Inicial de Pago
        </h3>
        <p className="text-sm text-muted-foreground">
          Condiciones generales de la propuesta de pago a los acreedores
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Plazo propuesto (meses)</Label>
          <Input
            type="number"
            min={1}
            placeholder="Ej: 60"
            {...register('propuestaPlazoMeses', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label>Periodicidad de pago</Label>
          <Select
            value={watch('propuestaPeriodicidadPago') || ''}
            onValueChange={(value) =>
              setValue('propuestaPeriodicidadPago', value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione periodicidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mensual">Mensual</SelectItem>
              <SelectItem value="Bimestral">Bimestral</SelectItem>
              <SelectItem value="Trimestral">Trimestral</SelectItem>
              <SelectItem value="Semestral">Semestral</SelectItem>
              <SelectItem value="Anual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tasa de interés propuesta (%)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Ej: 1.5"
            {...register('propuestaTasaInteres')}
          />
        </div>

        <div className="space-y-2">
          <Label>Quita promedio propuesta (%)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            placeholder="Ej: 30"
            {...register('propuestaQuitaPromedio')}
          />
        </div>

        <div className="space-y-2">
          <Label>Fecha de inicio de pagos</Label>
          <Input type="date" {...register('propuestaFechaInicioPago')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observaciones de la propuesta</Label>
        <Textarea
          placeholder="Detalle adicional sobre la propuesta de pago..."
          rows={3}
          {...register('propuestaObservaciones')}
        />
      </div>
    </div>
  );
}
