'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import {
  addLibranzaToCase,
  removeLibranzaFromCase,
} from '@/features/case/actions';
import {
  addLibranzaToCaseSchema,
  type AddLibranzaToCaseData,
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

interface LibranzasTabProps {
  caseId: string;
}

export function LibranzasTab({ caseId }: Readonly<LibranzasTabProps>) {
  const form = useFormContext();
  const newLibranzaForm = useForm<AddLibranzaToCaseData>({
    resolver: zodResolver(addLibranzaToCaseSchema),
    defaultValues: {
      caseId,
      payerName: '',
      payerAddress: '',
      payerEmail: '',
      payerPhone: '',
      deductedAmount: '',
      productAndCreditor: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleAddLibranza = newLibranzaForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addLibranzaToCase(data);

      if (success && result) {
        toast.success('Libranza agregada exitosamente');
        const currentLibranzas = form.getValues('libranzas') ?? [];
        form.setValue('libranzas', [
          ...currentLibranzas,
          {
            id: result.id,
            payerName: result.payerName,
            payerAddress: result.payerAddress,
            payerEmail: result.payerEmail,
            payerPhone: result.payerPhone,
            deductedAmount: result.deductedAmount,
            productAndCreditor: result.productAndCreditor,
          },
        ]);
        newLibranzaForm.reset({
          caseId,
          payerName: '',
          payerAddress: '',
          payerEmail: '',
          payerPhone: '',
          deductedAmount: '',
          productAndCreditor: '',
        });
      } else {
        toast.error(error ?? 'Error al agregar libranza');
      }
    });
  });

  const handleRemoveLibranza = (libranzaId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeLibranzaFromCase({ libranzaId });

      if (success && result) {
        toast.success('Libranza eliminada exitosamente');
        const currentLibranzas = form.getValues('libranzas') ?? [];
        form.setValue(
          'libranzas',
          currentLibranzas.filter((l: { id: string }) => l.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar libranza');
      }
    });
  };

  const libranzas = form.watch('libranzas') ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Libranzas Existentes</CardTitle>
          <CardDescription>
            Libranzas registradas para este caso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {libranzas.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay libranzas agregadas. Use el formulario abajo para agregar.
            </p>
          )}
          {libranzas.map(
            (
              libranza: {
                id: string;
                payerName: string;
                payerAddress: string | null;
                payerEmail: string | null;
                payerPhone: string | null;
                deductedAmount: string;
                productAndCreditor: string | null;
              },
              index: number,
            ) => (
              <div
                key={libranza.id}
                className="bg-muted/50 space-y-4 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Libranza #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveLibranza(libranza.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nombre del Pagador</p>
                    <p className="font-medium">{libranza.payerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dirección</p>
                    <p className="font-medium">
                      {libranza.payerAddress || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Correo Electrónico</p>
                    <p className="font-medium">
                      {libranza.payerEmail || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Teléfono</p>
                    <p className="font-medium">
                      {libranza.payerPhone || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Suma Descontada</p>
                    <p className="font-medium">
                      ${parseFloat(libranza.deductedAmount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Producto y Acreedor</p>
                    <p className="font-medium">
                      {libranza.productAndCreditor || 'N/A'}
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
          <CardTitle>Agregar Nueva Libranza</CardTitle>
          <CardDescription>
            Complete el formulario para agregar una nueva libranza
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payerName">
                  Nombre del Pagador <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="payerName"
                  {...newLibranzaForm.register('payerName')}
                  placeholder="Nombre completo"
                />
                {newLibranzaForm.formState.errors.payerName && (
                  <p className="text-destructive text-sm">
                    {newLibranzaForm.formState.errors.payerName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payerAddress">Dirección</Label>
                <Input
                  id="payerAddress"
                  {...newLibranzaForm.register('payerAddress')}
                  placeholder="Dirección completa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payerEmail">Correo Electrónico</Label>
                <Input
                  id="payerEmail"
                  type="email"
                  {...newLibranzaForm.register('payerEmail')}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payerPhone">Teléfono</Label>
                <Input
                  id="payerPhone"
                  {...newLibranzaForm.register('payerPhone')}
                  placeholder="3001234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deductedAmount">
                  Suma Descontada <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deductedAmount"
                  type="number"
                  step="0.01"
                  {...newLibranzaForm.register('deductedAmount')}
                  placeholder="0.00"
                />
                {newLibranzaForm.formState.errors.deductedAmount && (
                  <p className="text-destructive text-sm">
                    {newLibranzaForm.formState.errors.deductedAmount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productAndCreditor">Producto y Acreedor</Label>
                <Input
                  id="productAndCreditor"
                  {...newLibranzaForm.register('productAndCreditor')}
                  placeholder="Descripción del producto"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleAddLibranza}
              disabled={isPending}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Guardando...' : 'Guardar Libranza'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
