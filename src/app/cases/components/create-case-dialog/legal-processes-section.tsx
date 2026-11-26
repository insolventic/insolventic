'use client';

import { useRef, useState } from 'react';
import { Plus, Trash2, Scale } from 'lucide-react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TIPOS_PROCESO_JUDICIAL,
  requiresOtherDetail,
} from '@/features/case/proceso-judicial-tipos';

/**
 * Procesos judiciales del caso (alta y edición).
 *
 * En la edición, quitar una fila ya guardada anota su id en
 * `legalProcessesEliminados`: el servidor solo elimina lo que la persona quitó
 * explícitamente. Si el caso ya tiene documentos generados que citan los
 * procesos (`confirmarAlQuitar`), antes pide confirmación nombrando el juzgado,
 * y el id también va a `legalProcessesEliminacionConfirmada`, que el servidor
 * exige en ese caso.
 */
export function LegalProcessesSection({
  confirmarAlQuitar = false,
}: {
  confirmarAlQuitar?: boolean;
} = {}) {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'legalProcesses',
  });
  const [porQuitar, setPorQuitar] = useState<{
    index: number;
    id: string;
    juzgado: string;
  } | null>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const anotar = (campo: string, id: string) => {
    const actuales = (form.getValues(campo) as string[] | undefined) ?? [];
    if (!actuales.includes(id)) {
      form.setValue(campo, [...actuales, id], { shouldDirty: true });
    }
  };

  const quitar = (index: number) => {
    const id = form.getValues(`legalProcesses.${index}.id`) as
      | string
      | undefined;
    if (!id) {
      remove(index); // fila nueva: no hay nada guardado que eliminar
      return;
    }
    if (confirmarAlQuitar) {
      const juzgado =
        (form.getValues(`legalProcesses.${index}.court`) as string) ?? '';
      setPorQuitar({ index, id, juzgado });
      return;
    }
    anotar('legalProcessesEliminados', id);
    remove(index);
  };

  const confirmarQuitar = () => {
    if (!porQuitar) return;
    anotar('legalProcessesEliminados', porQuitar.id);
    anotar('legalProcessesEliminacionConfirmada', porQuitar.id);
    remove(porQuitar.index);
    setPorQuitar(null);
  };

  const addLegalProcess = () => {
    append({
      processType: '',
      processTypeOther: '',
      plaintiff: '',
      court: '',
      originCourt: '',
      courtEmail: '',
      fileNumber: '',
      precautionaryMeasure: '',
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Procesos Judiciales
        </CardTitle>
        <CardDescription>
          Registre los procesos judiciales en contra del solicitante
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-4 rounded-lg border bg-slate-50 p-6 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                Proceso #{index + 1}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => quitar(index)}
                aria-label={`Quitar proceso ${index + 1}`}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name={`legalProcesses.${index}.processType`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>
                      Tipo de Proceso <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={formField.onChange}
                      value={formField.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPOS_PROCESO_JUDICIAL.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {requiresOtherDetail(
                form.watch(`legalProcesses.${index}.processType`),
              ) && (
                <FormField
                  control={form.control}
                  name={`legalProcesses.${index}.processTypeOther`}
                  render={({ field: formField }) => (
                    <FormItem>
                      <FormLabel>
                        ¿Cuál? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...formField}
                          value={formField.value ?? ''}
                          placeholder="Especifique el tipo de proceso"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.plaintiff`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>
                      Demandante <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Nombre del demandante"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.court`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>
                      Juzgado actual <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...formField} placeholder="Ej: Juzgado 1 Civil" />
                    </FormControl>
                    <FormDescription>
                      El que conoce hoy del proceso; a él se dirigen los
                      oficios.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.originCourt`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Juzgado de origen</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        value={formField.value ?? ''}
                        placeholder="Solo si el proceso empezó en otro juzgado"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.courtEmail`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>Correo del Juzgado</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        value={formField.value ?? ''}
                        type="email"
                        placeholder="Ej: j01cmpalmira@cendoj.ramajudicial.gov.co"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.fileNumber`}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel>
                      Expediente <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Número de expediente"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`legalProcesses.${index}.precautionaryMeasure`}
                render={({ field: formField }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Medida Cautelar</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        placeholder="Descripción de la medida cautelar"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLegalProcess}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Proceso Judicial
        </Button>

        {fields.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p className="mb-4">No hay procesos judiciales registrados</p>
            <p className="text-sm">
              Use el botón para agregar procesos judiciales en contra del
              solicitante
            </p>
          </div>
        )}
      </CardContent>
      <Dialog
        open={porQuitar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPorQuitar(null);
        }}
      >
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelarRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>¿Quitar este proceso judicial?</DialogTitle>
            <DialogDescription>
              Se quitará el proceso del{' '}
              <strong>{porQuitar?.juzgado || 'juzgado sin nombre'}</strong>. El
              caso ya tiene documentos generados que lo citan (Solicitud u
              oficio de Suspensión): esos documentos no cambian. Si ya se
              entregaron, habrá que regenerarlos y reenviarlos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelarRef}
              type="button"
              variant="outline"
              onClick={() => setPorQuitar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmarQuitar}
            >
              Quitar proceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
