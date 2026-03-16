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
import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { updateUser } from '@/features/user/actions';
import { userSchema } from '@/features/user/schemas';

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface EditUserDialogProps extends React.ComponentProps<typeof Dialog> {
  user: User;
  roles: Role[];
}

export function EditUserDialog({
  user,
  roles,
  onOpenChange,
  ...props
}: Readonly<EditUserDialogProps>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    clearErrors,
  } = useForm({
    resolver: zodResolver(
      userSchema.omit({
        role: true,
        lastLogin: true,
        createdDate: true,
        assignedCases: true,
        password: true,
      }),
    ),
    defaultValues: {
      id: user?.id ?? '',
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: user?.address ?? '',
      roleId: user?.roleId ?? '',
      professionalCard: user?.professionalCard ?? '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleUpdate = async (data: unknown) => {
    startTransition(async () => {
      const { success, data: updatedUser, error } = await updateUser(data);

      if (success && updatedUser) {
        clearErrors();
        toast.success('Usuario actualizado exitosamente', {
          description: `El usuario ${updatedUser.name} ha sido actualizado correctamente`,
        });
        onOpenChange?.(false);
      } else {
        const message = error || 'Error al actualizar el usuario';
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

  useEffect(() => {
    if (user) {
      reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        address: user?.address ?? '',
        roleId: user?.roleId ?? '',
        professionalCard: user?.professionalCard ?? '',
      });
    }
  }, [user, reset]);

  const watchedRoleId = watch('roleId');
  const selectedRole = roles.find((r) => r.id === watchedRoleId);

  if (!user) return null;

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifique la información del usuario {user?.name ?? 'N/A'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleUpdate)} className="space-y-4">
          <input type="hidden" {...register('id')} value={user.id} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <div className="relative">
                <UserIcon className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="name"
                  {...register('name')}
                  className={`pl-10 ${errors.name ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
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
                <Input id="phone" {...register('phone')} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="professionalCard">Tarjeta Profesional</Label>
              <div className="relative">
                <CreditCard className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  id="professionalCard"
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
              <Input id="address" {...register('address')} className="pl-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <div className="relative">
                <Shield className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Select
                  value={watch('roleId')}
                  onValueChange={(value) => setValue('roleId', value)}
                >
                  <SelectTrigger
                    className={`pl-10 ${errors.roleId ? 'border-red-500' : ''}`}
                  >
                    <SelectValue />
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
          </div>

          {selectedRole && (
            <div className="rounded-lg border bg-green-50 p-4">
              <h3 className="mb-2 font-medium">
                Permisos del Rol: {selectedRole?.name ?? 'N/A'}
              </h3>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {(selectedRole?.permissions ?? []).map((permission: string) => (
                  <li key={permission} className="flex items-center">
                    <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-muted rounded-lg border p-4">
            <h3 className="mb-2 font-medium">Información del Sistema</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Casos Asignados:</p>
                <p className="font-medium">{user?.assignedCases.length ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Último Acceso:</p>
                <p className="font-medium">
                  {!user?.lastLogin
                    ? 'Nunca'
                    : new Date(user.lastLogin).toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha de Creación:</p>
                <p className="font-medium">
                  {user?.createdDate
                    ? new Date(user.createdDate).toLocaleDateString('es-CO')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

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
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
