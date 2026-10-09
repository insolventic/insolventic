'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CreateCaseFormInput } from '@/features/case/schemas';

export function CesacionPagosSection() {
  const { watch, setValue, control } = useFormContext<CreateCaseFormInput>();

  // Auto-calculate from debts array
  // `useWatch` devuelve undefined hasta que el campo existe, y el `|| []`
  // creaba un ARRAY NUEVO en cada render: los useMemo que dependen de `debts`
  // veían una identidad distinta siempre y nunca memoizaban nada. Estabilizar
  // el fallback acá no cambia ningún valor, solo hace que la memoización
  // funcione de verdad.
  const debtsRaw = useWatch({ control, name: 'debts' });
  const debts = useMemo(() => debtsRaw ?? [], [debtsRaw]);

  const { numAcreedores, porcentajeMora } = useMemo(() => {
    const total = debts.length;
    const totalDebt = debts.reduce(
      (sum: number, d: Record<string, unknown>) =>
        sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
      0,
    );
    const overdueDebt = debts
      .filter((d: Record<string, unknown>) => Number(d.daysOverdue) > 0)
      .reduce(
        (sum: number, d: Record<string, unknown>) =>
          sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
        0,
      );
    const pct = totalDebt > 0 ? (overdueDebt / totalDebt) * 100 : 0;
    return {
      numAcreedores: total,
      porcentajeMora: Math.round(pct * 100) / 100,
    };
  }, [debts]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);

  // Calculate total debt for display
  const totalDeuda = useMemo(
    () =>
      debts.reduce(
        (sum: number, d: Record<string, unknown>) =>
          sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
        0,
      ),
    [debts],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Sección IV: Declaración de Cesación de Pagos
        </h3>
        <p className="text-muted-foreground text-sm">
          Información sobre la cesación de pagos del deudor
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label>Cesación de pagos</Label>
          <p className="text-muted-foreground text-sm">
            ¿El deudor se encuentra en cesación de pagos?
          </p>
        </div>
        <Switch
          checked={watch('cesacionPagos') || false}
          onCheckedChange={(checked) => setValue('cesacionPagos', checked)}
        />
      </div>

      {watch('cesacionPagos') && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Número de acreedores</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted cursor-not-allowed font-semibold"
              value={numAcreedores}
            />
            <p className="text-muted-foreground text-xs">
              Calculado desde los acreedores registrados (Pág. 3)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Porcentaje de pasivo en mora (%)</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted cursor-not-allowed font-semibold"
              value={`${porcentajeMora}%`}
            />
            <p className="text-muted-foreground text-xs">
              Calculado según días de mora de cada acreedor
            </p>
          </div>

          <div className="space-y-2">
            <Label>Total deuda registrada</Label>
            <Input
              type="text"
              readOnly
              className="bg-muted cursor-not-allowed font-semibold"
              value={formatCurrency(totalDeuda)}
            />
            <p className="text-muted-foreground text-xs">
              Suma de capital de todos los acreedores
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Obligaciones en mora mayor a 90 días</Label>
            <p className="text-muted-foreground text-sm">
              ¿Tiene obligaciones con mora superior a 90 días?
            </p>
          </div>
          <Switch
            checked={watch('obligacionesEnMora90Dias') || false}
            onCheckedChange={(checked) =>
              setValue('obligacionesEnMora90Dias', checked)
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Procesos ejecutivos vigentes</Label>
            <p className="text-muted-foreground text-sm">
              ¿Existen procesos ejecutivos vigentes en su contra?
            </p>
          </div>
          <Switch
            checked={watch('procesosEjecutivosVigentes') || false}
            onCheckedChange={(checked) =>
              setValue('procesosEjecutivosVigentes', checked)
            }
          />
        </div>
      </div>
    </div>
  );
}
