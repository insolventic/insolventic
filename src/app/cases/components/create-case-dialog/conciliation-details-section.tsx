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

      {/* Datos para Actas (alimentos / unión marital) */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Datos para Acta (alimentos / unión marital)
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Solo aplica si el trámite involucra menores de edad o disolución de
          unión marital. Déjelo vacío si no aplica.
        </p>
        <div>
          <Label>Nombre completo del menor</Label>
          <Input
            {...register('concNombreMenor')}
            placeholder="Ej: Juan Pérez Gómez"
          />
        </div>
      </fieldset>

      {/* Cláusulas adicionales del acuerdo */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas adicionales del acuerdo (opcional)
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Cláusula libre que se incluirá en las Actas de Conciliación cuando
          aplique. Para múltiples cláusulas, utilice saltos de línea numerados.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Número (ordinal)</Label>
            <Input {...register('concNumeroClausula')} placeholder="CUARTO" />
          </div>
          <div className="md:col-span-3">
            <Label>Texto de la cláusula</Label>
            <Textarea
              {...register('concTextoClausula')}
              placeholder="Texto completo de la cláusula adicional..."
              rows={3}
              className="resize-y"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Número adicional</Label>
            <Input
              {...register('concNumeroClausulaAdicional')}
              placeholder="QUINTO"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Texto adicional</Label>
            <Textarea
              {...register('concTextoClausulaAdicional')}
              placeholder="Texto de la segunda cláusula adicional..."
              rows={3}
              className="resize-y"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
