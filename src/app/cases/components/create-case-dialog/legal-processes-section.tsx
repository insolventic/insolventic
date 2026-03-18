'use client';

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LegalProcessesSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'legalProcesses',
  });

  const addLegalProcess = () => {
    append({
      processType: '',
      plaintiff: '',
      court: '',
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
                onClick={() => remove(index)}
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
                        <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                        <SelectItem value="ORDINARIO">Ordinario</SelectItem>
                        <SelectItem value="ABREVIADO">Abreviado</SelectItem>
                        <SelectItem value="MONITORIO">Monitorio</SelectItem>
                        <SelectItem value="VERBAL">Verbal</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      Juzgado <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...formField} placeholder="Ej: Juzgado 1 Civil" />
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
    </Card>
  );
}
