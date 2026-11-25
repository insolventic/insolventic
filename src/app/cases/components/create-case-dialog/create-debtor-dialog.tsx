'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
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

// Validation schema with clear, specific Spanish messages.
//
// Dirección, ciudad y departamento son obligatorios con los mismos mensajes
// que `debtorSchema` (src/features/debtor/schemas.ts). Antes la dirección era
// opcional aquí y obligatoria en el servidor: el diálogo dejaba enviar sin
// ella y el rechazo llegaba del servidor, no bajo el campo.
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
  address: z.string().min(1, 'La dirección es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  department: z.string().min(1, 'El departamento es requerido'),
});

export type QuickDebtorFormData = z.infer<typeof createDebtorQuickSchema>;

const CAMPOS = Object.keys(
  createDebtorQuickSchema.shape,
) as (keyof QuickDebtorFormData)[];

/** Lo que devuelve `onSubmit` cuando el alta falla. */
export interface ErrorAlCrearDeudor {
  /** Mensaje legible (nunca el JSON de un error de validación). */
  error: string;
  /** Error por campo, tal como lo devuelve `createDebtor`. */
  fieldErrors?: Record<string, string>;
}

interface CreateDebtorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatingDebtor: boolean;
  onSubmit: (data: QuickDebtorFormData) => Promise<ErrorAlCrearDeudor | null>;
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
    getValues,
    setValue,
    setError,
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
    const fallo = await onSubmit(data);
    if (!fallo) return;

    // El error de un campo del formulario va bajo ese campo; lo demás, a la
    // alerta, como texto.
    let ligados = 0;
    for (const [campo, mensaje] of Object.entries(fallo.fieldErrors ?? {})) {
      if ((CAMPOS as string[]).includes(campo)) {
        setError(
          campo as keyof QuickDebtorFormData,
          { type: 'server', message: mensaje },
          { shouldFocus: ligados === 0 },
        );
        ligados++;
      }
    }
    if (ligados === 0) setServerError(fallo.error);
  };

  /**
   * Lo que se ve es lo que se envía. Los campos son no controlados
   * (`register`) y `handleSubmit` valida los valores que registró `onChange`.
   * Un autocompletado que rellena el campo sin disparar `input` (algunos
   * navegadores y gestores de contraseñas) dejaba el campo lleno a la vista y
   * vacío en el formulario: "La dirección es requerida" con la dirección
   * escrita. Antes de validar, se copia el valor del DOM a cada campo que
   * difiera.
   *
   * Todos los campos llevan `autoComplete="off"`: son datos del deudor, no
   * del operador, y el navegador no debe sugerir los datos personales de
   * quien está usando el sistema. Algunos navegadores autocompletan igual
   * (sobre todo direcciones); esta sincronización cubre esos casos.
   */
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    const enElDom = new FormData(e.currentTarget);
    for (const campo of CAMPOS) {
      const valor = enElDom.get(campo);
      if (typeof valor === 'string' && valor !== (getValues(campo) ?? '')) {
        setValue(campo, valor, { shouldDirty: true });
      }
    }
    return handleSubmit(onValid)(e);
  };

  const conError = (campo: keyof QuickDebtorFormData) =>
    errors[campo] ? 'border-red-500 focus-visible:ring-red-500' : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Deudor</DialogTitle>
          <DialogDescription>
            Ingrese la información básica del deudor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4 py-4">
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
              autoComplete="off"
              className={conError('name')}
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
              autoComplete="off"
              className={conError('idNumber')}
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
              autoComplete="off"
              className={conError('email')}
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
              autoComplete="off"
              className={conError('phone')}
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label htmlFor="newDebtorAddress">
              Dirección <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newDebtorAddress"
              placeholder="Calle 45 #12-34"
              autoComplete="off"
              className={conError('address')}
              {...register('address')}
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* Ciudad y Departamento en grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorCity">
                Ciudad <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newDebtorCity"
                placeholder="Bogotá"
                autoComplete="off"
                className={conError('city')}
                {...register('city')}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newDebtorDept">
                Departamento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newDebtorDept"
                placeholder="Cundinamarca"
                autoComplete="off"
                className={conError('department')}
                {...register('department')}
              />
              {errors.department && (
                <p className="text-sm text-red-500">
                  {errors.department.message}
                </p>
              )}
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
