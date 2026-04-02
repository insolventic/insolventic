'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
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
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function ProcesosJudicialesSection() {
  const { register, watch, setValue, control } =
    useFormContext<CreateCaseFormInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'procesosJudiciales',
  });

  const addProcesoJudicial = () => {
    append({
      tipoProceso: '',
      juzgadoNombre: '',
      juzgadoCiudad: '',
      procesoJudicialRadicado: '',
      demandanteNombre: '',
      demandadoNombre: '',
      cuantiaProceso: '',
      estadoProceso: '',
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">
        {'Secci\u00f3n VII: Relaci\u00f3n de Procesos Judiciales'}
      </h3>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-purple-700 dark:text-purple-400">
              Proceso Judicial #{index + 1}
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
              <Label>Tipo de Proceso</Label>
              <Select
                value={watch(`procesosJudiciales.${index}.tipoProceso`) || ''}
                onValueChange={(value) =>
                  setValue(`procesosJudiciales.${index}.tipoProceso`, value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ejecutivo singular">
                    Ejecutivo singular
                  </SelectItem>
                  <SelectItem value="Ejecutivo mixto">
                    Ejecutivo mixto
                  </SelectItem>
                  <SelectItem value="Ordinario">Ordinario</SelectItem>
                  <SelectItem value="Laboral">Laboral</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
              {watch(`procesosJudiciales.${index}.tipoProceso`) === 'Otro' && (
                <Input
                  className="mt-2"
                  placeholder="Especifique el tipo de proceso"
                  {...register(`procesosJudiciales.${index}.tipoProcesoOtro`)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Juzgado</Label>
              <Input
                {...register(`procesosJudiciales.${index}.juzgadoNombre`)}
                placeholder="Nombre del juzgado"
              />
            </div>

            <div className="space-y-2">
              <Label>Ciudad del Juzgado</Label>
              <Input
                {...register(`procesosJudiciales.${index}.juzgadoCiudad`)}
                placeholder="Ciudad"
              />
            </div>

            <div className="space-y-2">
              <Label>Radicado</Label>
              <Input
                {...register(
                  `procesosJudiciales.${index}.procesoJudicialRadicado`,
                )}
                placeholder="N\u00famero de radicado"
              />
            </div>

            <div className="space-y-2">
              <Label>Demandante</Label>
              <Input
                {...register(`procesosJudiciales.${index}.demandanteNombre`)}
                placeholder="Nombre del demandante"
              />
            </div>

            <div className="space-y-2">
              <Label>Demandado</Label>
              <Input
                {...register(`procesosJudiciales.${index}.demandadoNombre`)}
                placeholder="Nombre del demandado"
              />
            </div>

            <div className="space-y-2">
              <Label>{'Cuant\u00eda del Proceso'}</Label>
              <Input
                {...register(`procesosJudiciales.${index}.cuantiaProceso`)}
                placeholder="0.00"
                type="text"
              />
            </div>

            <div className="space-y-2">
              <Label>Estado del Proceso</Label>
              <Select
                value={watch(`procesosJudiciales.${index}.estadoProceso`) || ''}
                onValueChange={(value) =>
                  setValue(`procesosJudiciales.${index}.estadoProceso`, value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="En tr\u00e1mite">
                    {'En tr\u00e1mite'}
                  </SelectItem>
                  <SelectItem value="Sentencia">Sentencia</SelectItem>
                  <SelectItem value="Archivo">Archivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addProcesoJudicial}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar Proceso Judicial
      </Button>

      {fields.length === 0 && (
        <div className="text-muted-foreground py-8 text-center">
          <p className="mb-4">No hay procesos judiciales registrados</p>
          <p className="text-sm">
            Use el bot&oacute;n para agregar procesos judiciales relacionados
            con el deudor
          </p>
        </div>
      )}
    </div>
  );
}
