'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { LibranzaData } from '@/features/case/schemas';

export function LibranzasSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'libranzas',
  });

  const addLibranza = () => {
    append({
      payerName: '',
      payerAddress: '',
      payerEmail: '',
      payerPhone: '',
      deductedAmount: '',
      productAndCreditor: '',
    } as LibranzaData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Libranzas y Pagadores</h3>
        <Button type="button" onClick={addLibranza} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Libranza
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay libranzas agregadas. Haga clic en el botón para agregar.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="bg-muted/50 space-y-4 rounded-lg border p-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Libranza #{index + 1}</h4>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.payerName`}>
                Nombre del Pagador
              </Label>
              <Input
                id={`libranzas.${index}.payerName`}
                {...form.register(`libranzas.${index}.payerName`)}
              />
              <p className="text-muted-foreground text-xs">
                Se completa con el empleador de la Sección III. Cámbielo si el
                pagador es otro (una pagaduría o un fondo).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.payerAddress`}>
                Dirección
              </Label>
              <Input
                id={`libranzas.${index}.payerAddress`}
                {...form.register(`libranzas.${index}.payerAddress`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.payerEmail`}>
                Correo Electrónico
              </Label>
              <Input
                id={`libranzas.${index}.payerEmail`}
                type="email"
                {...form.register(`libranzas.${index}.payerEmail`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.payerPhone`}>Teléfono</Label>
              <Input
                id={`libranzas.${index}.payerPhone`}
                {...form.register(`libranzas.${index}.payerPhone`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.deductedAmount`}>
                Suma Descontada
              </Label>
              <Input
                id={`libranzas.${index}.deductedAmount`}
                type="number"
                step="0.01"
                {...form.register(`libranzas.${index}.deductedAmount`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`libranzas.${index}.productAndCreditor`}>
                Producto y Acreedor
              </Label>
              <Input
                id={`libranzas.${index}.productAndCreditor`}
                {...form.register(`libranzas.${index}.productAndCreditor`)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
