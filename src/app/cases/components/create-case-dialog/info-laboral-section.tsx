'use client';

import { useFormContext, useWatch, useFieldArray } from 'react-hook-form';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CreateCaseFormInput,
  DependentData,
} from '@/features/case/schemas';
import { ServiciosManutencionSection } from './servicios-manutencion-section';
import { MoneyInput } from '@/components/ui/money-input';

export function InfoLaboralSection() {
  const { register, watch, setValue, control } =
    useFormContext<CreateCaseFormInput>();

  // Watch income fields for auto-calculation
  const ingresoPrincipal =
    useWatch({ control, name: 'ingresoPrincipalMensual' }) || 0;
  const otrosIngresos =
    useWatch({ control, name: 'otrosIngresosMensuales' }) || 0;
  const ingresosVariables =
    useWatch({ control, name: 'ingresosVariablesPromedio' }) || 0;
  const ingresosNoOp =
    useWatch({ control, name: 'ingresosNoOperacionales' }) || 0;

  // Watch expense fields for auto-calculation
  const gastosVivienda = useWatch({ control, name: 'gastosVivienda' }) || 0;
  const gastosAlimentacion =
    useWatch({ control, name: 'gastosAlimentacion' }) || 0;
  const gastosServicios =
    useWatch({ control, name: 'gastosServiciosPublicos' }) || 0;
  const gastosTransporte = useWatch({ control, name: 'gastosTransporte' }) || 0;
  const gastosEducacion = useWatch({ control, name: 'gastosEducacion' }) || 0;
  const gastosSalud = useWatch({ control, name: 'gastosSalud' }) || 0;
  const otrosGastos = useWatch({ control, name: 'otrosGastos' }) || 0;

  // Auto-calculated totals
  const totalIngresos = useMemo(
    () =>
      Number(ingresoPrincipal) +
      Number(otrosIngresos) +
      Number(ingresosVariables) +
      Number(ingresosNoOp),
    [ingresoPrincipal, otrosIngresos, ingresosVariables, ingresosNoOp],
  );

  const totalGastos = useMemo(
    () =>
      Number(gastosVivienda) +
      Number(gastosAlimentacion) +
      Number(gastosServicios) +
      Number(gastosTransporte) +
      Number(gastosEducacion) +
      Number(gastosSalud) +
      Number(otrosGastos),
    [
      gastosVivienda,
      gastosAlimentacion,
      gastosServicios,
      gastosTransporte,
      gastosEducacion,
      gastosSalud,
      otrosGastos,
    ],
  );

  const disponible = useMemo(
    () => totalIngresos - totalGastos,
    [totalIngresos, totalGastos],
  );

  // Dependents (Obligaciones Alimentarias)
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'dependents',
  });

  const addDependent = () => {
    append({ name: '', age: 0, relationship: '' } as DependentData);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección III: Información Laboral y Económica
        </h3>
        <p className="text-muted-foreground text-sm">
          Datos laborales, de ingresos y gastos del deudor
        </p>
      </div>

      {/* Información laboral */}
      <div>
        <h4 className="text-muted-foreground mb-3 text-sm font-medium">
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
        <h4 className="text-muted-foreground mb-3 text-sm font-medium">
          Ingresos mensuales
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Ingreso principal mensual</Label>
            <MoneyInput name="ingresoPrincipalMensual" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Otros ingresos mensuales</Label>
            <MoneyInput name="otrosIngresosMensuales" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Ingresos variables (promedio)</Label>
            <MoneyInput name="ingresosVariablesPromedio" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Ingresos no operacionales</Label>
            <MoneyInput name="ingresosNoOperacionales" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Total ingresos mensuales</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted font-semibold"
              value={formatCurrency(totalIngresos)}
            />
          </div>
        </div>
      </div>

      {/* Gastos */}
      <div>
        <h4 className="text-muted-foreground mb-3 text-sm font-medium">
          Gastos mensuales
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Vivienda</Label>
            <MoneyInput name="gastosVivienda" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Alimentación</Label>
            <MoneyInput name="gastosAlimentacion" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Servicios públicos</Label>
            <MoneyInput name="gastosServiciosPublicos" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Transporte</Label>
            <MoneyInput name="gastosTransporte" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Educación</Label>
            <MoneyInput name="gastosEducacion" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Salud</Label>
            <MoneyInput name="gastosSalud" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label>Otros gastos</Label>
            <MoneyInput name="otrosGastos" placeholder="$0" />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Total gastos mensuales</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted font-semibold"
              value={formatCurrency(totalGastos)}
            />
          </div>
        </div>
      </div>

      {/* Desglose de servicios de manutención (dato interno del operador) */}
      <ServiciosManutencionSection />

      {/* Recursos disponibles */}
      <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950">
        <h4 className="mb-3 text-sm font-semibold">Recursos disponibles</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Ingresos</Label>
            <p className="text-sm font-medium">
              {formatCurrency(totalIngresos)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gastos</Label>
            <p className="text-sm font-medium">{formatCurrency(totalGastos)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Disponible</Label>
            <p
              className={`text-sm font-bold ${disponible < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {formatCurrency(disponible)}
            </p>
          </div>
        </div>
      </div>

      {/* Obligaciones Alimentarias (moved from page 5) */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-muted-foreground text-sm font-medium">
              Obligaciones alimentarias
            </h4>
            <p className="text-muted-foreground text-xs">
              Personas que dependen económicamente del deudor
            </p>
          </div>
          <Button type="button" onClick={addDependent} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Beneficiario
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            No hay beneficiarios. Haga clic en el botón para agregar.
          </p>
        )}

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="bg-muted/50 mt-3 space-y-4 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Beneficiario #{index + 1}</h4>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`dependents.${index}.name`}>Nombre</Label>
                <Input
                  id={`dependents.${index}.name`}
                  {...register(`dependents.${index}.name`)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`dependents.${index}.age`}>Edad</Label>
                <Input
                  id={`dependents.${index}.age`}
                  type="number"
                  {...register(`dependents.${index}.age`, {
                    valueAsNumber: true,
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`dependents.${index}.relationship`}>
                  Parentesco
                </Label>
                <Input
                  id={`dependents.${index}.relationship`}
                  {...register(`dependents.${index}.relationship`)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
