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

      {/* Fechas reales del trámite — C-1a (auditoría 2026-10-12). Antes de
          estas tres columnas, DIA_/MES_/ANO_SOLICITUD, _CITACION y
          _DESISTIMIENTO caían silenciosamente en la fecha de HOY cuando no
          se informaban (`getDayNumber/getMonthName/getYear(now)`); un
          commit anterior ya cambió ese default a un blanco visible (____) y
          esta sección es donde se llena el dato real para que deje de
          aparecer en blanco. `register` simple, como `suspensionDate`
          (suspended-services-section.tsx) — no Controller/`field.value`:
          ese patrón es de case-details-section.tsx, que usa `<FormField>`,
          no `useFormContext` + `register` como este archivo. */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Fechas reales del trámite
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Fechas en que efectivamente ocurrieron estos hechos. Déjelas en
          blanco si aún no han ocurrido o no aplican.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="concFechaSolicitud">Fecha de solicitud</Label>
            <Input
              id="concFechaSolicitud"
              type="date"
              {...register('concFechaSolicitud')}
            />
          </div>
          <div>
            <Label htmlFor="concFechaCitacion">Fecha de citación</Label>
            <Input
              id="concFechaCitacion"
              type="date"
              {...register('concFechaCitacion')}
            />
          </div>
          <div>
            <Label htmlFor="concFechaDesistimiento">
              Fecha de desistimiento
            </Label>
            <Input
              id="concFechaDesistimiento"
              type="date"
              {...register('concFechaDesistimiento')}
            />
          </div>
        </div>
      </fieldset>

      {/* Audiencia virtual — C-3 (auditoría 2026-10-12). Las tres columnas ya
          existían en el schema y en Zod desde antes de esta auditoría
          (`zoomLink`/`zoomMeetingId`/`zoomPassword`); lo que faltaba era el
          input. Sin ellas, `Notificacion de Convocatoria.html` — la citación
          que se envía al convocado — salía con el bloque "DATOS INGRESO
          REUNIÓN ZOOM" sin ID, sin clave y sin enlace: la parte citada no
          podía entrar a la audiencia virtual. */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Audiencia virtual (Zoom)
        </legend>
        <p className="text-muted-foreground mb-4 text-sm">
          Si la audiencia se va a realizar por Zoom, complete estos datos para
          que la Notificación de Convocatoria los incluya. Déjelos en blanco
          si la audiencia es presencial.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="zoomMeetingId">ID de la reunión</Label>
            <Input
              id="zoomMeetingId"
              {...register('zoomMeetingId')}
              placeholder="Ej: 123 4567 8901"
            />
          </div>
          <div>
            <Label htmlFor="zoomPassword">Código de acceso</Label>
            <Input
              id="zoomPassword"
              {...register('zoomPassword')}
              placeholder="Ej: ABC123"
            />
          </div>
          <div>
            <Label htmlFor="zoomLink">Enlace de la reunión</Label>
            <Input
              id="zoomLink"
              type="url"
              {...register('zoomLink')}
              placeholder="https://zoom.us/j/..."
            />
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

      {/* Referencias del acta de unión — C-1c (auditoría 2026-10-12). El
          Acta de Disolución de Unión Marital identifica el acta/trámite de
          unión que se disuelve ("...mediante Acta No. {{NUMERO_ACTA_UNION_REF}}
          y Trámite No. {{NUMERO_TRAMITE_UNION_REF}}"); sin estos dos datos,
          el acta de disolución no decía A QUÉ unión se refería. NO son las
          fechas de la unión en sí (C-1b, pendiente con la abogada). */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Referencias del Acta de Unión
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Número del acta y trámite de la unión marital que se disuelve o
          aclara. Solo aplica si el trámite involucra disolución de unión
          marital.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="concNumeroActaUnionRef">
              Número de Acta de la unión
            </Label>
            <Input
              id="concNumeroActaUnionRef"
              {...register('concNumeroActaUnionRef')}
              placeholder="Ej: 045-2024"
            />
          </div>
          <div>
            <Label htmlFor="concNumeroTramiteUnionRef">
              Número de Trámite de la unión
            </Label>
            <Input
              id="concNumeroTramiteUnionRef"
              {...register('concNumeroTramiteUnionRef')}
              placeholder="Ej: T-2024-045"
            />
          </div>
        </div>
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
        {/* C-2 (auditoría 2026-10-12): la hora programada de la audiencia ya
            existía en schema.prisma y en Zod (concHoraProgramada), y
            Terminacion Anormal.html ya la imprime ("...a las
            {{HORA_PROGRAMADA}}, para convocar a..."); faltaba el input. No es
            exclusiva de la causa seleccionada —el párrafo que la usa describe
            la audiencia tal como se citó, independientemente de por qué
            terminó anormalmente—, por eso va antes del selector de causa. */}
        <div className="mb-4 max-w-xs">
          <Label htmlFor="concHoraProgramada">
            Hora programada de la audiencia
          </Label>
          <Input
            id="concHoraProgramada"
            type="time"
            {...register('concHoraProgramada')}
          />
        </div>
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
        {/* C-2 (auditoría 2026-10-12): ya existía en schema.prisma y en Zod
            (concTipoConstanciaSolicitada), y el Informe Conciliador ya la
            imprime ("...se solicita expedir {{TIPO_CONSTANCIA_SOLICITADA}}");
            faltaba el input. Texto libre, no un Select: el documento la
            inserta tal cual en la frase ("se solicita expedir [esto]"), así
            que tiene que quedar gramaticalmente correcta ("constancia de no
            acuerdo", "constancia de inasistencia"...), no un código. */}
        <div className="mb-4">
          <Label htmlFor="concTipoConstanciaSolicitada">
            Tipo de constancia solicitada
          </Label>
          <Input
            id="concTipoConstanciaSolicitada"
            {...register('concTipoConstanciaSolicitada')}
            placeholder="Ej: constancia de no acuerdo"
          />
        </div>
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

      {/* ================================================================= */}
      {/* Aclaración de Acta — C-1c (auditoría 2026-10-12)                   */}
      {/* ================================================================= */}
      {/* Auto Aclaracion de Acta.html la genera sin decir QUÉ se corrige;
          estos cuatro campos son esa descripción. */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">
          Aclaración de Acta
        </legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Solo aplica si el trámite es una aclaración de un acta de
          conciliación ya expedida.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="concCampoConError">Campo con error</Label>
              <Input
                id="concCampoConError"
                {...register('concCampoConError')}
                placeholder="Ej: Nombre del convocado"
              />
            </div>
            <div>
              <Label htmlFor="concDescripcionError">
                Descripción del error
              </Label>
              <Input
                id="concDescripcionError"
                {...register('concDescripcionError')}
                placeholder="Ej: Error de digitación en el nombre"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="concValorIncorrecto">Valor incorrecto</Label>
              <Input
                id="concValorIncorrecto"
                {...register('concValorIncorrecto')}
                placeholder="Lo que decía el acta"
              />
            </div>
            <div>
              <Label htmlFor="concValorCorrecto">Valor correcto</Label>
              <Input
                id="concValorCorrecto"
                {...register('concValorCorrecto')}
                placeholder="Lo que debe decir"
              />
            </div>
          </div>
        </div>
      </fieldset>

      {/* ================================================================= */}
      {/* Desistimiento — C-1c (auditoría 2026-10-12)                       */}
      {/* ================================================================= */}
      {/* Auto Desistimiento Conciliacion.html: "...por parte de
          {{TIPO_SOLICITANTE_DESISTIMIENTO}} {{#if HAS_APODERADO_DESISTIMIENTO}}
          de la parte convocante, la apoderada {{NOMBRE_APODERADO_DESISTIMIENTO}},
          {{/if}}...". `concApoderadoDesistimientoName` es solo el nombre —no
          un bloque completo de apoderado como los de
          `conciliation-parties-section.tsx`— porque el documento no necesita
          más que eso para esta frase. */}
      <fieldset className="rounded-lg border p-4">
        <legend className="px-2 text-sm font-semibold">Desistimiento</legend>
        <p className="text-muted-foreground mb-3 text-xs">
          Solo aplica si el trámite es un desistimiento de la conciliación.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="concTipoSolicitanteDesistimiento">
              Quién desiste
            </Label>
            <Input
              id="concTipoSolicitanteDesistimiento"
              {...register('concTipoSolicitanteDesistimiento')}
              placeholder="Ej: la parte convocante"
            />
          </div>
          <div>
            <Label htmlFor="concApoderadoDesistimientoName">
              Nombre del apoderado (si desiste a través de apoderado)
            </Label>
            <Input
              id="concApoderadoDesistimientoName"
              {...register('concApoderadoDesistimientoName')}
              placeholder="Nombre completo del apoderado"
            />
          </div>
        </div>
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
