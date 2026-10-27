'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Loader2,
} from 'lucide-react';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useEffect, useTransition } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createUser } from '@/features/user/actions';
import { createUserSchema } from '@/features/user/schemas';

import type { Role } from '@/features/role/schemas';

interface CreateUserDialogProps extends React.ComponentProps<typeof Dialog> {
  roles: Role[];
}

export function CreateUserDialog({
  roles,
  onOpenChange,
  ...props
}: Readonly<CreateUserDialogProps>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors,
  } = useForm({
    resolver: zodResolver(createUserSchema),
    // Errores solo tras la acción del usuario: al salir de un campo o al
    // guardar, nunca al abrir.
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      roleId: '',
      professionalCard: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const { open } = props;
  // El diálogo queda montado aunque se cierre, y antes solo se reseteaba tras
  // crear con éxito: un intento fallido + cerrar dejaba los errores (y lo
  // escrito) esperando a la próxima apertura.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleCreate = async (data: unknown) => {
    startTransition(async () => {
      const { success, data: user, error } = await createUser(data);

      if (success && user) {
        clearErrors();
        toast.success('Usuario creado exitosamente', {
          description: `El usuario ${user.name} ha sido creado correctamente. Se ha enviado un email con las credenciales de acceso.`,
        });
        reset();
        onOpenChange?.(false);
      } else {
        const message = error || 'Error al crear el usuario';
        if (
          message.includes('Unique constraint failed on the fields: (`email`)')
        ) {
          toast.error('Ya existe un usuario con este email');
        } else if (message.includes('Unique constraint failed')) {
          toast.error('Ya existe un usuario con estos datos');
        } else if (message.includes('Foreign key constraint failed')) {
          toast.error('El rol seleccionado no es válido');
        } else {
          toast.error(message);
        }
      }
    });
  };

  const watchedRoleId = watch('roleId');
  const selectedRole = roles.find((r) => r.id === watchedRoleId);

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Complete la información para crear un nuevo usuario en el sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <div className="relative">
                <UserIcon className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="name"
                  placeholder="Nombre completo"
                  {...register('name')}
                  className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico *</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@constructoresdepaz.com.co"
                  {...register('email')}
                  className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="relative">
                <Phone className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="phone"
                  placeholder="+57 300 123 4567"
                  {...register('phone')}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="professionalCard">Tarjeta Profesional</Label>
              <div className="relative">
                <CreditCard className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="professionalCard"
                  placeholder="123.456"
                  {...register('professionalCard')}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <div className="relative">
              <MapPin className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                id="address"
                placeholder="Dirección completa"
                {...register('address')}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <div className="relative">
              <Shield className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Select
                value={watch('roleId')}
                onValueChange={(value) =>
                  // shouldValidate: el Select no tiene blur, y sin esto "El rol
                  // es requerido" quedaba aunque ya se hubiera elegido uno.
                  setValue('roleId', value, { shouldValidate: true })
                }
              >
                <SelectTrigger
                  className={`pl-10 ${errors.roleId ? 'border-red-500' : ''}`}
                >
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role?.id ?? ''} value={role?.id ?? ''}>
                      {role?.name ?? 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errors.roleId && (
              <p className="text-sm text-red-500">{errors.roleId.message}</p>
            )}
          </div>

          <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950">
            <div className="flex items-center">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <span className="text-green-600 dark:text-green-400">📧</span>
              </div>
              <div>
                <h3 className="font-medium text-green-800">
                  Credenciales Automáticas
                </h3>
                <p className="text-sm text-green-700">
                  Se generará una contraseña segura y se enviará por correo
                  electrónico al usuario
                </p>
              </div>
            </div>
          </div>

          {selectedRole && (
            <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950">
              <h3 className="mb-2 font-medium">
                Permisos del Rol: {selectedRole?.name ?? 'N/A'}
              </h3>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {(selectedRole?.permissions ?? []).map((permission: string) => (
                  <li key={permission} className="flex items-center">
                    <div className="mr-2 h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"></div>
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Usuario'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
