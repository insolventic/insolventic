'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SERVICIOS_MANUTENCION_BASE,
  SERVICIO_MANUTENCION_OTRO,
  isOtroServicio,
  nuevoServicio,
  servicioManutencionLabel,
} from '@/features/case/servicios-manutencion';
import type { CreateCaseFormInput } from '@/features/case/schemas';

/**
 * Desglose de servicios de manutención: gas, agua, luz y los que se agreguen
 * con "+ Otros".
 *
 * Los tres fijos se activan y desactivan con un botón cada uno (no son
 * casillas independientes: la fila existe o no existe, y lo que se guarda es
 * exactamente la lista de servicios que el deudor tiene). Los de "+ Otros"
 * llevan nombre y descripción escritos por el operador.
 *
 * Es un dato interno: no viaja a ningún documento generado. El aviso al pie lo
 * dice en la pantalla para que nadie escriba ahí algo esperando verlo en el PDF.
 */
export function ServiciosManutencionSection() {
  const { control, register, watch } = useFormContext<CreateCaseFormInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'serviciosManutencion',
  });

  const servicios = watch('serviciosManutencion') ?? [];

  const indexOfTipo = (tipo: string) =>
    servicios.findIndex((s) => s?.tipo === tipo);

  const toggleBase = (tipo: string) => {
    const index = indexOfTipo(tipo);
    if (index >= 0) remove(index);
    else append(nuevoServicio(tipo));
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <Label className="text-base">Servicios de manutención</Label>
        <p className="text-muted-foreground text-sm">
          Qué servicios tiene el deudor. El monto total va en &quot;Servicios
          públicos&quot;, arriba.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SERVICIOS_MANUTENCION_BASE.map((servicio) => {
          const activo = indexOfTipo(servicio.value) >= 0;
          return (
            <Button
              key={servicio.value}
              type="button"
              size="sm"
              variant={activo ? 'default' : 'outline'}
              onClick={() => toggleBase(servicio.value)}
              aria-pressed={activo}
            >
              {servicio.label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append(nuevoServicio(SERVICIO_MANUTENCION_OTRO))}
        >
          <Plus className="mr-1 h-4 w-4" />
          Otros
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No se registraron servicios.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const tipo = servicios[index]?.tipo ?? '';
            const esOtro = isOtroServicio(tipo);

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 items-end gap-3 rounded border p-3 md:grid-cols-[1fr_2fr_auto]"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Servicio</Label>
                  {esOtro ? (
                    <Input
                      placeholder="Ej: Internet, Administración"
                      {...register(`serviciosManutencion.${index}.nombre`)}
                    />
                  ) : (
                    <p className="py-2 text-sm font-medium">
                      {servicioManutencionLabel(servicios[index])}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input
                    placeholder="Observaciones para el expediente"
                    {...register(`serviciosManutencion.${index}.descripcion`)}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                  aria-label={`Quitar ${servicioManutencionLabel(servicios[index])}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Lock className="mt-0.5 h-3 w-3 flex-shrink-0" />
        Solo para uso interno del operador. Este desglose no aparece en ningún
        documento generado.
      </p>
    </div>
  );
}
