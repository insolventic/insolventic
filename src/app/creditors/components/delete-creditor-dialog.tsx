'use client';

import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTransition } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Separator } from '@/components/ui/separator';
import { deleteCreditor } from '@/features/creditor/actions';

import type { Creditor } from '@/features/creditor/schemas';

interface DeleteCreditorDialogProps {
  creditor: Creditor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreditorDeleted?: () => void;
}

export function DeleteCreditorDialog({
  creditor,
  open,
  onOpenChange,
  onCreditorDeleted,
}: Readonly<DeleteCreditorDialogProps>) {
  const [isPending, startTransition] = useTransition();

  if (!creditor) return null;

  const canDelete = true;

  const handleDelete = () => {
    startTransition(async () => {
      const { success, error } = await deleteCreditor({ id: creditor.id });

      if (success) {
        toast.success('Acreedor eliminado exitosamente', {
          description: `El acreedor ${creditor.name} ha sido eliminado correctamente`,
        });
        onOpenChange(false);
        onCreditorDeleted?.();
      } else {
        toast.error(error || 'Error al eliminar el acreedor');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Eliminar Acreedor
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Por favor revise la información
            antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 space-y-3 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{creditor.name}</p>
              <Badge variant="outline">{creditor.type}</Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">NIT</p>
                <p className="font-medium">{creditor.nit}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Representante</p>
                <p className="font-medium">{creditor.representative}</p>
              </div>
            </div>
          </div>

          {canDelete && (
            <Alert>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle>¿Está seguro de eliminar este acreedor?</AlertTitle>
              <AlertDescription>
                Esta acción eliminará permanentemente el acreedor y toda su
                información asociada. Esta operación no se puede deshacer.
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
            type="button"
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
              'Eliminar Acreedor'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
