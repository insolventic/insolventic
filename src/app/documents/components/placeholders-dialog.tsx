'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AVAILABLE_PLACEHOLDERS = [
  {
    key: 'case.caseNumber',
    label: 'Número de Caso',
    placeholder: '{{numeroCaso}}',
  },
  {
    key: 'case.debtorName',
    label: 'Nombre del Deudor',
    placeholder: '{{nombreDeudor}}',
  },
  { key: 'case.type', label: 'Tipo de Caso', placeholder: '{{tipoCaso}}' },
  {
    key: 'case.status',
    label: 'Estado del Caso',
    placeholder: '{{estadoCaso}}',
  },
  {
    key: 'case.createdDate',
    label: 'Fecha de Creación',
    placeholder: '{{fechaCreacion}}',
  },
  {
    key: 'case.hearingDate',
    label: 'Fecha de Audiencia',
    placeholder: '{{fechaAudiencia}}',
  },
  { key: 'case.phase', label: 'Fase del Caso', placeholder: '{{faseCaso}}' },
  { key: 'case.tramite', label: 'Trámite', placeholder: '{{tramite}}' },
  {
    key: 'case.filingDate',
    label: 'Fecha de Radicación',
    placeholder: '{{fechaRadicacion}}',
  },
  { key: 'case.attorney', label: 'Abogado', placeholder: '{{abogado}}' },
  {
    key: 'case.owedCapital',
    label: 'Capital Adeudado',
    placeholder: '{{capitalAdeudado}}',
  },
  {
    key: 'debtor.name',
    label: 'Nombre del Deudor',
    placeholder: '{{deudorNombre}}',
  },
  {
    key: 'debtor.email',
    label: 'Email del Deudor',
    placeholder: '{{deudorEmail}}',
  },
  {
    key: 'debtor.phone',
    label: 'Teléfono del Deudor',
    placeholder: '{{deudorTelefono}}',
  },
  {
    key: 'debtor.address',
    label: 'Dirección del Deudor',
    placeholder: '{{deudorDireccion}}',
  },
  {
    key: 'debtor.city',
    label: 'Ciudad del Deudor',
    placeholder: '{{deudorCiudad}}',
  },
  {
    key: 'debtor.department',
    label: 'Departamento del Deudor',
    placeholder: '{{deudorDepartamento}}',
  },
  {
    key: 'debtor.monthlyIncome',
    label: 'Ingresos Mensuales del Deudor',
    placeholder: '{{deudorIngresosMensuales}}',
  },
  {
    key: 'debtor.monthlyExpenses',
    label: 'Gastos Mensuales del Deudor',
    placeholder: '{{deudorGastosMensuales}}',
  },
  {
    key: 'operator.name',
    label: 'Nombre del Operador',
    placeholder: '{{operadorNombre}}',
  },
  {
    key: 'operator.email',
    label: 'Email del Operador',
    placeholder: '{{operadorEmail}}',
  },
];

interface PlaceholdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaceholdersDialog({
  open,
  onOpenChange,
}: Readonly<PlaceholdersDialogProps>) {
  const copyPlaceholderToClipboard = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    toast.success(`Placeholder ${placeholder} copiado al portapapeles`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1000px] xl:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>Placeholders Disponibles</DialogTitle>
          <DialogDescription>
            Estos son los placeholders que puedes usar en tus documentos. Haz
            clic en cualquiera para copiarlo al portapapeles.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_PLACEHOLDERS.map((item) => (
            <Button
              key={item.key}
              variant="outline"
              className="h-auto justify-start p-3 text-left"
              onClick={() => copyPlaceholderToClipboard(item.placeholder)}
            >
              <div className="flex w-full items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="font-mono text-xs text-gray-500">
                    {item.placeholder}
                  </p>
                </div>
                <Copy className="ml-2 h-4 w-4 text-gray-400" />
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
