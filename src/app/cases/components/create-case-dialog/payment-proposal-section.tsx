'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
} from '@/components/ui/form';
import { getDebtClass } from '@/features/case/validation-rules';
import { MoneyInput } from '@/components/ui/money-input';

/**
 * PaymentProposalSection
 *
 * Clases de prelación (Ley 1564 de 2012):
 *  1ª Clase — Tributarias (IMPUESTOS)
 *  2ª Clase — Vehiculares (VEHICULAR)
 *  3ª Clase — Hipotecarios (HIPOTECARIA)
 *  4ª Clase — Prendarios (PRENDARIA)
 *  5ª Clase — Quirografarias (LABORAL, PERSONAL, TARJETA_CREDITO, OTRA)
 *
 * Cuota mensual y plazo se calculan automáticamente desde recursos disponibles (Pág 2).
 * Quitas se aplican al orden de prelación.
 */
export function PaymentProposalSection() {
  const form = useFormContext();

  const watchedValues = useWatch({
    control: form.control,
    name: [
      'gracePeriodRequested',
      'paymentInKind',
      'assetSaleAuthorized',
      'cashFlowPayment',
      'extraordinaryPayment',
      'capitalReduction',
      'hasClassPrivileges',
      'capitalReductionPercent',
    ],
  });

  const [
    gracePeriodRequested,
    paymentInKind,
    assetSaleAuthorized,
    cashFlowPayment,
    extraordinaryPayment,
    capitalReduction,
    hasClassPrivileges,
    capitalReductionPercent,
  ] = watchedValues;

  // Watch debts for class totals
  // `useWatch` devuelve undefined hasta que el campo existe, y el `|| []`
  // creaba un ARRAY NUEVO en cada render: los useMemo que dependen de `debts`
  // veían una identidad distinta siempre y nunca memoizaban nada. Estabilizar
  // el fallback acá no cambia ningún valor, solo hace que la memoización
  // funcione de verdad.
  const debtsRaw = useWatch({ control: form.control, name: 'debts' });
  const debts = useMemo(() => debtsRaw ?? [], [debtsRaw]);

  // Watch income/expenses from Pág 2 for auto cuota
  const ingresoPrincipal =
    useWatch({ control: form.control, name: 'ingresoPrincipalMensual' }) || 0;
  const otrosIngresos =
    useWatch({ control: form.control, name: 'otrosIngresosMensuales' }) || 0;
  const ingresosVariables =
    useWatch({ control: form.control, name: 'ingresosVariablesPromedio' }) || 0;
  const ingresosNoOp =
    useWatch({ control: form.control, name: 'ingresosNoOperacionales' }) || 0;
  const gastosVivienda =
    useWatch({ control: form.control, name: 'gastosVivienda' }) || 0;
  const gastosAlimentacion =
    useWatch({ control: form.control, name: 'gastosAlimentacion' }) || 0;
  const gastosServicios =
    useWatch({ control: form.control, name: 'gastosServiciosPublicos' }) || 0;
  const gastosTransporte =
    useWatch({ control: form.control, name: 'gastosTransporte' }) || 0;
  const gastosEducacion =
    useWatch({ control: form.control, name: 'gastosEducacion' }) || 0;
  const gastosSalud =
    useWatch({ control: form.control, name: 'gastosSalud' }) || 0;
  const otrosGastos =
    useWatch({ control: form.control, name: 'otrosGastos' }) || 0;

  const totalIngresos = useMemo(
    () =>
      Number(ingresoPrincipal) +
      Number(otrosIngresos) +
      Number(ingresosVariables) +
      Number(ingresosNoOp),
    [ingresoPrincipal, otrosIngresos, ingresosVariables, ingresosNoOp],
  );

  const totalGastos = useMemo(
    () =>
      Number(gastosVivienda) +
      Number(gastosAlimentacion) +
      Number(gastosServicios) +
      Number(gastosTransporte) +
      Number(gastosEducacion) +
      Number(gastosSalud) +
      Number(otrosGastos),
    [
      gastosVivienda,
      gastosAlimentacion,
      gastosServicios,
      gastosTransporte,
      gastosEducacion,
      gastosSalud,
      otrosGastos,
    ],
  );

  const recursosDisponibles = useMemo(
    () => Math.max(0, totalIngresos - totalGastos),
    [totalIngresos, totalGastos],
  );

  // Class totals using centralized getDebtClass
  const classTotals = useMemo(() => {
    const totals = {
      primera: 0,
      segunda: 0,
      tercera: 0,
      cuarta: 0,
      quinta: 0,
    };
    for (const debt of debts) {
      if (!debt?.type) continue;
      const capital = Number(debt.capitalAmount) || 0;
      const interest = Number(debt.interestAmount) || 0;
      const total = capital + interest;
      const cls = getDebtClass(debt.type);
      totals[cls] += total;
    }
    return totals;
  }, [debts]);

  const totalObligaciones =
    classTotals.primera +
    classTotals.segunda +
    classTotals.tercera +
    classTotals.cuarta +
    classTotals.quinta;

  // Quitas factor
  const quitasPct = Number(capitalReductionPercent) || 0;
  const quitasFactor = capitalReduction ? 1 - quitasPct / 100 : 1;
  const totalConQuitas = totalObligaciones * quitasFactor;

  // Auto cuota mensual = recursos disponibles (no editable por el usuario)
  // Plazo auto = total con quitas / cuota mensual
  const cuotaMensual = recursosDisponibles;
  const plazoMeses = useMemo(
    () => (cuotaMensual > 0 ? Math.ceil(totalConQuitas / cuotaMensual) : 0),
    [totalConQuitas, cuotaMensual],
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);

  const classConfig = [
    {
      key: 'primera' as const,
      label: '1ª Clase — Tributarias',
      color: 'bg-red-50 dark:bg-red-950',
      text: 'text-red-700 dark:text-red-300',
    },
    {
      key: 'segunda' as const,
      label: '2ª Clase — Vehiculares',
      color: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-700 dark:text-blue-300',
    },
    {
      key: 'tercera' as const,
      label: '3ª Clase — Hipotecarios',
      color: 'bg-purple-50 dark:bg-purple-950',
      text: 'text-purple-700 dark:text-purple-300',
    },
    {
      key: 'cuarta' as const,
      label: '4ª Clase — Prendarios',
      color: 'bg-orange-50 dark:bg-orange-950',
      text: 'text-orange-700 dark:text-orange-300',
    },
    {
      key: 'quinta' as const,
      label: '5ª Clase — Quirografarias',
      color: 'bg-slate-50 dark:bg-slate-900',
      text: 'text-slate-700 dark:text-slate-300',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Resumen Financiero por Clase */}
      <div>
        <h3 className="mb-4 text-lg font-medium">
          Resumen Financiero por Clase
        </h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Calculado automáticamente desde los acreedores registrados en la
          Página 3
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {classConfig.map((cls) => (
            <div
              key={cls.key}
              className={`space-y-1 rounded-lg border p-3 ${cls.color}`}
            >
              <Label className={`text-xs ${cls.text}`}>{cls.label}</Label>
              <p className="text-sm font-semibold">
                {formatCurrency(classTotals[cls.key])}
              </p>
            </div>
          ))}
          <div className="space-y-1 rounded-lg border bg-green-50 p-3 dark:bg-green-950">
            <Label className="text-xs font-semibold text-green-700 dark:text-green-300">
              Total Obligaciones
            </Label>
            <p className="text-base font-bold text-green-700 dark:text-green-300">
              {formatCurrency(totalObligaciones)}
            </p>
          </div>
        </div>
      </div>

      {/* Flujo de Caja — Auto-calculado */}
      <div className="space-y-4 rounded-lg border bg-blue-50 p-5 dark:bg-blue-950">
        <h4 className="font-medium">Flujo de Caja (Auto-calculado)</h4>
        <p className="text-muted-foreground text-xs">
          La cuota mensual corresponde a los recursos disponibles calculados en
          Página 2 (Ingresos − Gastos). El plazo se determina automáticamente.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Recursos disponibles (Pág 2)</Label>
            <Input
              type="text"
              readOnly
              className="bg-white font-semibold dark:bg-slate-800"
              value={formatCurrency(recursosDisponibles)}
            />
          </div>
          <div className="space-y-2">
            <Label>Cuota mensual propuesta</Label>
            <Input
              type="text"
              readOnly
              className="bg-white font-semibold dark:bg-slate-800"
              value={formatCurrency(cuotaMensual)}
            />
          </div>
          <div className="space-y-2">
            <Label>Plazo estimado (meses)</Label>
            <Input
              type="text"
              readOnly
              className="bg-white font-semibold dark:bg-slate-800"
              value={plazoMeses > 0 ? `${plazoMeses} meses` : 'N/A'}
            />
          </div>
        </div>
      </div>

      {/* Periodo de Gracia */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Período de Gracia</h4>
        <FormField
          control={form.control}
          name="gracePeriodRequested"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="gracePeriodRequested"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="gracePeriodRequested"
                className="cursor-pointer font-normal"
              >
                ¿Solicita Período de Gracia?
              </FormLabel>
            </FormItem>
          )}
        />
        {gracePeriodRequested && (
          <div className="space-y-2">
            <Label htmlFor="gracePeriodMonths">
              Meses de Período de Gracia
            </Label>
            <Input
              id="gracePeriodMonths"
              type="number"
              {...form.register('gracePeriodMonths', { valueAsNumber: true })}
            />
          </div>
        )}
      </div>

      {/* Dación en Pago */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Dación en Pago</h4>
        <FormField
          control={form.control}
          name="paymentInKind"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="paymentInKind"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="paymentInKind"
                className="cursor-pointer font-normal"
              >
                ¿Ofrece Dación en Pago?
              </FormLabel>
            </FormItem>
          )}
        />
        {paymentInKind && (
          <div className="space-y-2">
            <Label htmlFor="paymentInKindDescription">
              Descripción del Bien
            </Label>
            <Textarea
              id="paymentInKindDescription"
              rows={3}
              {...form.register('paymentInKindDescription')}
            />
          </div>
        )}
      </div>

      {/* Autorización de Venta de Bien */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Autorización de Venta de Bien</h4>
        <FormField
          control={form.control}
          name="assetSaleAuthorized"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="assetSaleAuthorized"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="assetSaleAuthorized"
                className="cursor-pointer font-normal"
              >
                ¿Autoriza Venta de Bien?
              </FormLabel>
            </FormItem>
          )}
        />
        {assetSaleAuthorized && (
          <div className="space-y-2">
            <Label htmlFor="assetSaleDescription">Descripción del Bien</Label>
            <Textarea
              id="assetSaleDescription"
              rows={3}
              {...form.register('assetSaleDescription')}
            />
          </div>
        )}
      </div>

      {/* Pago con Flujo de Caja — sección expandible para cuota extraordinaria */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Pago con Flujo de Caja</h4>
        <FormField
          control={form.control}
          name="cashFlowPayment"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="cashFlowPayment"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="cashFlowPayment"
                className="cursor-pointer font-normal"
              >
                ¿Pago con Flujo de Caja?
              </FormLabel>
            </FormItem>
          )}
        />
        {cashFlowPayment && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cuota Variable (opcional)</Label>
                <MoneyInput name="variablePayment" control={form.control} />
              </div>
            </div>
            <FormField
              control={form.control}
              name="extraordinaryPayment"
              render={({ field }) => (
                <FormItem className="flex items-center space-y-0 space-x-2">
                  <FormControl>
                    <Checkbox
                      id="extraordinaryPayment"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="extraordinaryPayment"
                    className="cursor-pointer font-normal"
                  >
                    ¿Cuota Extraordinaria?
                  </FormLabel>
                </FormItem>
              )}
            />
            {extraordinaryPayment && (
              <div className="space-y-2">
                <Label htmlFor="extraordinaryPaymentDate">
                  Fecha/Mes de Cuota Extraordinaria
                </Label>
                <Input
                  id="extraordinaryPaymentDate"
                  type="text"
                  {...form.register('extraordinaryPaymentDate')}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Quitas de Capital */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Quitas de Capital</h4>
        <FormField
          control={form.control}
          name="capitalReduction"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="capitalReduction"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="capitalReduction"
                className="cursor-pointer font-normal"
              >
                ¿Solicita Quitas de Capital?
              </FormLabel>
            </FormItem>
          )}
        />
        {capitalReduction && (
          <div className="space-y-2">
            <Label htmlFor="capitalReductionPercent">
              Porcentaje de Quitas (%)
            </Label>
            <Input
              id="capitalReductionPercent"
              type="number"
              step="0.01"
              {...form.register('capitalReductionPercent')}
            />
            {quitasPct > 0 && (
              <p className="text-muted-foreground text-xs">
                Deuda original: {formatCurrency(totalObligaciones)} → Con quitas
                ({quitasPct}%): {formatCurrency(totalConQuitas)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Seguros */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Seguros</h4>
        <div className="space-y-2">
          <Label htmlFor="insuranceOffering">Ofrecimiento de Seguros</Label>
          <Textarea
            id="insuranceOffering"
            rows={3}
            {...form.register('insuranceOffering')}
          />
        </div>
      </div>

      {/* Condonación de Intereses */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Condonación de Intereses</h4>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="forgiveAccruedInterest"
            render={({ field }) => (
              <FormItem className="flex items-center space-y-0 space-x-2">
                <FormControl>
                  <Checkbox
                    id="forgiveAccruedInterest"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel
                  htmlFor="forgiveAccruedInterest"
                  className="cursor-pointer font-normal"
                >
                  Condonación Intereses Causados
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="forgiveFutureInterest"
            render={({ field }) => (
              <FormItem className="flex items-center space-y-0 space-x-2">
                <FormControl>
                  <Checkbox
                    id="forgiveFutureInterest"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel
                  htmlFor="forgiveFutureInterest"
                  className="cursor-pointer font-normal"
                >
                  Condonación Intereses Futuros
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Orden de Prelación — con quitas aplicadas */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Orden de Prelación</h4>
        <p className="text-muted-foreground text-xs">
          Los valores se calculan automáticamente según el tipo de deuda.
          {capitalReduction && quitasPct > 0
            ? ` Se aplica quita del ${quitasPct}% sobre cada clase.`
            : ''}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {classConfig.map((cls) => {
            const original = classTotals[cls.key];
            const conQuitas = original * quitasFactor;
            return (
              <div key={cls.key} className="space-y-1">
                <Label className="text-sm">{cls.label}</Label>
                <Input
                  type="text"
                  readOnly
                  className="bg-muted cursor-not-allowed"
                  value={
                    capitalReduction && quitasPct > 0
                      ? `${formatCurrency(original)} → ${formatCurrency(conQuitas)}`
                      : formatCurrency(original)
                  }
                />
              </div>
            );
          })}
          {capitalReduction && quitasPct > 0 && (
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Total con Quitas</Label>
              <Input
                type="text"
                readOnly
                className="bg-muted cursor-not-allowed font-bold"
                value={formatCurrency(totalConQuitas)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Privilegios entre Clases */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Privilegios entre Clases</h4>
        <FormField
          control={form.control}
          name="hasClassPrivileges"
          render={({ field }) => (
            <FormItem className="flex items-center space-y-0 space-x-2">
              <FormControl>
                <Checkbox
                  id="hasClassPrivileges"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel
                htmlFor="hasClassPrivileges"
                className="cursor-pointer font-normal"
              >
                ¿Hay Privilegios entre Clases?
              </FormLabel>
            </FormItem>
          )}
        />
        {hasClassPrivileges && (
          <div className="space-y-2">
            <Label htmlFor="classPrivilegesDescription">
              Descripción de Privilegios
            </Label>
            <Textarea
              id="classPrivilegesDescription"
              rows={3}
              {...form.register('classPrivilegesDescription')}
            />
          </div>
        )}
      </div>

      {/* Otras Autorizaciones */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Otras Autorizaciones</h4>
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="thirdPartyPaymentAuth"
            render={({ field }) => (
              <FormItem className="flex items-center space-y-0 space-x-2">
                <FormControl>
                  <Checkbox
                    id="thirdPartyPaymentAuth"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel
                  htmlFor="thirdPartyPaymentAuth"
                  className="cursor-pointer font-normal"
                >
                  Autorización de Pago por Terceros
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guaranteeSubstitution"
            render={({ field }) => (
              <FormItem className="flex items-center space-y-0 space-x-2">
                <FormControl>
                  <Checkbox
                    id="guaranteeSubstitution"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel
                  htmlFor="guaranteeSubstitution"
                  className="cursor-pointer font-normal"
                >
                  Sustitución o Disminución de Garantías
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
