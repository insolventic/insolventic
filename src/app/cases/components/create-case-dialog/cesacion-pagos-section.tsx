'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CreateCaseFormInput } from '@/features/case/schemas';
import { parsearMonto } from '@/features/case/monto';

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
        sum + (parsearMonto(d.capitalAmount) || parsearMonto(d.amount) || 0),
      0,
    );
    const overdueDebt = debts
      .filter((d: Record<string, unknown>) => Number(d.daysOverdue) > 0)
      .reduce(
        (sum: number, d: Record<string, unknown>) =>
          sum + (parsearMonto(d.capitalAmount) || parsearMonto(d.amount) || 0),
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

  // Mismo valor de siempre (redondeado a 2 decimales), con coma decimal es-CO.
  const formatPorcentaje = (value: number) =>
    `${value.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;

  // Calculate total debt for display
  const totalDeuda = useMemo(
    () =>
      debts.reduce(
        (sum: number, d: Record<string, unknown>) =>
          sum + (parsearMonto(d.capitalAmount) || parsearMonto(d.amount) || 0),
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
        <section
          aria-labelledby="titulo-cesacion-calculada"
          className="bg-muted/40 rounded-lg border p-4"
        >
          <div className="mb-3 flex items-start gap-2">
            <Info
              className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <h4
                id="titulo-cesacion-calculada"
                className="text-sm font-semibold"
              >
                Datos calculados de los acreedores
              </h4>
              <p className="text-muted-foreground text-xs">
                Se calculan solos a partir de los acreedores registrados (Pág.
                3). No se editan aquí.
              </p>
            </div>
          </div>

          {/* Región viva: anuncia los nuevos valores cuando cambian los
              acreedores registrados. */}
          <div aria-live="polite" aria-atomic="true">
            {numAcreedores === 0 ? (
              <p
                className="text-muted-foreground text-sm"
                data-testid="cesacion-sin-acreedores"
              >
                Aún no hay acreedores registrados; estos valores se calcularán
                automáticamente.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="bg-background rounded-md p-3">
                  <dt className="text-muted-foreground text-xs">
                    Número de acreedores
                  </dt>
                  <dd className="text-lg font-semibold">{numAcreedores}</dd>
                </div>
                <div className="bg-background rounded-md p-3">
                  <dt className="text-muted-foreground text-xs">
                    Pasivo en mora
                  </dt>
                  <dd className="text-lg font-semibold">
                    {formatPorcentaje(porcentajeMora)}
                  </dd>
                  <dd className="text-muted-foreground text-xs">
                    Según los días de mora de cada acreedor
                  </dd>
                </div>
                <div className="bg-background rounded-md p-3">
                  <dt className="text-muted-foreground text-xs">
                    Total de la deuda registrada
                  </dt>
                  <dd className="text-lg font-semibold">
                    {formatCurrency(totalDeuda)}
                  </dd>
                  <dd className="text-muted-foreground text-xs">
                    Suma del capital de todos los acreedores
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </section>
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
