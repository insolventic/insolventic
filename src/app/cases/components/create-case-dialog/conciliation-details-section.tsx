'use client';

import { useFormContext } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ConciliationDetailsSection() {
  const { register } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Asunto */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">Asunto y Cuantía</legend>
        <div className="space-y-4">
          <div>
            <Label>Asunto de la conciliación *</Label>
            <Input
              {...register('concAsunto')}
              placeholder="Ej: Alimentos, Obligaciones civiles, Unión marital..."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Cuantía (pesos)</Label>
              <Input
                {...register('concCuantiaPesos')}
                placeholder="$0"
                type="text"
              />
            </div>
            <div>
              <Label>Cuantía (en letras)</Label>
              <Input
                {...register('concCuantiaLetras')}
                placeholder="Ej: Cinco millones de pesos"
              />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Hechos */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Descripción de los Hechos
        </legend>
        <Textarea
          {...register('concDescripcionHechos')}
          placeholder="Relate los hechos que motivan la solicitud de conciliación..."
          rows={6}
          className="resize-y"
        />
      </fieldset>

      {/* Pretensiones */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">Pretensiones</legend>
        <Textarea
          {...register('concPretensiones')}
          placeholder="Indique las pretensiones que solicita sean conciliadas..."
          rows={4}
          className="resize-y"
        />
      </fieldset>

      {/* Pruebas */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Relación de Pruebas
        </legend>
        <Textarea
          {...register('concRelacionPruebas')}
          placeholder="Liste los documentos o pruebas que adjunta o pretende hacer valer..."
          rows={3}
          className="resize-y"
        />
      </fieldset>

      {/* Medio alterno de comunicación */}
      <div>
        <Label>Otro medio de comunicación (opcional)</Label>
        <Input
          {...register('concOtroMedioComunicacion')}
          placeholder="Ej: WhatsApp, llamada telefónica..."
        />
      </div>
    </div>
  );
}
