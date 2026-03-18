'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
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
import type { NewDebtorForm } from '@/features/case/schemas';

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

type QuickDebtorFormData = z.infer<typeof createDebtorQuickSchema>;

interface CreateDebtorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newDebtorForm: NewDebtorForm;
  creatingDebtor: boolean;
  onFormChange: (form: NewDebtorForm) => void;
  onSubmit: () => Promise<void>;
}

export function CreateDebtorDialog({
  open,
  onOpenChange,
  newDebtorForm,
  creatingDebtor,
  onFormChange,
  onSubmit,
}: Readonly<CreateDebtorDialogProps>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<QuickDebtorFormData>({
    resolver: zodResolver(createDebtorQuickSchema),
    mode: 'onBlur', // Validate on blur — never before the user interacts
    defaultValues: {
      name: newDebtorForm.name,
      idNumber: newDebtorForm.idNumber,
      email: newDebtorForm.email,
      phone: newDebtorForm.phone,
      address: newDebtorForm.address,
      city: newDebtorForm.city || 'Bogotá',
      department: newDebtorForm.department || 'Cundinamarca',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset({
        name: newDebtorForm.name,
        idNumber: newDebtorForm.idNumber,
        email: newDebtorForm.email,
        phone: newDebtorForm.phone,
        address: newDebtorForm.address,
        city: newDebtorForm.city || 'Bogotá',
        department: newDebtorForm.department || 'Cundinamarca',
      });
    }
  }, [open, newDebtorForm, reset]);

  // Sync internal form → parent state on every change
  const syncToParent = (field: keyof QuickDebtorFormData, value: string) => {
    onFormChange({ ...newDebtorForm, [field]: value });
  };

  const onValid = async () => {
    // When react-hook-form passes validation, call parent submit
    await onSubmit();
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
              {...register('name', {
                onChange: (e) => syncToParent('name', e.target.value),
              })}
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
              {...register('idNumber', {
                onChange: (e) => syncToParent('idNumber', e.target.value),
              })}
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
              {...register('email', {
                onChange: (e) => syncToParent('email', e.target.value),
              })}
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
              {...register('phone', {
                onChange: (e) => syncToParent('phone', e.target.value),
              })}
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
              {...register('address', {
                onChange: (e) => syncToParent('address', e.target.value),
              })}
            />
          </div>

          {/* Ciudad y Departamento en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorCity">Ciudad</Label>
              <Input
                id="newDebtorCity"
                placeholder="Bogotá"
                {...register('city', {
                  onChange: (e) => syncToParent('city', e.target.value),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorDept">Departamento</Label>
              <Input
                id="newDebtorDept"
                placeholder="Cundinamarca"
                {...register('department', {
                  onChange: (e) => syncToParent('department', e.target.value),
                })}
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
