'use client';

import { Plus, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FormDebt, CreditorOption } from '@/features/case/schemas';
import { parseCurrencyInput } from '@/lib/utils';

interface CreditorsSectionProps {
  creditors: CreditorOption[];
  newDebt: {
    creditor: string;
    creditorId?: string;
    amount: string;
    type: string;
    interestRate: string;
  };
  debts: FormDebt[];
  onNewDebtChange: (debt: {
    creditor: string;
    creditorId?: string;
    amount: string;
    type: string;
    interestRate: string;
  }) => void;
  onAddDebt: () => void;
  onRemoveDebt: (debtId: string) => void;
  isLoading?: boolean;
}

const getDebtTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    PERSONAL: 'Personal',
    HIPOTECARIA: 'Hipotecaria',
    VEHICULAR: 'Vehicular',
    TARJETA_CREDITO: 'Tarjeta de Crédito',
    OTRA: 'Otra',
  };
  return labels[type] ?? type;
};

export function CreditorsSection({
  creditors,
  newDebt,
  debts,
  onNewDebtChange,
  onAddDebt,
  onRemoveDebt,
  isLoading = false,
}: Readonly<CreditorsSectionProps>) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Acreedores y Deudas</CardTitle>
        <CardDescription>
          Información sobre los acreedores y las deudas del deudor
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-2">
              <Select
                value={newDebt.creditorId ?? ''}
                onValueChange={(value) => {
                  const creditor = creditors.find((c) => c.id === value);
                  if (creditor) {
                    onNewDebtChange({
                      ...newDebt,
                      creditor: creditor.name,
                      creditorId: creditor.id,
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar acreedor" />
                </SelectTrigger>
                <SelectContent>
                  {creditors.map((creditor) => (
                    <SelectItem key={creditor.id} value={creditor.id}>
                      {creditor.name} - NIT: {creditor.nit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <span className="absolute top-1/2 left-3 z-10 -translate-y-1/2 text-gray-500">
                $
              </span>
              <Input
                placeholder="Monto"
                type="text"
                value={
                  newDebt.amount
                    ? Number(newDebt.amount).toLocaleString('es-CO')
                    : ''
                }
                onChange={(e) => {
                  const value = parseCurrencyInput(e.target.value);
                  onNewDebtChange({ ...newDebt, amount: value });
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={newDebt.type}
              onValueChange={(value) =>
                onNewDebtChange({ ...newDebt, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de deuda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSONAL">Personal</SelectItem>
                <SelectItem value="HIPOTECARIA">Hipotecaria</SelectItem>
                <SelectItem value="VEHICULAR">Vehicular</SelectItem>
                <SelectItem value="TARJETA_CREDITO">
                  Tarjeta de Crédito
                </SelectItem>
                <SelectItem value="OTRA">Otra</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Tasa %"
              type="number"
              step="0.01"
              value={newDebt.interestRate}
              onChange={(e) =>
                onNewDebtChange({
                  ...newDebt,
                  interestRate: e.target.value,
                })
              }
            />
            <Button
              onClick={onAddDebt}
              size="sm"
              disabled={!newDebt.creditor || !newDebt.amount || isLoading}
              className="whitespace-nowrap"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isLoading ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
        </div>

        {debts.length === 0 ? (
          <div className="text-muted-foreground mt-8 text-center text-sm">
            <p>No se han agregado deudas aún.</p>
            <p>
              Seleccione un acreedor y complete los detalles para agregar una
              deuda.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acreedor</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Tipo de Deuda</TableHead>
                  <TableHead>Tasa de Interés</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => (
                  <TableRow key={debt.id}>
                    <TableCell>{debt.creditor}</TableCell>
                    <TableCell>
                      ${Number(debt.amount).toLocaleString('es-CO')}
                    </TableCell>
                    <TableCell>{getDebtTypeLabel(debt.type)}</TableCell>
                    <TableCell>{debt.interestRate}%</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        onClick={() => {
                          if (debt.id) onRemoveDebt(debt.id);
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
