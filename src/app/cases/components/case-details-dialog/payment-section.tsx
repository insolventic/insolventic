'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface PaymentSectionProps {
  caseData: CaseWithRelations;
}

export function PaymentSection({ caseData }: Readonly<PaymentSectionProps>) {
  return (
    <>
      {/* Propuesta de Pago */}
      <Card>
        <CardHeader>
          <CardTitle>Propuesta de Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {caseData?.gracePeriodRequested && (
              <>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-600">
                    Período de Gracia
                  </p>
                  <Badge variant="default">
                    Solicitado: {caseData.gracePeriodMonths} meses
                  </Badge>
                </div>
              </>
            )}
            {caseData?.paymentInKind && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-600">
                  Dación en Pago
                </p>
                <p className="text-sm">{caseData.paymentInKindDescription}</p>
              </div>
            )}
            {caseData?.assetSaleAuthorized && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-600">
                  Autorización de Venta de Bien
                </p>
                <p className="text-sm">{caseData.assetSaleDescription}</p>
              </div>
            )}
            {caseData?.cashFlowPayment && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Plazo de Pago
                  </p>
                  <p className="text-sm">{caseData.paymentTermMonths} meses</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Cuota Mensual
                  </p>
                  <p className="text-sm">
                    ${(caseData?.monthlyPaymentAmount || 0).toLocaleString()}
                  </p>
                </div>
              </>
            )}
            {caseData?.capitalReduction && (
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Quitas de Capital
                </p>
                <Badge variant="default">
                  {caseData.capitalReductionPercent}% solicitado
                </Badge>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">
                Condonación de Intereses
              </p>
              <div className="mt-1 flex gap-2">
                {caseData?.forgiveAccruedInterest && (
                  <Badge variant="secondary">Causados</Badge>
                )}
                {caseData?.forgiveFutureInterest && (
                  <Badge variant="secondary">Futuros</Badge>
                )}
                {!caseData?.forgiveAccruedInterest &&
                  !caseData?.forgiveFutureInterest && (
                    <span className="text-sm text-gray-500">No solicitada</span>
                  )}
              </div>
            </div>
          </div>
          {caseData?.insuranceOffering && <Separator />}
          {caseData?.insuranceOffering && (
            <div>
              <p className="text-sm font-medium text-gray-600">
                Ofrecimiento de Seguros
              </p>
              <p className="text-sm">{caseData.insuranceOffering}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orden de Prelación */}
      {caseData?.paymentOrder && (
        <Card>
          <CardHeader>
            <CardTitle>Orden de Prelación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {caseData.paymentOrder.primera && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Primera</p>
                  <p className="text-sm">
                    $
                    {parseFloat(
                      caseData.paymentOrder.primera || '0',
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              {caseData.paymentOrder.segunda && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Segunda</p>
                  <p className="text-sm">
                    $
                    {parseFloat(
                      caseData.paymentOrder.segunda || '0',
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              {caseData.paymentOrder.tercera && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Tercera</p>
                  <p className="text-sm">
                    $
                    {parseFloat(
                      caseData.paymentOrder.tercera || '0',
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              {caseData.paymentOrder.cuarta && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Cuarta</p>
                  <p className="text-sm">
                    $
                    {parseFloat(
                      caseData.paymentOrder.cuarta || '0',
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              {caseData.paymentOrder.quinta && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Quinta</p>
                  <p className="text-sm">
                    $
                    {parseFloat(
                      caseData.paymentOrder.quinta || '0',
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Privilegios entre Clases */}
      {caseData?.hasClassPrivileges && (
        <Card>
          <CardHeader>
            <CardTitle>Privilegios entre Clases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {caseData.classPrivilegesDescription || 'Sí'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Otras Autorizaciones */}
      {(caseData?.thirdPartyPaymentAuth || caseData?.guaranteeSubstitution) && (
        <Card>
          <CardHeader>
            <CardTitle>Otras Autorizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {caseData.thirdPartyPaymentAuth && (
                <Badge variant="default">
                  Autorización de Pago por Terceros
                </Badge>
              )}
              {caseData.guaranteeSubstitution && (
                <Badge variant="default">
                  Sustitución o Disminución de Garantías
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sociedad Conyugal */}
      {(caseData?.spouseName || caseData?.spouseIdNumber) && (
        <Card>
          <CardHeader>
            <CardTitle>Sociedad Conyugal/Patrimonial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Nombre</p>
                <p className="text-sm">{caseData.spouseName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Cédula</p>
                <p className="text-sm">{caseData.spouseIdNumber || 'N/A'}</p>
              </div>
              {caseData?.spouseAddress && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Dirección</p>
                  <p className="text-sm">{caseData.spouseAddress}</p>
                </div>
              )}
              {caseData?.spousePhone && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Teléfono</p>
                  <p className="text-sm">{caseData.spousePhone}</p>
                </div>
              )}
              {caseData?.spouseEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Email</p>
                  <p className="text-sm">{caseData.spouseEmail}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
