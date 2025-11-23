'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import {
  addSuspendedServiceToCase,
  removeSuspendedServiceFromCase,
} from '@/features/case/actions';
import {
  addSuspendedServiceToCaseSchema,
  type AddSuspendedServiceToCaseData,
} from '@/features/case/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface SuspendedServicesTabProps {
  caseId: string;
}

export function SuspendedServicesTab({
  caseId,
}: Readonly<SuspendedServicesTabProps>) {
  const form = useFormContext();
  const newServiceForm = useForm<AddSuspendedServiceToCaseData>({
    resolver: zodResolver(addSuspendedServiceToCaseSchema),
    defaultValues: {
      caseId,
      creditorName: '',
      address: '',
      email: '',
      phone: '',
      amountOwed: '',
      serviceType: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleAddService = newServiceForm.handleSubmit((data) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await addSuspendedServiceToCase(data);

      if (success && result) {
        toast.success('Servicio suspendido agregado exitosamente');
        const currentServices = form.getValues('suspendedServices') ?? [];
        form.setValue('suspendedServices', [
          ...currentServices,
          {
            id: result.id,
            creditorName: result.creditorName,
            address: result.address,
            email: result.email,
            phone: result.phone,
            amountOwed: result.amountOwed,
            serviceType: result.serviceType,
          },
        ]);
        newServiceForm.reset({
          caseId,
          creditorName: '',
          address: '',
          email: '',
          phone: '',
          amountOwed: '',
          serviceType: '',
        });
      } else {
        toast.error(error ?? 'Error al agregar servicio');
      }
    });
  });

  const handleRemoveService = (suspendedServiceId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeSuspendedServiceFromCase({ suspendedServiceId });

      if (success && result) {
        toast.success('Servicio eliminado exitosamente');
        const currentServices = form.getValues('suspendedServices') ?? [];
        form.setValue(
          'suspendedServices',
          currentServices.filter((s: { id: string }) => s.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar servicio');
      }
    });
  };

  const suspendedServices = form.watch('suspendedServices') ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Servicios Públicos Suspendidos</CardTitle>
          <CardDescription>
            Servicios registrados como suspendidos para este caso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suspendedServices.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay servicios suspendidos. Use el formulario abajo para
              agregar.
            </p>
          )}
          {suspendedServices.map(
            (
              service: {
                id: string;
                creditorName: string;
                address: string | null;
                email: string | null;
                phone: string | null;
                amountOwed: string;
                serviceType: string | null;
              },
              index: number,
            ) => (
              <div
                key={service.id}
                className="bg-muted/50 space-y-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Servicio Suspendido #{index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveService(service.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      Nombre del Acreedor/Entidad
                    </p>
                    <p className="font-medium">{service.creditorName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tipo de Servicio</p>
                    <p className="font-medium">
                      {service.serviceType || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dirección</p>
                    <p className="font-medium">{service.address || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Correo Electrónico</p>
                    <p className="font-medium">{service.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Teléfono</p>
                    <p className="font-medium">{service.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Suma Adeudada</p>
                    <p className="font-medium">
                      ${parseFloat(service.amountOwed).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ),
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Servicio Suspendido</CardTitle>
          <CardDescription>
            Complete el formulario para agregar un nuevo servicio suspendido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditorName">
                  Nombre del Acreedor/Entidad{' '}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="creditorName"
                  {...newServiceForm.register('creditorName')}
                  placeholder="Ej: Empresas Públicas de Medellín"
                />
                {newServiceForm.formState.errors.creditorName && (
                  <p className="text-destructive text-sm">
                    {newServiceForm.formState.errors.creditorName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Tipo de Servicio</Label>
                <Input
                  id="serviceType"
                  {...newServiceForm.register('serviceType')}
                  placeholder="Ej: Energía, Agua, Gas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  {...newServiceForm.register('address')}
                  placeholder="Dirección completa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  {...newServiceForm.register('email')}
                  placeholder="correo@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  {...newServiceForm.register('phone')}
                  placeholder="3001234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amountOwed">
                  Suma Adeudada <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amountOwed"
                  type="number"
                  step="0.01"
                  {...newServiceForm.register('amountOwed')}
                  placeholder="0.00"
                />
                {newServiceForm.formState.errors.amountOwed && (
                  <p className="text-destructive text-sm">
                    {newServiceForm.formState.errors.amountOwed.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAddService}
              disabled={isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Servicio'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
