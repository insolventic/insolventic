'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CaseWithRelations } from '@/features/case/schemas';

interface LegalFoundationsSectionProps {
  caseData: CaseWithRelations;
}

export function LegalFoundationsSection({
  caseData,
}: Readonly<LegalFoundationsSectionProps>) {
  return (
    <>
      {/* Tarifa y Fundamentos */}
      {(caseData?.requestedFee || caseData?.legalFoundations) && (
        <Card>
          <CardHeader>
            <CardTitle>Tarifa Solicitada y Fundamentos de Derecho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData?.requestedFee && (
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Tarifa Solicitada
                </p>
                <p className="text-sm">{caseData.requestedFee}</p>
              </div>
            )}
            {caseData?.legalFoundations && (
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Fundamentos de Derecho
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {caseData.legalFoundations}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notificaciones */}
      {(caseData?.notificationAddress ||
        caseData?.notificationPhone ||
        caseData?.notificationEmail) && (
        <Card>
          <CardHeader>
            <CardTitle>Notificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {caseData?.notificationAddress && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Dirección para Notificaciones
                  </p>
                  <p className="text-sm">{caseData.notificationAddress}</p>
                </div>
              )}
              {caseData?.notificationPhone && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Teléfono
                  </p>
                  <p className="text-sm">{caseData.notificationPhone}</p>
                </div>
              )}
              {caseData?.notificationEmail && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Correo Electrónico
                  </p>
                  <p className="text-sm">{caseData.notificationEmail}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Firma */}
      {(caseData?.applicantSignatureName || caseData?.applicantSignatureId) && (
        <Card>
          <CardHeader>
            <CardTitle>Firma del Solicitante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {caseData?.applicantSignatureName && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Nombre Completo
                  </p>
                  <p className="text-sm">{caseData.applicantSignatureName}</p>
                </div>
              )}
              {caseData?.applicantSignatureId && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Cédula
                  </p>
                  <p className="text-sm">{caseData.applicantSignatureId}</p>
                </div>
              )}
              {caseData?.applicantSignature && (
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Firma
                  </p>
                  <p className="text-sm italic">
                    {caseData.applicantSignature}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
