'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormField,
  FormItem,
  FormControl,
} from '@/components/ui/form';

export function IncomeSection() {
  const form = useFormContext();

  // useWatch es más eficiente que form.watch() porque solo re-renderiza cuando estos campos cambian
  const monthlyIncome = useWatch({ control: form.control, name: 'monthlyIncome' }) || 0;
  const otherIncomeAmount = useWatch({ control: form.control, name: 'otherIncomeAmount' }) || 0;
  const monthlyExpenses = useWatch({ control: form.control, name: 'monthlyExpenses' }) || 0;

  // Valores calculados con useMemo - NO usar setValue para valores derivados
  const totalIncome = useMemo(() => Number(monthlyIncome) + Number(otherIncomeAmount), [monthlyIncome, otherIncomeAmount]);
  const availableIncome = useMemo(() => totalIncome - Number(monthlyExpenses), [totalIncome, monthlyExpenses]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-medium">Ingresos</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyIncome">
              Declaro bajo juramento que mi ingreso es:
            </Label>
            <Input
              id="monthlyIncome"
              type="number"
              step="0.01"
              {...form.register('monthlyIncome', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherIncomeDescription">
              Otros Ingresos (¿Cuáles?)
            </Label>
            <Input
              id="otherIncomeDescription"
              type="text"
              {...form.register('otherIncomeDescription')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherIncomeAmount">Valor Otros Ingresos</Label>
            <Input
              id="otherIncomeAmount"
              type="number"
              step="0.01"
              {...form.register('otherIncomeAmount', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalIncome">Total Ingresos</Label>
            <Input
              id="totalIncome"
              type="number"
              step="0.01"
              readOnly
              className="bg-muted"
              value={totalIncome}
            />
          </div>
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="hasEmployerCertification"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="hasEmployerCertification"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <Label htmlFor="hasEmployerCertification" className="cursor-pointer">
                  Certificación de Empleador (Obligatorio si aplica)
                </Label>
              </FormItem>
            )}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium">Gastos Mensuales</h3>
        <div className="space-y-2">
          <Label htmlFor="monthlyExpenses">
            Valor Total de Gastos Mensuales
          </Label>
          <Input
            id="monthlyExpenses"
            type="number"
            step="0.01"
            {...form.register('monthlyExpenses', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium">Recursos Disponibles</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Ingresos</Label>
            <Input
              type="number"
              readOnly
              className="bg-muted"
              value={totalIncome}
            />
          </div>
          <div className="space-y-2">
            <Label>Gasto Mensual</Label>
            <Input
              type="number"
              readOnly
              className="bg-muted"
              value={monthlyExpenses}
            />
          </div>
          <div className="space-y-2">
            <Label>Disponible</Label>
            <Input
              type="number"
              readOnly
              className="bg-muted font-bold"
              value={availableIncome}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
