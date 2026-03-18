'use client';

import { AlertTriangle, User, Mail, Phone, Loader2 } from 'lucide-react';

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
import { deleteContact } from '@/features/contact/actions';

import type { Contact } from '@/features/contact/schemas';

interface DeleteContactDialogProps extends React.ComponentProps<typeof Dialog> {
  contact: Contact | null;
  onContactDeleted?: (deletedContactId: string) => void;
}

export function DeleteContactDialog({
  contact,
  onContactDeleted,
  onOpenChange,
  ...props
}: Readonly<DeleteContactDialogProps>) {
  const [isPending, startTransition] = useTransition();

  if (!contact) return null;

  const handleDelete = () => {
    startTransition(async () => {
      const { success, data, error } = await deleteContact({ id: contact.id });

      if (success && data) {
        toast.success('Contacto eliminado exitosamente', {
          description: `El contacto ${data.name} ha sido eliminado correctamente`,
        });
        onContactDeleted?.(data.id);
        onOpenChange?.(false);
      } else {
        toast.error(error || 'Error al eliminar el contacto');
      }
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Eliminar Contacto</span>
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. El contacto será eliminado
            permanentemente del sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <User className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{contact.name}</h3>
              <div className="mt-1 space-y-1">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3" />
                  <span>{contact.email}</span>
                </div>
                {contact.phone && (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.role && (
                  <div className="mt-1">
                    <Badge variant="outline" className="text-xs">
                      {contact.role}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-800">
                  Confirmar eliminación
                </h4>
                <p className="mt-1 text-sm text-red-700">
                  ¿Está seguro de que desea eliminar a{' '}
                  <strong>{contact.name}</strong>? Esta acción eliminará
                  permanentemente:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-red-700">
                  <li>• Toda la información del contacto</li>
                  <li>• Datos de contacto asociados</li>
                  <li>• Historial de comunicaciones</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar Contacto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
