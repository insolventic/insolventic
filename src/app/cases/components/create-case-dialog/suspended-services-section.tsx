'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { SuspendedServiceData } from '@/features/case/schemas';

export function SuspendedServicesSection() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'suspendedServices',
  });

  const addService = () => {
    append({
      creditorName: '',
      address: '',
      email: '',
      phone: '',
      suspendedProduct: '',
      amountOwed: '',
    } as SuspendedServiceData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Servicios Públicos Suspendidos</h3>
        <Button type="button" onClick={addService} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Servicio
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay servicios suspendidos. Haga clic en el botón para agregar.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="bg-muted/50 space-y-4 rounded-lg border p-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Servicio #{index + 1}</h4>
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
              <Label htmlFor={`suspendedServices.${index}.creditorName`}>
                Nombre del Acreedor
              </Label>
              <Input
                id={`suspendedServices.${index}.creditorName`}
                {...form.register(`suspendedServices.${index}.creditorName`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`suspendedServices.${index}.address`}>
                Dirección
              </Label>
              <Input
                id={`suspendedServices.${index}.address`}
                {...form.register(`suspendedServices.${index}.address`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`suspendedServices.${index}.email`}>
                Correo Electrónico
              </Label>
              <Input
                id={`suspendedServices.${index}.email`}
                type="email"
                {...form.register(`suspendedServices.${index}.email`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`suspendedServices.${index}.phone`}>
                Teléfono
              </Label>
              <Input
                id={`suspendedServices.${index}.phone`}
                {...form.register(`suspendedServices.${index}.phone`)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`suspendedServices.${index}.suspendedProduct`}>
                Producto Suspendido y Fecha
              </Label>
              <Input
                id={`suspendedServices.${index}.suspendedProduct`}
                {...form.register(
                  `suspendedServices.${index}.suspendedProduct`,
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`suspendedServices.${index}.amountOwed`}>
                Valor Adeudado
              </Label>
              <Input
                id={`suspendedServices.${index}.amountOwed`}
                type="number"
                step="0.01"
                {...form.register(`suspendedServices.${index}.amountOwed`)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
