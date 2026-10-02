'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import { addDebtToCase, removeDebtFromCase } from '@/features/case/actions';
import {
  addDebtToCaseSchema,
  type AddDebtToCaseData,
  type CreditorOption,
  type FormDebt,
} from '@/features/case/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface DebtsTabProps {
  caseId: string;
  creditors: CreditorOption[];
}

const DEBT_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'HIPOTECARIA', label: 'Hipotecaria' },
  { value: 'VEHICULAR', label: 'Vehicular' },
  { value: 'PRENDARIA', label: 'Prendaria' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito' },
  { value: 'IMPUESTOS', label: 'Impuestos' },
  { value: 'LABORAL', label: 'Laboral' },
  { value: 'OTRA', label: 'Otra' },
];

const getDebtTypeLabel = (type: string): string =>
  DEBT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

const EMPTY_FORM = (caseId: string): AddDebtToCaseData => ({
  caseId,
  creditorId: '',
  amount: '',
  type: '',
  interestRate: '',
  creditorAddress: '',
  creditorCity: '',
  creditorEmail: '',
  capitalAmount: '',
  interestAmount: '',
  isDeferred: false,
  documentType: '',
  grantDate: '',
  dueDate: '',
  creditClassification: '',
  hasActiveLibranza: false,
  creditorClass: '',
  percentageOfTotal: '',
  daysOverdue: undefined,
  coDebtorName: '',
  coDebtorCity: '',
  coDebtorAddress: '',
  coDebtorPhone: '',
  coDebtorEmail: '',
});

