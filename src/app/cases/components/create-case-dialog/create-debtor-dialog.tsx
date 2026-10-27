'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

// Validation schema with clear, specific Spanish messages
const createDebtorQuickSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .min(3, 'El nombre debe tener al menos 3 caracteres'),
  idNumber: z
    .string()
    .min(1, 'La cédula es obligatoria')
    .min(5, 'La cédula debe tener al menos 5 dígitos')
    .regex(/^[0-9]+$/, 'La cédula solo debe contener números'),
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Ingrese un email válido (ej: usuario@correo.com)'),
  phone: z
    .string()
    .min(1, 'El teléfono es obligatorio')
    .min(7, 'El teléfono debe tener al menos 7 dígitos'),
  address: z.string().optional(),
  city: z.string().optional(),
  department: z.string().optional(),
});

export type QuickDebtorFormData = z.infer<typeof createDebtorQuickSchema>;

interface CreateDebtorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatingDebtor: boolean;
  onSubmit: (data: QuickDebtorFormData) => Promise<string | null>;
}

export function CreateDebtorDialog({
  open,
  onOpenChange,
  creatingDebtor,
  onSubmit,
}: Readonly<CreateDebtorDialogProps>) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuickDebtorFormData>({
    resolver: zodResolver(createDebtorQuickSchema),
    // 'onTouched' y no 'onBlur': valida al salir del campo y, desde ahí,
    // en cada cambio, así el error se va mientras el usuario lo corrige.
    mode: 'onTouched',
    defaultValues: {
      name: '',
      idNumber: '',
      email: '',
      phone: '',
      address: '',
      city: 'Bogotá',
      department: 'Cundinamarca',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: '',
        idNumber: '',
        email: '',
        phone: '',
        address: '',
        city: 'Bogotá',
        department: 'Cundinamarca',
      });
      setServerError(null);
    }
  }, [open, reset]);

  const onValid = async (data: QuickDebtorFormData) => {
    setServerError(null);
    const error = await onSubmit(data);
    if (error) {
      setServerError(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Deudor</DialogTitle>
          <DialogDescription>
            Ingrese la información básica del deudor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onValid)} className="grid gap-4 py-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorName">
              Nombre completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newDebtorName"
              placeholder="Nombre completo"
              className={
                errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''
              }
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Cédula */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorId">
              Cédula <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newDebtorId"
              placeholder="Número de cédula"
              inputMode="numeric"
              className={
                errors.idNumber
                  ? 'border-red-500 focus-visible:ring-red-500'
                  : ''
              }
              {...register('idNumber')}
            />
            {errors.idNumber && (
              <p className="text-sm text-red-500">{errors.idNumber.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorEmail">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newDebtorEmail"
              type="email"
              placeholder="correo@ejemplo.com"
              className={
                errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
              }
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorPhone">
              Teléfono <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newDebtorPhone"
              placeholder="+57 300 123-4567"
              inputMode="tel"
              className={
                errors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''
              }
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Dirección (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorAddress">Dirección</Label>
            <Input
              id="newDebtorAddress"
              placeholder="Calle 45 #12-34"
              {...register('address')}
            />
          </div>

          {/* Ciudad y Departamento en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorCity">Ciudad</Label>
              <Input
                id="newDebtorCity"
                placeholder="Bogotá"
                {...register('city')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorDept">Departamento</Label>
              <Input
                id="newDebtorDept"
                placeholder="Cundinamarca"
                {...register('department')}
              />
            </div>
          </div>

          <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:gap-0">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={creatingDebtor}
              className="w-full sm:w-auto"
            >
              {creatingDebtor ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Deudor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
