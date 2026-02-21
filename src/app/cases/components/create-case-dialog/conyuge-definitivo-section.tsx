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

export function ConyugeDefinitivoSection() {
  const { register, watch, setValue } = useFormContext<CreateCaseFormInput>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección II: Información del Cónyuge o Compañero(a) Permanente
        </h3>
        <p className="text-sm text-muted-foreground">
          Datos del cónyuge o compañero(a) permanente del deudor
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Tipo de identificación</Label>
          <Select
            value={watch('conyugeTipoIdentificacion') || ''}
            onValueChange={(value) =>
              setValue('conyugeTipoIdentificacion', value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
              <SelectItem value="CE">Cédula de Extranjería</SelectItem>
              <SelectItem value="PA">Pasaporte</SelectItem>
              <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Número de identificación</Label>
          <Input
            placeholder="Número de documento"
            {...register('conyugeIdentificacion')}
          />
        </div>

        <div className="space-y-2">
          <Label>Primer nombre</Label>
          <Input {...register('conyugePrimerNombre')} />
        </div>

        <div className="space-y-2">
          <Label>Segundo nombre</Label>
          <Input {...register('conyugeSegundoNombre')} />
        </div>

        <div className="space-y-2">
          <Label>Primer apellido</Label>
          <Input {...register('conyugePrimerApellido')} />
        </div>

        <div className="space-y-2">
          <Label>Segundo apellido</Label>
          <Input {...register('conyugeSegundoApellido')} />
        </div>

        <div className="space-y-2">
          <Label>Teléfono</Label>
          <Input
            type="tel"
            placeholder="Ej: 3101234567"
            {...register('conyugeTelefono')}
          />
        </div>

        <div className="space-y-2">
          <Label>Correo electrónico</Label>
          <Input
            type="email"
            placeholder="correo@ejemplo.com"
            {...register('conyugeCorreo')}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label>Sociedad conyugal disuelta</Label>
          <p className="text-sm text-muted-foreground">
            ¿La sociedad conyugal se encuentra disuelta y liquidada?
          </p>
        </div>
        <Switch
          checked={watch('sociedadConyugalDisuelta') || false}
          onCheckedChange={(checked) =>
            setValue('sociedadConyugalDisuelta', checked)
          }
        />
      </div>
    </div>
  );
}
