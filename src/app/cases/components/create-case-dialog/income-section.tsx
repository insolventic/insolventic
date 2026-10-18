'use client';

import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { MoneyInput } from '@/components/ui/money-input';
import { formatearMonto, parsearMonto } from '@/features/case/monto';

export function IncomeSection() {
  const form = useFormContext();
  const [showIncomeDeclaration, setShowIncomeDeclaration] = useState(false);

  // useWatch es más eficiente que form.watch() porque solo re-renderiza cuando estos campos cambian
  const monthlyIncome =
    useWatch({ control: form.control, name: 'monthlyIncome' }) || 0;
  const otherIncomeAmount =
    useWatch({ control: form.control, name: 'otherIncomeAmount' }) || 0;
  const monthlyExpenses =
    useWatch({ control: form.control, name: 'monthlyExpenses' }) || 0;

  // Valores calculados con useMemo - NO usar setValue para valores derivados.
  // Los 3 campos vienen de MoneyInput como texto con separador de miles y/o
  // coma decimal: `parsearMonto` es el parseo correcto; `|| 0` cubre
  // vacío/parcial/inválido, que nunca debe filtrarse como NaN a la UI.
  const totalIncome = useMemo(
    () => (parsearMonto(monthlyIncome) || 0) + (parsearMonto(otherIncomeAmount) || 0),
    [monthlyIncome, otherIncomeAmount],
  );
  const availableIncome = useMemo(
    () => totalIncome - (parsearMonto(monthlyExpenses) || 0),
    [totalIncome, monthlyExpenses],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-medium">Ingresos</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyIncome">
              Declaro bajo juramento que mi ingreso es:
            </Label>
            <MoneyInput name="monthlyIncome" control={form.control} id="monthlyIncome" />
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
            <MoneyInput name="otherIncomeAmount" control={form.control} id="otherIncomeAmount" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalIncome">Total Ingresos</Label>
            <Input
              id="totalIncome"
              type="text"
              step="0.01"
              readOnly
              className="bg-muted"
              value={formatearMonto(totalIncome)}
            />
          </div>
        </div>

        <div className="mt-4">
          <FormField
            control={form.control}
            name="hasEmployerCertification"
            render={({ field }) => (
              <FormItem className="flex items-center space-y-0 space-x-2">
                <FormControl>
                  <Checkbox
                    id="hasEmployerCertification"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <Label
                  htmlFor="hasEmployerCertification"
                  className="cursor-pointer"
                >
                  Certificación de Empleador (Obligatorio si aplica)
                </Label>
              </FormItem>
            )}
          />
        </div>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowIncomeDeclaration(!showIncomeDeclaration)}
          className="mb-2"
        >
          <FileText className="mr-2 h-4 w-4" />
          Manifestación de Ingresos
        </Button>
        {showIncomeDeclaration && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
              <strong>MANIFESTACIÓN BAJO JURAMENTO:</strong> Declaro bajo la
              gravedad del juramento que los ingresos aquí relacionados
              corresponden a la totalidad de mis ingresos mensuales,
              provenientes de cualquier fuente lícita, y que no he omitido ni
              ocultado información alguna sobre mi situación económica real.
              Esta declaración se realiza en cumplimiento de lo establecido en
              la Ley 1564 de 2012 y el Decreto 2677 de 2012.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium">Gastos Mensuales</h3>
        <div className="space-y-2">
          <Label htmlFor="monthlyExpenses">
            Valor Total de Gastos Mensuales
          </Label>
          <MoneyInput name="monthlyExpenses" control={form.control} id="monthlyExpenses" />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium">Recursos Disponibles</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Ingresos</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted"
              value={formatearMonto(totalIncome)}
            />
          </div>
          <div className="space-y-2">
            <Label>Gasto Mensual</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted"
              value={formatearMonto(monthlyExpenses)}
            />
          </div>
          <div className="space-y-2">
            <Label>Disponible</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted font-bold"
              value={formatearMonto(availableIncome)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
