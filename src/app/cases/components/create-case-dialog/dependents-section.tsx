'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { DependentData } from '@/features/case/schemas';

export function DependentsSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'dependents',
  });

  const addDependent = () => {
    append({
      name: '',
      age: 0,
      relationship: '',
    } as DependentData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Obligaciones Alimentarias</h3>
        <Button type="button" onClick={addDependent} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Beneficiario
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay beneficiarios. Haga clic en el botón para agregar.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="bg-muted/50 space-y-4 rounded-lg border p-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Beneficiario #{index + 1}</h4>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`dependents.${index}.name`}>Nombre</Label>
              <Input
                id={`dependents.${index}.name`}
                {...form.register(`dependents.${index}.name`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`dependents.${index}.age`}>Edad</Label>
              <Input
                id={`dependents.${index}.age`}
                type="number"
                {...form.register(`dependents.${index}.age`, {
                  valueAsNumber: true,
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`dependents.${index}.relationship`}>
                Parentesco
              </Label>
              <Input
                id={`dependents.${index}.relationship`}
                {...form.register(`dependents.${index}.relationship`)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
