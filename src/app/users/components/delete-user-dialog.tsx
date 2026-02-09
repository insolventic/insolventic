'use client';

import { AlertTriangle, Shield, User as UserIcon, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { deleteUser } from '@/features/user/actions';

import type { User } from '@/features/user/schemas';

interface DeleteUserDialogProps extends React.ComponentProps<typeof Dialog> {
  user: User;
}

export function DeleteUserDialog({
  user,
  onOpenChange,
  ...props
}: Readonly<DeleteUserDialogProps>) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const { success, data, error } = await deleteUser(user.id);

      if (success && data) {
        toast.success('Usuario eliminado exitosamente', {
          description: `El usuario ${data.name} ha sido eliminado correctamente`,
        });
        onOpenChange?.(false);
      } else {
        toast.error(error || 'Error al eliminar el usuario');
      }
    });
  };

  const canDelete =
    user.role.name !== 'Operadora de Insolvencia' &&
    user.assignedCases.length === 0;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Operadora de Insolvencia':
        return 'bg-red-100 text-red-800';
      case 'Abogado':
        return 'bg-blue-100 text-blue-800';
      case 'Asistente Legal':
        return 'bg-green-100 text-green-800';
      case 'Secretaria':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Eliminar Usuario</span>
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. El usuario será eliminado
            permanentemente del sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <UserIcon className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{user.name}</h3>
              <p className="text-sm text-gray-600">{user.email}</p>
              <div className="mt-1 flex items-center space-x-2">
                <Badge className={getRoleColor(user.role.name)}>
                  {user.role.name}
                </Badge>
                <span className="text-xs text-gray-500">
                  {user.assignedCases.length} casos asignados
                </span>
              </div>
            </div>
          </div>

          {!canDelete && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="font-medium text-yellow-800">
                    No se puede eliminar este usuario
                  </h4>
                  <ul className="mt-1 space-y-1 text-sm text-yellow-700">
                    {user.role.name === 'Operadora de Insolvencia' && (
                      <li>
                        • No se puede eliminar al operador principal del sistema
                      </li>
                    )}
                    {user.assignedCases.length > 0 && (
                      <li>
                        • El usuario tiene {user.assignedCases.length} casos
                        asignados
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-sm text-yellow-700">
                    Reasigne los casos o cambie el rol antes de eliminar.
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
                    ¿Está seguro de que desea eliminar a{' '}
                    <strong>{user.name}</strong>? Esta acción eliminará
                    permanentemente:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-red-700">
                    <li>• Toda la información del usuario</li>
                    <li>• Historial de actividad</li>
                    <li>• Permisos y configuraciones</li>
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
              'Eliminar Usuario'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
