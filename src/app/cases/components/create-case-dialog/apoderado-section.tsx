'use client';

import { useFormContext } from 'react-hook-form';
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

export function ApoderadoSection() {
  const { register, watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección XI: Información del Apoderado
        </h3>
        <p className="text-sm text-muted-foreground">
          Datos del apoderado o representante legal del deudor
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Nombre completo del apoderado</Label>
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
          <p className="text-sm text-muted-foreground">
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
  );
}
