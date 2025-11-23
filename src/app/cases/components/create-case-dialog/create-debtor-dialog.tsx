'use client';

import { Loader2 } from 'lucide-react';

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
import type { NewDebtorForm } from '@/features/case/schemas';

interface CreateDebtorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newDebtorForm: NewDebtorForm;
  creatingDebtor: boolean;
  onFormChange: (form: NewDebtorForm) => void;
  onSubmit: () => Promise<void>;
}

export function CreateDebtorDialog({
  open,
  onOpenChange,
  newDebtorForm,
  creatingDebtor,
  onFormChange,
  onSubmit,
}: Readonly<CreateDebtorDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Deudor</DialogTitle>
          <DialogDescription>
            Ingrese la información básica del deudor
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newDebtorName" className="text-right">
              Nombre
            </Label>
            <Input
              id="newDebtorName"
              placeholder="Nombre completo"
              className="col-span-3"
              value={newDebtorForm.name}
              onChange={(e) =>
                onFormChange({ ...newDebtorForm, name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newDebtorId" className="text-right">
              Cédula
            </Label>
            <Input
              id="newDebtorId"
              placeholder="Número de cédula"
              className="col-span-3"
              value={newDebtorForm.idNumber}
              onChange={(e) =>
                onFormChange({ ...newDebtorForm, idNumber: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newDebtorEmail" className="text-right">
              Email
            </Label>
            <Input
              id="newDebtorEmail"
              type="email"
              placeholder="correo@ejemplo.com"
              className="col-span-3"
              value={newDebtorForm.email}
              onChange={(e) =>
                onFormChange({ ...newDebtorForm, email: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newDebtorPhone" className="text-right">
              Teléfono
            </Label>
            <Input
              id="newDebtorPhone"
              placeholder="+57 300 123-4567"
              className="col-span-3"
              value={newDebtorForm.phone}
              onChange={(e) =>
                onFormChange({ ...newDebtorForm, phone: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newDebtorAddress" className="text-right">
              Dirección
            </Label>
            <Input
              id="newDebtorAddress"
              placeholder="Calle 45 #12-34"
              className="col-span-3"
              value={newDebtorForm.address}
              onChange={(e) =>
                onFormChange({ ...newDebtorForm, address: e.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => {
              void onSubmit();
            }}
            disabled={creatingDebtor}
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
      </DialogContent>
    </Dialog>
  );
}
