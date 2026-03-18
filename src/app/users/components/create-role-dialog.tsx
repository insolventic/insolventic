'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useEffect, useState, useTransition } from 'react';

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
import { createRole } from '@/features/role/actions';
import { getAllPermissions } from '@/features/permission/actions';
import { createRoleSchema } from '@/features/role/schemas';
import type { Permission } from '@/features/permission/schemas';
import { MODULES } from '@/lib/permissions';
import type { ModuleDefinition } from '@/lib/permissions';

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleCreated?: () => void;
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  onRoleCreated,
}: Readonly<CreateRoleDialogProps>) {
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
      color: 'bg-muted text-foreground',
    },
  });

  const [isPending, startTransition] = useTransition();
  const [availablePermissions, setAvailablePermissions] = useState<
    Permission[]
  >([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const handleCreateRole = async (data: unknown) => {
    startTransition(async () => {
      const { success, data: role, error } = await createRole(data);

      if (success && role) {
        toast.success('Rol creado exitosamente', {
          description: `El rol ${role.name} ha sido creado correctamente`,
        });
        reset();
        onOpenChange(false);
        onRoleCreated?.();
      } else {
        toast.error(error || 'Error al crear el rol');
      }
    });
  };

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
    {
      value: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      label: 'Rojo',
      preview: 'bg-red-100',
    },
    {
      value: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      label: 'Azul',
      preview: 'bg-blue-100',
    },
    {
      value:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      label: 'Verde',
      preview: 'bg-green-100',
    },
    {
      value:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      label: 'Amarillo',
      preview: 'bg-yellow-100',
    },
    {
      value:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      label: 'Morado',
      preview: 'bg-purple-100',
    },
    {
      value: 'bg-muted text-foreground',
      label: 'Gris',
      preview: 'bg-muted',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] w-[95vw] flex-col sm:max-w-2xl md:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Rol</DialogTitle>
          <DialogDescription>
            Configure un nuevo rol con permisos específicos
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleCreateRole)}
          className="flex flex-col gap-4 overflow-hidden"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Rol *</Label>
              <Input
                id="name"
                placeholder="Ej: Coordinador Legal"
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
                    className={`h-8 w-8 shrink-0 rounded-full border-2 ${
                      color.preview
                    } ${
                      watch('color') === color.value
                        ? 'border-foreground'
                        : 'border-border'
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
            <Textarea
              id="description"
              placeholder="Descripción del rol y sus responsabilidades"
              {...register('description')}
              rows={2}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col space-y-2">
            <Label>Permisos del Rol</Label>
            <div className="overflow-y-auto rounded-lg border p-3 sm:p-4">
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

                  const handleModuleToggle = (
                    mod: ModuleDefinition,
                    checked: boolean | 'indeterminate',
                  ) => {
                    const current = field.value || [];
                    const modulePermNames =
                      mod.permissions as readonly string[];
                    if (checked === true) {
                      // Add gate permission
                      const updated = current.includes(mod.gatePermission)
                        ? current
                        : [...current, mod.gatePermission];
                      field.onChange(updated);
                    } else {
                      // Remove ALL permissions from this module
                      field.onChange(
                        current.filter(
                          (p: string) => !modulePermNames.includes(p),
                        ),
                      );
                    }
                  };

                  const handleSelectAllModule = (
                    mod: ModuleDefinition,
                    modulePerms: Permission[],
                    checked: boolean | 'indeterminate',
                  ) => {
                    const current = field.value || [];
                    const modulePermNames = modulePerms.map((p) => p.name);
                    if (checked === true) {
                      const toAdd = modulePermNames.filter(
                        (name) => !current.includes(name),
                      );
                      field.onChange([...current, ...toAdd]);
                    } else {
                      field.onChange(
                        current.filter(
                          (p: string) => !modulePermNames.includes(p),
                        ),
                      );
                    }
                  };

                  // Build module groups from MODULES config
                  const allModulePermNames = new Set(
                    Object.values(MODULES).flatMap(
                      (m) => m.permissions as readonly string[],
                    ),
                  );
                  const unmatchedPermissions = availablePermissions.filter(
                    (p) => !allModulePermNames.has(p.name),
                  );

                  return (
                    <>
                      {loadingPermissions ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground ml-2 text-sm">
                            Cargando permisos...
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.values(MODULES).map((mod) => {
                            const modulePerms = availablePermissions.filter(
                              (p) =>
                                (mod.permissions as readonly string[]).includes(
                                  p.name,
                                ),
                            );
                            if (modulePerms.length === 0) return null;

                            const hasGatePermission =
                              field.value?.includes(mod.gatePermission) ??
                              false;
                            const countSelected = modulePerms.filter((p) =>
                              field.value?.includes(p.name),
                            ).length;
                            const totalInModule = modulePerms.length;
                            const allSelected = countSelected === totalInModule;

                            return (
                              <div
                                key={mod.key}
                                className="space-y-2 rounded-lg border p-3 sm:space-y-3 sm:p-4"
                              >
                                <div className="flex items-center justify-between gap-2 border-b pb-2">
                                  <h4 className="text-foreground truncate text-sm font-semibold">
                                    {mod.label}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs">
                                      {countSelected}/{totalInModule}
                                    </span>
                                    <Checkbox
                                      checked={hasGatePermission}
                                      onCheckedChange={(checked) =>
                                        handleModuleToggle(mod, checked)
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2 pl-2">
                                  {modulePerms.length > 1 && (
                                    <div className="flex items-center space-x-2 border-b pb-2">
                                      <Checkbox
                                        id={`${mod.key}-select-all`}
                                        disabled={!hasGatePermission}
                                        checked={
                                          hasGatePermission && allSelected
                                        }
                                        onCheckedChange={(checked) =>
                                          handleSelectAllModule(
                                            mod,
                                            modulePerms,
                                            checked,
                                          )
                                        }
                                      />
                                      <Label
                                        htmlFor={`${mod.key}-select-all`}
                                        className={`cursor-pointer text-sm font-medium ${!hasGatePermission ? 'text-muted-foreground opacity-50' : ''}`}
                                      >
                                        Seleccionar todos
                                      </Label>
                                    </div>
                                  )}
                                  {modulePerms
                                    .filter(
                                      (p) => p.name !== mod.gatePermission,
                                    )
                                    .map((permission) => (
                                      <div
                                        key={permission.id}
                                        className="flex items-center space-x-2"
                                      >
                                        <Checkbox
                                          id={permission.id}
                                          disabled={!hasGatePermission}
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
                                          className={`cursor-pointer text-sm ${!hasGatePermission ? 'text-muted-foreground opacity-50' : ''}`}
                                        >
                                          {permission.name}
                                        </Label>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            );
                          })}
                          {unmatchedPermissions.length > 0 && (
                            <div className="space-y-3 rounded-lg border p-4">
                              <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="text-foreground text-sm font-semibold">
                                  Otros
                                </h4>
                                <span className="text-muted-foreground text-xs">
                                  {
                                    unmatchedPermissions.filter((p) =>
                                      field.value?.includes(p.name),
                                    ).length
                                  }
                                  /{unmatchedPermissions.length}
                                </span>
                              </div>
                              <div className="space-y-2 pl-2">
                                {unmatchedPermissions.map((permission) => (
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
            <p className="text-muted-foreground text-sm">
              Seleccionados: {watch('permissions')?.length || 0} permisos
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Rol'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
