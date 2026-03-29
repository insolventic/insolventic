'use client';

import {
  User,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  UserPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { useFormContext } from 'react-hook-form';
import type { DebtorOption } from '@/features/case/schemas';

interface DebtorSectionProps {
  debtors: DebtorOption[];
  selectedDebtorId: string;
  selectedDebtor: DebtorOption | null;
  insolvencyCauses: string[];
  onDebtorSelect: (debtorId: string) => void;
  onCreateDebtorClick: () => void;
  onCauseChange: (cause: string) => void;
  loading?: boolean;
}

export function DebtorSection({
  debtors,
  selectedDebtorId,
  selectedDebtor,
  insolvencyCauses,
  onDebtorSelect,
  onCreateDebtorClick,
  onCauseChange,
  loading = false,
}: Readonly<DebtorSectionProps>) {
  const form = useFormContext();
  const renderSelectContent = () => {
    if (loading) {
      return [
        <SelectItem key="loading" value="loading" disabled>
          Cargando deudores...
        </SelectItem>,
      ];
    }

    if (debtors.length === 0) {
      return [
        <SelectItem key="no-debtors" value="no-debtors" disabled>
          No hay deudores registrados
        </SelectItem>,
      ];
    }

    return debtors.map((debtor) => (
      <SelectItem key={debtor.id} value={debtor.id}>
        {debtor.name} - CC: {debtor.idNumber}
      </SelectItem>
    ));
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Información del Deudor</CardTitle>
        <CardDescription>
          Datos personales y financieros del deudor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="debtorSelect">Seleccionar Deudor</Label>
            <div className="flex gap-2">
              <Select
                value={selectedDebtorId}
                onValueChange={onDebtorSelect}
                disabled={loading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      loading
                        ? 'Cargando deudores...'
                        : 'Seleccione un deudor existente'
                    }
                  />
                </SelectTrigger>
                <SelectContent>{renderSelectContent()}</SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={onCreateDebtorClick}
                title="Crear nuevo deudor"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedDebtor && (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start space-x-3">
                    <User className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Nombre
                      </p>
                      <p className="text-base">{selectedDebtor.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CreditCard className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Cédula
                      </p>
                      <p className="text-base">{selectedDebtor.idNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Mail className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Email
                      </p>
                      <p className="text-base">{selectedDebtor.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Phone className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Teléfono
                      </p>
                      <p className="text-base">{selectedDebtor.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 md:col-span-2">
                    <MapPin className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Dirección
                      </p>
                      <p className="text-base">
                        {selectedDebtor.address}, {selectedDebtor.city},{' '}
                        {selectedDebtor.department}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <DollarSign className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Ingresos Mensuales
                      </p>
                      <p className="text-base font-semibold text-green-600 dark:text-green-400">
                        ${selectedDebtor.monthlyIncome.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <DollarSign className="mt-0.5 h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Gastos Mensuales
                      </p>
                      <p className="text-base font-semibold text-red-600">
                        $
                        {selectedDebtor.monthlyExpenses.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Caso</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="INSOLVENCY">Insolvencia</SelectItem>
                    <SelectItem value="CONCILIATION">Conciliación</SelectItem>
                    <SelectItem value="SUPPORT_AGREEMENT">
                      Acuerdo de Apoyo
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalDebt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deuda Total (calculada)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                      $
                    </span>
                    <Input
                      type="text"
                      value={
                        field.value
                          ? Number(field.value).toLocaleString('es-CO')
                          : '0'
                      }
                      readOnly
                      disabled
                      placeholder="Se calcula de los acreedores"
                      className="bg-muted cursor-not-allowed pl-8"
                    />
                  </div>
                </FormControl>
                <p className="text-muted-foreground text-xs">
                  Suma automática del capital e intereses de todos los
                  acreedores
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="causes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Causas de la Insolvencia</FormLabel>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {insolvencyCauses.map((cause) => (
                  <div key={cause} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cause-${cause}`}
                      checked={field.value?.includes(cause) ?? false}
                      onCheckedChange={() => onCauseChange(cause)}
                    />
                    <Label
                      htmlFor={`cause-${cause}`}
                      className="text-sm font-normal"
                    >
                      {cause}
                    </Label>
                  </div>
                ))}
              </div>
              {field.value?.includes('Otros') && (
                <div className="mt-3">
                  <FormField
                    control={form.control}
                    name="otherCauseDetail"
                    render={({ field: otherField }) => (
                      <FormItem>
                        <FormLabel>Especifique la otra causa</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Describa la causa de insolvencia"
                            {...otherField}
                            value={otherField.value || ''}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
