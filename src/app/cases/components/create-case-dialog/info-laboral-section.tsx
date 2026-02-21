'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function InfoLaboralSection() {
  const { register, watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección III: Información Laboral y Económica
        </h3>
        <p className="text-sm text-muted-foreground">
          Datos laborales, de ingresos y gastos del deudor
        </p>
      </div>

      {/* Información laboral */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Información laboral
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Ocupación</Label>
            <Input
              placeholder="Ej: Empleado, Independiente"
              {...register('deudorOcupacion')}
            />
          </div>

          <div className="space-y-2">
            <Label>Profesión</Label>
            <Input
              placeholder="Ej: Ingeniero, Abogado"
              {...register('deudorProfesion')}
            />
          </div>

          <div className="space-y-2">
            <Label>Actividad económica</Label>
            <Input
              placeholder="Ej: Comercio, Servicios"
              {...register('deudorActividadEconomica')}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de vinculación</Label>
            <Select
              value={watch('deudorTipoVinculacion') || ''}
              onValueChange={(value) =>
                setValue('deudorTipoVinculacion', value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Empleado">Empleado</SelectItem>
                <SelectItem value="Independiente">Independiente</SelectItem>
                <SelectItem value="Contratista">Contratista</SelectItem>
                <SelectItem value="Pensionado">Pensionado</SelectItem>
                <SelectItem value="Desempleado">Desempleado</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre del empleador</Label>
            <Input
              placeholder="Razón social del empleador"
              {...register('deudorNombreEmpleador')}
            />
          </div>

          <div className="space-y-2">
            <Label>NIT del empleador</Label>
            <Input
              placeholder="Ej: 900123456-1"
              {...register('deudorNitEmpleador')}
            />
          </div>
        </div>
      </div>

      {/* Ingresos */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Ingresos mensuales
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Ingreso principal mensual</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('ingresoPrincipalMensual')}
            />
          </div>

          <div className="space-y-2">
            <Label>Otros ingresos mensuales</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('otrosIngresosMensuales')}
            />
          </div>

          <div className="space-y-2">
            <Label>Total ingresos mensuales</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('totalIngresosMensuales')}
            />
          </div>

          <div className="space-y-2">
            <Label>Ingresos variables (promedio)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('ingresosVariablesPromedio')}
            />
          </div>

          <div className="space-y-2">
            <Label>Ingresos no operacionales</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('ingresosNoOperacionales')}
            />
          </div>
        </div>
      </div>

      {/* Gastos */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Gastos mensuales
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Vivienda</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosVivienda')}
            />
          </div>

          <div className="space-y-2">
            <Label>Alimentación</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosAlimentacion')}
            />
          </div>

          <div className="space-y-2">
            <Label>Servicios públicos</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosServiciosPublicos')}
            />
          </div>

          <div className="space-y-2">
            <Label>Transporte</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosTransporte')}
            />
          </div>

          <div className="space-y-2">
            <Label>Educación</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosEducacion')}
            />
          </div>

          <div className="space-y-2">
            <Label>Salud</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('gastosSalud')}
            />
          </div>

          <div className="space-y-2">
            <Label>Otros gastos</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('otrosGastos')}
            />
          </div>

          <div className="space-y-2">
            <Label>Total gastos mensuales</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('totalGastosMensuales')}
            />
          </div>
        </div>
      </div>

      {/* Capacidad económica */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          Capacidad económica
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Capacidad de pago estimada</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('capacidadPagoEstimada')}
            />
          </div>

          <div className="space-y-2">
            <Label>Patrimonio total estimado</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('patrimonioTotalEstimado')}
            />
          </div>

          <div className="space-y-2">
            <Label>Pasivo total estimado</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="$0"
              {...register('pasivoTotalEstimado')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
