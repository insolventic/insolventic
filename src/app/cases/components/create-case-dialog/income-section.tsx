'use client';

import { useFormContext } from 'react-hook-form';
import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export function IncomeSection() {
  const form = useFormContext();

  const monthlyIncome = form.watch('monthlyIncome') || 0;
  const otherIncomeAmount = form.watch('otherIncomeAmount') || 0;

  useEffect(() => {
    const total = Number(monthlyIncome) + Number(otherIncomeAmount);
    form.setValue('totalIncome', total);
  }, [monthlyIncome, otherIncomeAmount, form]);

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
              value={Number(monthlyIncome) + Number(otherIncomeAmount)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-2">
          <Checkbox
            id="hasEmployerCertification"
            checked={form.watch('hasEmployerCertification')}
            onCheckedChange={(checked) =>
              form.setValue('hasEmployerCertification', checked as boolean)
            }
          />
          <Label htmlFor="hasEmployerCertification" className="cursor-pointer">
            Certificación de Empleador (Obligatorio si aplica)
          </Label>
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
              value={Number(monthlyIncome) + Number(otherIncomeAmount)}
            />
          </div>
          <div className="space-y-2">
            <Label>Gasto Mensual</Label>
            <Input
              type="number"
              readOnly
              className="bg-muted"
              value={form.watch('monthlyExpenses') || 0}
            />
          </div>
          <div className="space-y-2">
            <Label>Disponible</Label>
            <Input
              type="number"
              readOnly
              className="bg-muted font-bold"
              value={
                Number(monthlyIncome) +
                Number(otherIncomeAmount) -
                Number(form.watch('monthlyExpenses') || 0)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
