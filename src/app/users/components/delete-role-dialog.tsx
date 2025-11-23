'use client';

import { AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTransition } from 'react';

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
import { deleteRole } from '@/features/role/actions';

import type { Role } from '@/features/role/schemas';

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  onRoleDeleted?: () => void;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
  onRoleDeleted,
}: Readonly<DeleteRoleDialogProps>) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const { success, data, error } = await deleteRole(role.id);

      if (success && data) {
        toast.success('Rol eliminado exitosamente', {
          description: `El rol ${data.name} ha sido eliminado correctamente`,
        });
        onOpenChange(false);
        onRoleDeleted?.();
      } else {
        toast.error(error || 'Error al eliminar el rol');
      }
    });
  };

  const canDelete = role.users.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Eliminar Rol</span>
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. El rol será eliminado
            permanentemente del sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{role.name}</h3>
              <p className="text-sm text-gray-600">{role.description}</p>
              <p className="mt-1 text-xs text-gray-500">
                {role.users.length} usuario{role.users.length !== 1 ? 's' : ''}{' '}
                con este rol
              </p>
            </div>
          </div>

          {!canDelete && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="font-medium text-yellow-800">
                    No se puede eliminar este rol
                  </h4>
                  <p className="mt-1 text-sm text-yellow-700">
                    Este rol tiene {role.users.length} usuario
                    {role.users.length > 1 ? 's' : ''} asignado
                    {role.users.length > 1 ? 's' : ''}. No se puede eliminar un
                    rol con usuarios activos.
                  </p>
                  <p className="mt-2 text-sm text-yellow-700">
                    Reasigne los usuarios a otro rol antes de eliminar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {canDelete && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start space-x-2">
                <Shield className="mt-0.5 h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-800">
                    Confirmar eliminación
                  </h4>
                  <p className="mt-1 text-sm text-red-700">
                    ¿Está seguro de que desea eliminar el rol{' '}
                    <strong>{role.name}</strong>?
                  </p>
                  <p className="mt-2 text-sm text-red-700">
                    Esta acción eliminará permanentemente:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    <li>• La configuración del rol</li>
                    <li>• Los permisos asociados</li>
                    <li>• El historial del rol</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar Rol'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