export function DebtsTab({ caseId, creditors }: Readonly<DebtsTabProps>) {
  const form = useFormContext();
  const newDebtForm = useForm<AddDebtToCaseData>({
    resolver: zodResolver(addDebtToCaseSchema),
    defaultValues: EMPTY_FORM(caseId),
  });

  const [isPending, startTransition] = useTransition();

  const handleAddDebt = newDebtForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addDebtToCase(data);

      if (success && result) {
        toast.success('Deuda agregada exitosamente');
        const current = form.getValues('debts') ?? [];
        form.setValue('debts', [
          ...current,
          {
            id: result.id,
            creditor: result.creditor,
            creditorId: result.creditorId,
            amount: result.amount.toString(),
            type: result.type,
            interestRate: result.interestRate.toString(),
            creditorAddress: result.creditorAddress ?? '',
            creditorCity: result.creditorCity ?? '',
            creditorEmail: result.creditorEmail ?? '',
            capitalAmount: result.capitalAmount?.toString() ?? '',
            interestAmount: result.interestAmount?.toString() ?? '',
            isDeferred: result.isDeferred,
            documentType: result.documentType ?? '',
            grantDate: result.grantDate ?? '',
            dueDate: result.dueDate ?? '',
            creditClassification: result.creditClassification ?? '',
            hasActiveLibranza: result.hasActiveLibranza,
            creditorClass: result.creditorClass ?? '',
            percentageOfTotal: result.percentageOfTotal?.toString() ?? '',
            daysOverdue: result.daysOverdue ?? 0,
            coDebtorName: result.coDebtorName ?? '',
            coDebtorCity: result.coDebtorCity ?? '',
            coDebtorAddress: result.coDebtorAddress ?? '',
            coDebtorPhone: result.coDebtorPhone ?? '',
            coDebtorEmail: result.coDebtorEmail ?? '',
          },
        ]);
        newDebtForm.reset(EMPTY_FORM(caseId));
      } else {
        toast.error(error ?? 'Error al agregar la deuda');
      }
    });
  });

  const handleRemoveDebt = (debtId: string) => {
    startTransition(async () => {
      const {
        success,
        data: result,
        error,
      } = await removeDebtFromCase({
        debtId,
      });

      if (success && result) {
        toast.success('Deuda eliminada exitosamente');
        const current = form.getValues('debts') ?? [];
        form.setValue(
          'debts',
          current.filter((debt: FormDebt) => debt.id !== result.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar la deuda');
      }
    });
  };

  const debts = (form.watch('debts') ?? []) as FormDebt[];
  const selectedCreditorId = newDebtForm.watch('creditorId');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Acreedores y Deudas Existentes</CardTitle>
          <CardDescription>
            Para corregir un dato, elimine la deuda y agréguela de nuevo con el
            dato correcto (mismo criterio que apoderados, bienes y libranzas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {debts.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay deudas agregadas. Use el formulario abajo para agregar.
            </p>
          )}
          {debts.map((debt, index) => (
            <div
              key={debt.id}
              className="bg-muted/50 space-y-4 rounded-lg border p-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Acreedor #{index + 1}</h4>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    if (debt.id) handleRemoveDebt(debt.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Acreedor</p>
                  <p className="font-medium">{debt.creditor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monto</p>
                  <p className="font-medium">
                    ${Number(debt.amount).toLocaleString('es-CO')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{getDebtTypeLabel(debt.type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tasa de interés</p>
                  <p className="font-medium">{debt.interestRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    Clasificación del crédito
                  </p>
                  <p className="font-medium">
                    {debt.creditClassification || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Días incumplidos</p>
                  <p className="font-medium">{debt.daysOverdue ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Postergado</p>
                  <p className="font-medium">{debt.isDeferred ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Libranza activa</p>
                  <p className="font-medium">
                    {debt.hasActiveLibranza ? 'Sí' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Codeudor/Avalista</p>
                  <p className="font-medium">{debt.coDebtorName || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Nuevo Acreedor</CardTitle>
          <CardDescription>
            Complete la información detallada del acreedor y la deuda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Datos del acreedor */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              Datos del Acreedor
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Acreedor <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedCreditorId}
                  onValueChange={(value) =>
                    newDebtForm.setValue('creditorId', value)
                  }
                >
                  <SelectTrigger>
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
                {newDebtForm.formState.errors.creditorId && (
                  <p className="text-destructive text-sm">
                    {newDebtForm.formState.errors.creditorId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditorCity">Domicilio</Label>
                <Input
                  id="creditorCity"
                  {...newDebtForm.register('creditorCity')}
                  placeholder="Ciudad"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditorAddress">Dirección</Label>
                <Input
                  id="creditorAddress"
                  {...newDebtForm.register('creditorAddress')}
                  placeholder="Dirección completa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditorEmail">Email</Label>
                <Input
                  id="creditorEmail"
                  type="email"
                  {...newDebtForm.register('creditorEmail')}
                  placeholder="correo@acreedor.com"
                />
              </div>
            </div>
          </div>

          {/* Cuantía y detalles de la deuda */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              Cuantía y Detalles de la Deuda
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Monto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  {...newDebtForm.register('amount')}
                  placeholder="0"
                />
                {newDebtForm.formState.errors.amount && (
                  <p className="text-destructive text-sm">
                    {newDebtForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="capitalAmount">Cuantía - Capital</Label>
                <Input
                  id="capitalAmount"
                  type="number"
                  {...newDebtForm.register('capitalAmount')}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestAmount">Cuantía - Intereses</Label>
                <Input
                  id="interestAmount"
                  type="number"
                  {...newDebtForm.register('interestAmount')}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">
                  Tasa de Interés (%) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  {...newDebtForm.register('interestRate')}
                  placeholder="0.00"
                />
                {newDebtForm.formState.errors.interestRate && (
                  <p className="text-destructive text-sm">
                    {newDebtForm.formState.errors.interestRate.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Tipo de Deuda <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={newDebtForm.watch('type')}
                  onValueChange={(value) => newDebtForm.setValue('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEBT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newDebtForm.formState.errors.type && (
                  <p className="text-destructive text-sm">
                    {newDebtForm.formState.errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditClassification">
                  Clasificación del Crédito
                </Label>
                <Input
                  id="creditClassification"
                  {...newDebtForm.register('creditClassification')}
                  placeholder="Ej: Quirografario"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditorClass">Clase</Label>
                <Input
                  id="creditorClass"
                  {...newDebtForm.register('creditorClass')}
                  placeholder="Ej: Financiero"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="percentageOfTotal">% Acreencia</Label>
                <Input
                  id="percentageOfTotal"
                  type="number"
                  step="0.01"
                  {...newDebtForm.register('percentageOfTotal')}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="daysOverdue">Días Incumplidos</Label>
                <Input
                  id="daysOverdue"
                  type="number"
                  {...newDebtForm.register('daysOverdue', {
                    valueAsNumber: true,
                  })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType">Documento en que Consta</Label>
                <Input
                  id="documentType"
                  {...newDebtForm.register('documentType')}
                  placeholder="Ej: Pagaré, Contrato"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grantDate">Fecha Otorgamiento</Label>
                <Input
                  id="grantDate"
                  type="date"
                  {...newDebtForm.register('grantDate')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Fecha Vencimiento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  {...newDebtForm.register('dueDate')}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={newDebtForm.watch('isDeferred') ?? false}
                  onCheckedChange={(checked) =>
                    newDebtForm.setValue('isDeferred', checked === true)
                  }
                />
                <Label className="cursor-pointer font-normal">Postergado</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={newDebtForm.watch('hasActiveLibranza') ?? false}
                  onCheckedChange={(checked) =>
                    newDebtForm.setValue('hasActiveLibranza', checked === true)
                  }
                />
                <Label className="cursor-pointer font-normal">
                  Libranza Activa
                </Label>
              </div>
            </div>
          </div>

          {/* Codeudor / Avalista */}
          <div className="space-y-4">
            <h4 className="text-foreground border-b pb-2 text-sm font-medium">
              Información Codeudor/Avalista
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="coDebtorName">Nombre</Label>
                <Input
                  id="coDebtorName"
                  {...newDebtForm.register('coDebtorName')}
                  placeholder="Nombre del codeudor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coDebtorCity">Domicilio</Label>
                <Input
                  id="coDebtorCity"
                  {...newDebtForm.register('coDebtorCity')}
                  placeholder="Ciudad"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coDebtorAddress">Dirección</Label>
                <Input
                  id="coDebtorAddress"
                  {...newDebtForm.register('coDebtorAddress')}
                  placeholder="Dirección completa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coDebtorPhone">Teléfono</Label>
                <Input
                  id="coDebtorPhone"
                  type="tel"
                  {...newDebtForm.register('coDebtorPhone')}
                  placeholder="Ej: 3101234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coDebtorEmail">Correo electrónico</Label>
                <Input
                  id="coDebtorEmail"
                  type="email"
                  {...newDebtForm.register('coDebtorEmail')}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleAddDebt}
            disabled={isPending}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isPending ? 'Guardando...' : 'Guardar Deuda'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
