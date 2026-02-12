'use client';

import { useFormContext, useWatch } from 'react-hook-form';
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

/**
 * PaymentProposalSection - Optimized version
 *
 * CAMBIOS PRINCIPALES para eliminar "Maximum update depth exceeded":
 * 1. Usar useWatch en lugar de form.watch() - useWatch usa una suscripción estable
 * 2. Usar FormField para checkboxes en lugar de checked={form.watch()}
 * 3. FormField maneja el estado internamente sin causar re-renders del padre
 */
export function PaymentProposalSection() {
  const form = useFormContext();

  // useWatch con un array de nombres es más eficiente que múltiples form.watch()
  // Solo causa un re-render cuando CUALQUIERA de estos valores cambia
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
    ],
  });

  // Destructurar para legibilidad
  const [
    gracePeriodRequested,
    paymentInKind,
    assetSaleAuthorized,
    cashFlowPayment,
    extraordinaryPayment,
    capitalReduction,
    hasClassPrivileges,
  ] = watchedValues;

  return (
    <div className="space-y-8">
      {/* Resumen Financiero */}
      <div>
        <h3 className="mb-4 text-lg font-medium">Resumen Financiero</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="totalDebt">
              Total Obligaciones a Capital Únicamente
            </Label>
            <Input
              id="totalDebt"
              type="number"
              step="0.01"
              {...form.register('totalDebt')}
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
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="gracePeriodRequested"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="gracePeriodRequested" className="cursor-pointer font-normal">
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
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="paymentInKind"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="paymentInKind" className="cursor-pointer font-normal">
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
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="assetSaleAuthorized"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="assetSaleAuthorized" className="cursor-pointer font-normal">
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

      {/* Pago con Flujo de Caja */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Pago con Flujo de Caja</h4>
        <FormField
          control={form.control}
          name="cashFlowPayment"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="cashFlowPayment"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="cashFlowPayment" className="cursor-pointer font-normal">
                ¿Pago con Flujo de Caja?
              </FormLabel>
            </FormItem>
          )}
        />
        {cashFlowPayment && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentTermMonths">Plazo (Meses)</Label>
                <Input
                  id="paymentTermMonths"
                  type="number"
                  {...form.register('paymentTermMonths', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyPaymentAmount">
                  Valor Cuota Mensual
                </Label>
                <Input
                  id="monthlyPaymentAmount"
                  type="number"
                  step="0.01"
                  {...form.register('monthlyPaymentAmount')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variablePayment">Cuota Variable</Label>
                <Input
                  id="variablePayment"
                  type="number"
                  step="0.01"
                  {...form.register('variablePayment')}
                />
              </div>
            </div>
            <FormField
              control={form.control}
              name="extraordinaryPayment"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      id="extraordinaryPayment"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel htmlFor="extraordinaryPayment" className="cursor-pointer font-normal">
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
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="capitalReduction"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="capitalReduction" className="cursor-pointer font-normal">
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
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="forgiveAccruedInterest"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="forgiveAccruedInterest" className="cursor-pointer font-normal">
                  Condonación Intereses Causados
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="forgiveFutureInterest"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="forgiveFutureInterest"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="forgiveFutureInterest" className="cursor-pointer font-normal">
                  Condonación Intereses Futuros
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Orden de Prelación */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Orden de Prelación</h4>
        <div className="grid grid-cols-2 gap-4">
          {(['primera', 'segunda', 'tercera', 'cuarta', 'quinta'] as const).map(
            (order) => (
              <FormField
                key={order}
                control={form.control}
                name={`paymentOrder.${order}`}
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel htmlFor={`paymentOrder.${order}`} className="capitalize">
                      {order} - Valor $:
                    </FormLabel>
                    <FormControl>
                      <Input
                        id={`paymentOrder.${order}`}
                        type="text"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ),
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
            <FormItem className="flex items-center space-x-2 space-y-0">
              <FormControl>
                <Checkbox
                  id="hasClassPrivileges"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel htmlFor="hasClassPrivileges" className="cursor-pointer font-normal">
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
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="thirdPartyPaymentAuth"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="thirdPartyPaymentAuth" className="cursor-pointer font-normal">
                  Autorización de Pago por Terceros
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guaranteeSubstitution"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="guaranteeSubstitution"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel htmlFor="guaranteeSubstitution" className="cursor-pointer font-normal">
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
