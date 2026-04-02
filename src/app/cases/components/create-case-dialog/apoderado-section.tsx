'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function ApoderadoSection() {
  const { register, watch, setValue, control } =
    useFormContext<CreateCaseFormInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'apoderados',
  });

  const addApoderado = () => {
    append({
      nombreCompleto: '',
      tipoIdentificacion: 'CC',
      identificacion: '',
      tarjetaProfesional: '',
      direccion: '',
      telefono: '',
      correo: '',
      existePoderOtorgado: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección XI: Información del Apoderado
        </h3>
        <p className="text-muted-foreground text-sm">
          Datos del apoderado o representante legal del deudor
        </p>
      </div>

      {/* Legacy single apoderado fields (backward compat) */}
      {fields.length === 0 && !watch('apoderadoNombreCompleto') && (
        <div className="text-muted-foreground py-4 text-center">
          <p className="mb-2">No hay apoderados registrados</p>
          <p className="text-sm">Use el botón para agregar un apoderado</p>
        </div>
      )}

      {/* Legacy: Show existing single apoderado if present */}
      {fields.length === 0 && watch('apoderadoNombreCompleto') && (
        <div className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900">
          <h4 className="text-base font-semibold text-purple-700 dark:text-purple-400">
            Apoderado Principal
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Nombre completo"
                {...register('apoderadoNombreCompleto')}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de identificación</Label>
              <Select
                value={watch('apoderadoTipoIdentificacion') || ''}
                onValueChange={(value) =>
                  setValue('apoderadoTipoIdentificacion', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="PA">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de identificación</Label>
              <Input
                placeholder="Número de documento"
                {...register('apoderadoIdentificacion')}
              />
            </div>
            <div className="space-y-2">
              <Label>Tarjeta profesional</Label>
              <Input
                placeholder="Número de tarjeta profesional"
                {...register('apoderadoTarjetaProfesional')}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                placeholder="Dirección de correspondencia"
                {...register('apoderadoDireccion')}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                type="tel"
                placeholder="Ej: 3101234567"
                {...register('apoderadoTelefono')}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                {...register('apoderadoCorreo')}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Poder otorgado</Label>
              <p className="text-muted-foreground text-sm">
                ¿Existe poder otorgado al apoderado?
              </p>
            </div>
            <Switch
              checked={watch('existePoderOtorgado') || false}
              onCheckedChange={(checked) =>
                setValue('existePoderOtorgado', checked)
              }
            />
          </div>
        </div>
      )}

      {/* Dynamic apoderados array */}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-purple-700 dark:text-purple-400">
              Apoderado #{index + 1}
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Nombre completo"
                {...register(`apoderados.${index}.nombreCompleto`)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de identificación</Label>
              <Select
                value={watch(`apoderados.${index}.tipoIdentificacion`) || 'CC'}
                onValueChange={(value) =>
                  setValue(`apoderados.${index}.tipoIdentificacion`, value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                  <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="PA">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de identificación</Label>
              <Input
                placeholder="Número de documento"
                {...register(`apoderados.${index}.identificacion`)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tarjeta profesional</Label>
              <Input
                placeholder="Número de tarjeta profesional"
                {...register(`apoderados.${index}.tarjetaProfesional`)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                placeholder="Dirección de correspondencia"
                {...register(`apoderados.${index}.direccion`)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                type="tel"
                placeholder="Ej: 3101234567"
                {...register(`apoderados.${index}.telefono`)}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                {...register(`apoderados.${index}.correo`)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Poder otorgado</Label>
              <p className="text-muted-foreground text-sm">
                ¿Existe poder otorgado?
              </p>
            </div>
            <Switch
              checked={
                watch(`apoderados.${index}.existePoderOtorgado`) || false
              }
              onCheckedChange={(checked) =>
                setValue(`apoderados.${index}.existePoderOtorgado`, checked)
              }
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addApoderado}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar Apoderado
      </Button>
    </div>
  );
}
