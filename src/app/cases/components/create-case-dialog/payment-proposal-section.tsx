'use client';

import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export function PaymentProposalSection() {
  const form = useFormContext();

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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gracePeriodRequested"
            checked={form.watch('gracePeriodRequested')}
            onCheckedChange={(checked) =>
              form.setValue('gracePeriodRequested', checked as boolean)
            }
          />
          <Label htmlFor="gracePeriodRequested" className="cursor-pointer">
            ¿Solicita Período de Gracia?
          </Label>
        </div>
        {form.watch('gracePeriodRequested') && (
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="paymentInKind"
            checked={form.watch('paymentInKind')}
            onCheckedChange={(checked) =>
              form.setValue('paymentInKind', checked as boolean)
            }
          />
          <Label htmlFor="paymentInKind" className="cursor-pointer">
            ¿Ofrece Dación en Pago?
          </Label>
        </div>
        {form.watch('paymentInKind') && (
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="assetSaleAuthorized"
            checked={form.watch('assetSaleAuthorized')}
            onCheckedChange={(checked) =>
              form.setValue('assetSaleAuthorized', checked as boolean)
            }
          />
          <Label htmlFor="assetSaleAuthorized" className="cursor-pointer">
            ¿Autoriza Venta de Bien?
          </Label>
        </div>
        {form.watch('assetSaleAuthorized') && (
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="cashFlowPayment"
            checked={form.watch('cashFlowPayment')}
            onCheckedChange={(checked) =>
              form.setValue('cashFlowPayment', checked as boolean)
            }
          />
          <Label htmlFor="cashFlowPayment" className="cursor-pointer">
            ¿Pago con Flujo de Caja?
          </Label>
        </div>
        {form.watch('cashFlowPayment') && (
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="extraordinaryPayment"
                checked={form.watch('extraordinaryPayment')}
                onCheckedChange={(checked) =>
                  form.setValue('extraordinaryPayment', checked as boolean)
                }
              />
              <Label htmlFor="extraordinaryPayment" className="cursor-pointer">
                ¿Cuota Extraordinaria?
              </Label>
            </div>
            {form.watch('extraordinaryPayment') && (
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="capitalReduction"
            checked={form.watch('capitalReduction')}
            onCheckedChange={(checked) =>
              form.setValue('capitalReduction', checked as boolean)
            }
          />
          <Label htmlFor="capitalReduction" className="cursor-pointer">
            ¿Solicita Quitas de Capital?
          </Label>
        </div>
        {form.watch('capitalReduction') && (
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="forgiveAccruedInterest"
              checked={form.watch('forgiveAccruedInterest')}
              onCheckedChange={(checked) =>
                form.setValue('forgiveAccruedInterest', checked as boolean)
              }
            />
            <Label htmlFor="forgiveAccruedInterest" className="cursor-pointer">
              Condonación Intereses Causados
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="forgiveFutureInterest"
              checked={form.watch('forgiveFutureInterest')}
              onCheckedChange={(checked) =>
                form.setValue('forgiveFutureInterest', checked as boolean)
              }
            />
            <Label htmlFor="forgiveFutureInterest" className="cursor-pointer">
              Condonación Intereses Futuros
            </Label>
          </div>
        </div>
      </div>

      {/* Orden de Prelación */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Orden de Prelación</h4>
        <div className="grid grid-cols-2 gap-4">
          {(['primera', 'segunda', 'tercera', 'cuarta', 'quinta'] as const).map(
            (order) => (
              <div key={order} className="space-y-2">
                <Label htmlFor={`paymentOrder.${order}`} className="capitalize">
                  {order} - Valor $:
                </Label>
                <Input
                  id={`paymentOrder.${order}`}
                  type="text"
                  {...form.register(`paymentOrder.${order}`)}
                  value={form.watch(`paymentOrder.${order}`) || ''}
                />
              </div>
            ),
          )}
        </div>
      </div>

      {/* Privilegios entre Clases */}
      <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
        <h4 className="font-medium">Privilegios entre Clases</h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hasClassPrivileges"
            checked={form.watch('hasClassPrivileges')}
            onCheckedChange={(checked) =>
              form.setValue('hasClassPrivileges', checked as boolean)
            }
          />
          <Label htmlFor="hasClassPrivileges" className="cursor-pointer">
            ¿Hay Privilegios entre Clases?
          </Label>
        </div>
        {form.watch('hasClassPrivileges') && (
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="thirdPartyPaymentAuth"
              checked={form.watch('thirdPartyPaymentAuth')}
              onCheckedChange={(checked) =>
                form.setValue('thirdPartyPaymentAuth', checked as boolean)
              }
            />
            <Label htmlFor="thirdPartyPaymentAuth" className="cursor-pointer">
              Autorización de Pago por Terceros
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="guaranteeSubstitution"
              checked={form.watch('guaranteeSubstitution')}
              onCheckedChange={(checked) =>
                form.setValue('guaranteeSubstitution', checked as boolean)
              }
            />
            <Label htmlFor="guaranteeSubstitution" className="cursor-pointer">
              Sustitución o Disminución de Garantías
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
