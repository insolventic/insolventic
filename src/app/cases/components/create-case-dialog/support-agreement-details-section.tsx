'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MoneyInput } from '@/components/ui/money-input';

const TIPO_APOYO_OPTIONS = [
  'Apoyo económico mensual',
  'Apoyo económico por única vez',
  'Pago de deuda específica',
  'Apoyo en especie (alimentos, vivienda, etc.)',
  'Apoyo mixto (económico + especie)',
  'Otro',
] as const;

/** Reusable repeater for clause rows: numero + texto */
function ClauseRepeater() {
  const { register, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'apoyoClausulas',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Cláusulas del acuerdo (opcional)
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ NUMERO_CLAUSULA: '', TEXTO_CLAUSULA: '' })}
        >
          <Plus className="mr-1 h-3 w-3" />
          Agregar cláusula
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs italic">
          Sin cláusulas adicionales. Haga clic en &quot;Agregar cláusula&quot;
          para añadir.
        </p>
      )}
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="grid grid-cols-[80px_1fr_auto] items-start gap-2"
        >
          <Input
            {...register(`apoyoClausulas.${idx}.NUMERO_CLAUSULA`)}
            placeholder="N°"
          />
          <Textarea
            {...register(`apoyoClausulas.${idx}.TEXTO_CLAUSULA`)}
            placeholder="Texto de la cláusula"
            rows={2}
            className="resize-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            className="text-destructive mt-1 h-8 w-8 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function SupportAgreementDetailsSection() {
  const { register, setValue, watch } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Tipo y condiciones del acuerdo */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Condiciones del acuerdo
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Asunto *</Label>
            <Input
              {...register('apoyoAsunto')}
              placeholder="Descripción breve del asunto del acuerdo"
            />
          </div>
          <div>
            <Label>Tipo de apoyo</Label>
            <Select
              value={watch('apoyoTipoApoyo') || ''}
              onValueChange={(v) => setValue('apoyoTipoApoyo', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de apoyo" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_APOYO_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monto mensual (COP)</Label>
            <MoneyInput name="apoyoMontoMensual" placeholder="Ej: 500000" />
          </div>
          <div>
            <Label>Plazo (meses)</Label>
            <Input
              {...register('apoyoPlazoMeses')}
              placeholder="Ej: 12"
              type="number"
              min="1"
            />
          </div>
        </div>
      </fieldset>

      {/* Descripción */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Descripción y pretensiones
        </legend>
        <div className="space-y-4">
          <div>
            <Label>Descripción de los hechos *</Label>
            <Textarea
              {...register('apoyoDescripcionHechos')}
              placeholder="Describa la situación que motiva el acuerdo de apoyo..."
              rows={4}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Pretensiones / Compromisos del prestador</Label>
            <Textarea
              {...register('apoyoPretensiones')}
              placeholder="Describa los compromisos concretos que asume el prestador..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Condiciones adicionales</Label>
            <Textarea
              {...register('apoyoCondiciones')}
              placeholder="Condiciones, restricciones o requisitos adicionales del acuerdo..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
      </fieldset>

      {/* Cláusulas */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas del acuerdo
        </legend>
        <ClauseRepeater />
      </fieldset>

      {/* Acuerdo y resultado (para cuando ya está firmado/terminado) */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold text-gray-400">
          Resultado (completar al cerrar el trámite)
        </legend>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">
              Texto del acuerdo suscrito
            </Label>
            <Textarea
              {...register('apoyoAcuerdo')}
              placeholder="Transcripción o resumen del acuerdo firmado por las partes..."
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">
                Descripción del resultado
              </Label>
              <Textarea
                {...register('apoyoResultado')}
                placeholder="Resultado del trámite..."
                rows={2}
                className="resize-none"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">
                Causa de terminación (si aplica)
              </Label>
              <Input
                {...register('apoyoCausaTerminacion')}
                placeholder="Incumplimiento, mutuo acuerdo, etc."
              />
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
