'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { deleteDebtor } from '@/features/debtor/actions';

import type { Debtor } from '@/features/debtor/schemas';

interface DeleteDebtorDialogProps {
  debtor: Debtor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebtorDeleted?: () => void;
}

export function DeleteDebtorDialog({
  debtor,
  open,
  onOpenChange,
  onDebtorDeleted,
}: Readonly<DeleteDebtorDialogProps>) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      const { success, data: debtor, error } = await deleteDebtor(id);

      if (success && debtor) {
        toast.success('Deudor eliminado exitosamente', {
          description: `El deudor ${debtor.name} ha sido eliminado correctamente`,
        });
        onOpenChange(false);
        onDebtorDeleted?.();
      } else {
        toast.error(error || 'Error al eliminar el deudor');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Eliminar Deudor</DialogTitle>
          <DialogDescription>
            ¿Está seguro de que desea eliminar este deudor?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente
              los datos del deudor
              <strong className="mt-2 block">{debtor.name}</strong>
            </AlertDescription>
          </Alert>

          {debtor.activeCases > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Este deudor tiene{' '}
                <strong>{debtor.activeCases} casos activos</strong>. Asegúrese
                de reasignar o cerrar estos casos antes de eliminar el deudor.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => handleDelete(debtor.id)}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
