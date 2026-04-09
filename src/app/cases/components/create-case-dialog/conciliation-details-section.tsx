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

// ---------------------------------------------------------------------------
// Reusable repeater for minor-name rows
// ---------------------------------------------------------------------------
function MinorRepeater({
  name,
  fieldKey,
  label,
  placeholder,
}: {
  name: string;
  fieldKey: string;
  label: string;
  placeholder: string;
}) {
  const { register, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ [fieldKey]: '' })}
        >
          <Plus className="mr-1 h-3 w-3" />
          Agregar
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs italic">
          Sin registros. Haga clic en &quot;Agregar&quot; para añadir.
        </p>
      )}
      {fields.map((field, idx) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            {...register(`${name}.${idx}.${fieldKey}`)}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            className="text-destructive h-8 w-8 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable repeater for clause rows (number + text)
// ---------------------------------------------------------------------------
function ClauseRepeater({
  name,
  numberKey,
  textKey,
  label,
}: {
  name: string;
  numberKey: string;
  textKey: string;
  label: string;
}) {
  const { register, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ [numberKey]: '', [textKey]: '' })}
        >
          <Plus className="mr-1 h-3 w-3" />
          Agregar
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs italic">
          Sin cláusulas. Haga clic en &quot;Agregar&quot; para añadir.
        </p>
      )}
      {fields.map((field, idx) => (
        <div key={field.id} className="flex gap-2">
          <div className="w-28 shrink-0">
            <Input
              {...register(`${name}.${idx}.${numberKey}`)}
              placeholder="CUARTO"
            />
          </div>
          <Textarea
            {...register(`${name}.${idx}.${textKey}`)}
            placeholder="Texto de la cláusula..."
            rows={2}
            className="flex-1 resize-y"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            className="text-destructive h-8 w-8 shrink-0 self-start"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ConciliationDetailsSection() {
  const { register, setValue, watch } = useFormContext();

  const causaTerminacion = watch('concCausaTerminacion') ?? '';
  const resultadoInforme = watch('concResultadoInforme') ?? '';

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

      {/* ================================================================= */}
      {/* Menores de edad (alimentos) — dynamic rows                        */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Menores de edad — Alimentos
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Agregue un registro por cada menor beneficiario de alimentos. Déjelo
          vacío si no aplica.
        </p>
        <MinorRepeater
          name="concMenoresAlimentos"
          fieldKey="NOMBRE_MENOR"
          label="Nombres de menores"
          placeholder="Nombre completo del menor"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Menores de edad (unión marital) — dynamic rows                    */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Menores de edad — Unión Marital
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Solo aplica si el trámite involucra disolución de unión marital con
          hijos menores.
        </p>
        <MinorRepeater
          name="concMenoresUnion"
          fieldKey="NOMBRE_MENOR_UNION"
          label="Nombres de menores"
          placeholder="Nombre completo del menor"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Cláusulas del acuerdo (numeradas) — {{#each CLAUSULAS_ACUERDO}}   */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas del Acuerdo
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Cláusulas numeradas que se incluirán en el Acta de Acuerdo
          Conciliatorio.
        </p>
        <ClauseRepeater
          name="concClausulasAcuerdo"
          numberKey="NUMERO_CLAUSULA"
          textKey="TEXTO_CLAUSULA"
          label="Cláusulas"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Cláusulas adicionales — alimentos                                 */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas Adicionales — Alimentos
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Cláusulas extra para el acta de alimentos (opcional).
        </p>
        <ClauseRepeater
          name="concClausulasAdicionalesAlimentos"
          numberKey="NUMERO_CLAUSULA_ADICIONAL"
          textKey="TEXTO_CLAUSULA_ADICIONAL"
          label="Cláusulas adicionales"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Cláusulas adicionales — unión marital                             */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas Adicionales — Unión Marital
        </legend>
        <ClauseRepeater
          name="concClausulasAdicionalesUnion"
          numberKey="NUMERO_CLAUSULA_ADICIONAL"
          textKey="TEXTO_CLAUSULA_ADICIONAL"
          label="Cláusulas adicionales"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Cláusulas adicionales — disolución                                */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas Adicionales — Disolución
        </legend>
        <ClauseRepeater
          name="concClausulasAdicionalesDisolucion"
          numberKey="NUMERO_CLAUSULA_ADICIONAL"
          textKey="TEXTO_CLAUSULA_ADICIONAL"
          label="Cláusulas adicionales"
        />
      </fieldset>

      {/* ================================================================= */}
      {/* Cláusulas fijas de alimentos (primero / segundo / tercero)        */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Cláusulas Fijas de Alimentos
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Contenido de las cláusulas PRIMERO, SEGUNDO y TERCERO del acta de
          alimentos.
        </p>
        <div className="space-y-4">
          <div>
            <Label>Cláusula PRIMERO</Label>
            <Textarea
              {...register('concClausulaPrimeroAlimentos')}
              placeholder="Texto de la cláusula primero..."
              rows={3}
              className="resize-y"
            />
          </div>
          <div>
            <Label>Cláusula SEGUNDO</Label>
            <Textarea
              {...register('concClausulaSegundoAlimentos')}
              placeholder="Texto de la cláusula segundo..."
              rows={3}
              className="resize-y"
            />
          </div>
          <div>
            <Label>Cláusula TERCERO</Label>
            <Textarea
              {...register('concClausulaTerceroAlimentos')}
              placeholder="Texto de la cláusula tercero..."
              rows={3}
              className="resize-y"
            />
          </div>
        </div>
      </fieldset>

      {/* ================================================================= */}
      {/* Causa de terminación anormal                                      */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Causa de Terminación (anormal)
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Seleccione la causa si la audiencia terminó de forma anormal. Déjelo
          vacío si hubo acuerdo.
        </p>
        <Select
          value={causaTerminacion}
          onValueChange={(v) =>
            setValue('concCausaTerminacion', v === '_none' ? null : v, {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="No aplica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No aplica</SelectItem>
            <SelectItem value="PARTES_NO_ASISTIERON">
              Las partes no asistieron a la audiencia
            </SelectItem>
            <SelectItem value="NO_SOLICITARON_RETIRO">
              No solicitaron retiro del acta
            </SelectItem>
            <SelectItem value="OTRA">Otra causa</SelectItem>
          </SelectContent>
        </Select>
        {causaTerminacion === 'OTRA' && (
          <div className="mt-3">
            <Label>Descripción de la causa</Label>
            <Textarea
              {...register('concDescripcionCausaAnormal')}
              placeholder="Describa la causa de terminación anormal..."
              rows={3}
              className="resize-y"
            />
          </div>
        )}
      </fieldset>

      {/* ================================================================= */}
      {/* Resultado del informe del conciliador                             */}
      {/* ================================================================= */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Resultado del Informe
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Resultado consignado en el informe del conciliador.
        </p>
        <Select
          value={resultadoInforme}
          onValueChange={(v) =>
            setValue('concResultadoInforme', v === '_none' ? null : v, {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="No aplica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">No aplica</SelectItem>
            <SelectItem value="INASISTENCIA_CONVOCANTE">
              Inasistencia del convocante
            </SelectItem>
            <SelectItem value="INASISTENCIA_CONVOCADO">
              Inasistencia del convocado
            </SelectItem>
            <SelectItem value="OTRO">Otro resultado</SelectItem>
          </SelectContent>
        </Select>
        {resultadoInforme === 'OTRO' && (
          <div className="mt-3">
            <Label>Descripción del resultado</Label>
            <Textarea
              {...register('concDescripcionResultado')}
              placeholder="Describa el resultado del informe..."
              rows={3}
              className="resize-y"
            />
          </div>
        )}
      </fieldset>

      {/* Bienes / alimentos situación */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Situación de Bienes y Alimentos
        </legend>
        <div className="space-y-4">
          <div>
            <Label>Situación de bienes</Label>
            <Textarea
              {...register('concSituacionBienes')}
              placeholder="Describa la situación de bienes..."
              rows={3}
              className="resize-y"
            />
          </div>
          <div>
            <Label>Situación de alimentos</Label>
            <Textarea
              {...register('concSituacionAlimentos')}
              placeholder="Describa la situación de alimentos..."
              rows={3}
              className="resize-y"
            />
          </div>
        </div>
      </fieldset>

      {/* Información adicional / acuerdo libre */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Acuerdo e Información Adicional
        </legend>
        <div className="space-y-4">
          <div>
            <Label>Acuerdo conciliatorio (texto libre)</Label>
            <Textarea
              {...register('concAcuerdoConciliatorio')}
              placeholder="Texto del acuerdo conciliatorio alcanzado..."
              rows={4}
              className="resize-y"
            />
          </div>
          <div>
            <Label>Información adicional</Label>
            <Textarea
              {...register('concInfoAdicional')}
              placeholder="Información complementaria para el acta..."
              rows={3}
              className="resize-y"
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
