'use client';

import { memo, useCallback } from 'react';
import { useFormContext, useFieldArray, useWatch } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const BIEN_TIPOS = [
  { value: 'Inmueble', label: 'Inmueble' },
  { value: 'Vehiculo', label: 'Vehiculo' },
  { value: 'Cuenta bancaria', label: 'Cuenta bancaria' },
  { value: 'Inversion', label: 'Inversion' },
  { value: 'Mueble', label: 'Mueble' },
  { value: 'Otro', label: 'Otro' },
] as const;

/**
 * BienItem - Memoized component for each bien entry.
 *
 * Uses useWatch inside the child component so only this item
 * re-renders when its bienTipo changes, avoiding "Maximum update
 * depth exceeded" errors in the parent.
 */
interface BienItemProps {
  index: number;
  onRemove: (index: number) => void;
}

const BienItem = memo(function BienItem({ index, onRemove }: BienItemProps) {
  const { register, setValue, watch } = useFormContext<CreateCaseFormInput>();

  const bienTipo = useWatch<CreateCaseFormInput>({
    name: `bienes.${index}.bienTipo` as const,
  });

  const bienGravamenes = useWatch<CreateCaseFormInput>({
    name: `bienes.${index}.bienGravamenes` as const,
  });

  const bienDescripcion = watch(`bienes.${index}.bienDescripcion` as const);

  const showMatricula = bienTipo === 'Inmueble';
  const showPlaca = bienTipo === 'Vehiculo';
  const showEntidadFinanciera =
    bienTipo === 'Cuenta bancaria' || bienTipo === 'Inversion';

  return (
    <div className="space-y-6 rounded-lg border bg-slate-50 p-6">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-purple-700">
          Bien #{index + 1}
          {bienTipo ? ` - ${bienTipo}` : ''}
          {bienDescripcion ? `: ${bienDescripcion}` : ''}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 6.1 Identificacion del Bien */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
          6.1 Identificacion del Bien
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienTipo`}>
              Tipo de Bien <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch(`bienes.${index}.bienTipo` as const) || ''}
              onValueChange={(value) =>
                setValue(`bienes.${index}.bienTipo` as const, value)
              }
            >
              <SelectTrigger id={`bienes.${index}.bienTipo`}>
                <SelectValue placeholder="Seleccione tipo de bien" />
              </SelectTrigger>
              <SelectContent>
                {BIEN_TIPOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienDescripcion`}>
              Descripcion
            </Label>
            <Input
              id={`bienes.${index}.bienDescripcion`}
              placeholder="Descripcion del bien"
              {...register(`bienes.${index}.bienDescripcion` as const)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienUbicacion`}>
              Ubicacion
            </Label>
            <Input
              id={`bienes.${index}.bienUbicacion`}
              placeholder="Direccion o ubicacion"
              {...register(`bienes.${index}.bienUbicacion` as const)}
            />
          </div>

          {showMatricula && (
            <div className="space-y-2">
              <Label htmlFor={`bienes.${index}.bienMatriculaInmobiliaria`}>
                Matricula Inmobiliaria
              </Label>
              <Input
                id={`bienes.${index}.bienMatriculaInmobiliaria`}
                placeholder="No. de matricula"
                {...register(
                  `bienes.${index}.bienMatriculaInmobiliaria` as const,
                )}
              />
            </div>
          )}

          {showPlaca && (
            <div className="space-y-2">
              <Label htmlFor={`bienes.${index}.bienPlaca`}>Placa</Label>
              <Input
                id={`bienes.${index}.bienPlaca`}
                placeholder="ABC123"
                {...register(`bienes.${index}.bienPlaca` as const)}
              />
            </div>
          )}

          {showEntidadFinanciera && (
            <div className="space-y-2">
              <Label htmlFor={`bienes.${index}.bienEntidadFinanciera`}>
                Entidad Financiera
              </Label>
              <Input
                id={`bienes.${index}.bienEntidadFinanciera`}
                placeholder="Nombre de la entidad"
                {...register(
                  `bienes.${index}.bienEntidadFinanciera` as const,
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* 6.2 Valoracion */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
          6.2 Valoracion
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienValorComercial`}>
              Valor Comercial ($)
            </Label>
            <Input
              id={`bienes.${index}.bienValorComercial`}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register(`bienes.${index}.bienValorComercial` as const)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienValorCatastral`}>
              Valor Catastral ($)
            </Label>
            <Input
              id={`bienes.${index}.bienValorCatastral`}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register(`bienes.${index}.bienValorCatastral` as const)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.bienValorLibros`}>
              Valor en Libros ($)
            </Label>
            <Input
              id={`bienes.${index}.bienValorLibros`}
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register(`bienes.${index}.bienValorLibros` as const)}
            />
          </div>
        </div>
      </div>

      {/* 6.3 Situacion Juridica */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium text-gray-700">
          6.3 Situacion Juridica
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border bg-white p-3">
            <Label
              htmlFor={`bienes.${index}.bienGravamenes`}
              className="cursor-pointer font-normal"
            >
              Tiene gravamenes
            </Label>
            <Switch
              id={`bienes.${index}.bienGravamenes`}
              checked={!!watch(`bienes.${index}.bienGravamenes` as const)}
              onCheckedChange={(checked) =>
                setValue(`bienes.${index}.bienGravamenes` as const, checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-white p-3">
            <Label
              htmlFor={`bienes.${index}.bienEmbargado`}
              className="cursor-pointer font-normal"
            >
              Embargado
            </Label>
            <Switch
              id={`bienes.${index}.bienEmbargado`}
              checked={!!watch(`bienes.${index}.bienEmbargado` as const)}
              onCheckedChange={(checked) =>
                setValue(`bienes.${index}.bienEmbargado` as const, checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-white p-3">
            <Label
              htmlFor={`bienes.${index}.bienAfectadoViviendaFamiliar`}
              className="cursor-pointer font-normal"
            >
              Afectado a vivienda familiar
            </Label>
            <Switch
              id={`bienes.${index}.bienAfectadoViviendaFamiliar`}
              checked={
                !!watch(
                  `bienes.${index}.bienAfectadoViviendaFamiliar` as const,
                )
              }
              onCheckedChange={(checked) =>
                setValue(
                  `bienes.${index}.bienAfectadoViviendaFamiliar` as const,
                  checked,
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border bg-white p-3">
            <Label
              htmlFor={`bienes.${index}.bienEnLeasing`}
              className="cursor-pointer font-normal"
            >
              En leasing
            </Label>
            <Switch
              id={`bienes.${index}.bienEnLeasing`}
              checked={!!watch(`bienes.${index}.bienEnLeasing` as const)}
              onCheckedChange={(checked) =>
                setValue(`bienes.${index}.bienEnLeasing` as const, checked)
              }
            />
          </div>
        </div>

        {bienGravamenes && (
          <div className="space-y-2">
            <Label htmlFor={`bienes.${index}.descripcionGravamen`}>
              Descripcion del Gravamen
            </Label>
            <Input
              id={`bienes.${index}.descripcionGravamen`}
              placeholder="Describa el gravamen (hipoteca, prenda, etc.)"
              {...register(`bienes.${index}.descripcionGravamen` as const)}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export function BienesSection() {
  const form = useFormContext<CreateCaseFormInput>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'bienes',
  });

  const addBien = useCallback(() => {
    append({
      bienTipo: '',
      bienDescripcion: '',
      bienUbicacion: '',
      bienMatriculaInmobiliaria: '',
      bienPlaca: '',
      bienEntidadFinanciera: '',
      bienValorComercial: '',
      bienValorCatastral: '',
      bienValorLibros: '',
      bienGravamenes: false,
      descripcionGravamen: '',
      bienEmbargado: false,
      bienAfectadoViviendaFamiliar: false,
      bienEnLeasing: false,
    });
  }, [append]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">
            Seccion VI: Inventario Detallado de Bienes
          </h3>
          <p className="text-muted-foreground text-sm">
            Registre cada uno de los bienes del deudor con su valoracion y
            situacion juridica
          </p>
        </div>
        <Button type="button" onClick={addBien} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Bien
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <p className="mb-2">No hay bienes registrados</p>
          <p className="text-sm">
            Use el boton para agregar bienes al inventario del deudor
          </p>
        </div>
      )}

      {fields.map((field, index) => (
        <BienItem key={field.id} index={index} onRemove={remove} />
      ))}

      {fields.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBien}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Bien
        </Button>
      )}
    </div>
  );
}
