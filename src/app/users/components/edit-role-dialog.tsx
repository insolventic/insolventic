'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { updateRole } from '@/features/role/actions';
import { getAllPermissions } from '@/features/permission/actions';
import { createRoleSchema, type Role } from '@/features/role/schemas';
import type { Permission } from '@/features/permission/schemas';

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

export function EditRoleDialog({
  open,
  onOpenChange,
  role,
}: Readonly<EditRoleDialogProps>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control,
  } = useForm({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
      color: 'bg-gray-100 text-gray-800',
    },
  });

  const [isPending, startTransition] = useTransition();
  const [availablePermissions, setAvailablePermissions] = useState<
    Permission[]
  >([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const handleUpdateRole = async (data: unknown) => {
    startTransition(async () => {
      const updateData = { ...(data as Record<string, unknown>), id: role.id };
      const {
        success,
        data: updatedRole,
        error,
      } = await updateRole(updateData);

      if (success && updatedRole) {
        toast.success('Rol actualizado exitosamente', {
          description: `El rol ${updatedRole.name} ha sido actualizado correctamente`,
        });
        onOpenChange(false);
      } else {
        toast.error(error || 'Error al actualizar el rol');
      }
    });
  };

  useEffect(() => {
    reset({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      color: role.color,
    });
  }, [role, reset]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (open) {
        setLoadingPermissions(true);
        const { success, data, error } = await getAllPermissions();

        if (success && data) {
          setAvailablePermissions(data);
        } else {
          toast.error(error || 'Error al cargar los permisos');
        }
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [open]);

  const colorOptions = [
    { value: 'bg-red-100 text-red-800', label: 'Rojo', preview: 'bg-red-100' },
    {
      value: 'bg-blue-100 text-blue-800',
      label: 'Azul',
      preview: 'bg-blue-100',
    },
    {
      value: 'bg-green-100 text-green-800',
      label: 'Verde',
      preview: 'bg-green-100',
    },
    {
      value: 'bg-yellow-100 text-yellow-800',
      label: 'Amarillo',
      preview: 'bg-yellow-100',
    },
    {
      value: 'bg-purple-100 text-purple-800',
      label: 'Morado',
      preview: 'bg-purple-100',
    },
    {
      value: 'bg-gray-100 text-gray-800',
      label: 'Gris',
      preview: 'bg-gray-100',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editar Rol: {role.name}</DialogTitle>
          <DialogDescription>
            Modifique la configuración del rol seleccionado
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleUpdateRole)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Rol *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color del Badge</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 ${
                        color.preview
                      } ${
                        watch('color') === color.value
                          ? 'border-gray-800'
                          : 'border-gray-300'
                      }`}
                      onClick={() => setValue('color', color.value)}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label>Permisos del Rol</Label>
              <div className="rounded-lg border p-4">
                <Controller
                  name="permissions"
                  control={control}
                  render={({ field }) => {
                    const handlePermissionChange = (
                      permissionName: string,
                      checked: boolean | 'indeterminate',
                    ) => {
                      const current = field.value || [];
                      if (checked === true) {
                        field.onChange([...current, permissionName]);
                      } else {
                        field.onChange(
                          current.filter((p: string) => p !== permissionName),
                        );
                      }
                    };

                    const groupedPermissions = availablePermissions.reduce(
                      (acc, permission) => {
                        const category = permission.category;
                        if (!acc[category]) {
                          acc[category] = [];
                        }
                        acc[category].push(permission);
                        return acc;
                      },
                      {} as Record<string, typeof availablePermissions>,
                    );

                    return (
                      <>
                        {loadingPermissions ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="ml-2 text-sm text-gray-500">
                              Cargando permisos...
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Object.entries(groupedPermissions).map(
                              ([category, permissions]) => (
                                <div key={category} className="space-y-3">
                                  <h4 className="border-b border-gray-200 pb-1 text-sm font-medium text-gray-900">
                                    {category}
                                  </h4>
                                  <div className="space-y-2">
                                    {permissions.map((permission) => (
                                      <div
                                        key={permission.id}
                                        className="flex items-center space-x-2"
                                      >
                                        <Checkbox
                                          id={permission.id}
                                          checked={field.value?.includes(
                                            permission.name,
                                          )}
                                          onCheckedChange={(checked) =>
                                            handlePermissionChange(
                                              permission.name,
                                              checked,
                                            )
                                          }
                                        />
                                        <Label
                                          htmlFor={permission.id}
                                          className="cursor-pointer text-sm"
                                        >
                                          {permission.name}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </>
                    );
                  }}
                />
              </div>
              {errors.permissions && (
                <p className="text-sm text-red-500">
                  {errors.permissions.message}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Seleccionados: {watch('permissions')?.length ?? 0} permisos
              </p>
            </div>

            <div className="rounded-lg border bg-blue-50 p-4">
              <h3 className="mb-2 font-medium">Información del Rol</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Usuarios con este rol:</p>
                  <p className="font-medium">{role.users.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Permisos actuales:</p>
                  <p className="font-medium">{role.permissions.length}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
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
