'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface LegalProcessSectionProps {
  caseData: CaseWithRelations;
}

export function LegalProcessSection({
  caseData,
}: Readonly<LegalProcessSectionProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Proceso Legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Número de Juzgado
              </p>
              <p className="text-sm">{caseData?.courtNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Ciudad
              </p>
              <p className="text-sm">{caseData?.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Tipo de Proceso
              </p>
              <p className="text-sm">{caseData?.processType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Demandante
              </p>
              <p className="text-sm">{caseData?.plaintiff || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Número de Expediente
              </p>
              <p className="text-sm">{caseData?.judicialFileNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Abogado
              </p>
              <p className="text-sm">{caseData?.attorney || 'N/A'}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Fecha de Radicación
              </p>
              <p className="text-sm">
                {caseData?.filingDate
                  ? new Date(caseData.filingDate).toLocaleDateString('es-CO')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Fecha de Admisión
              </p>
              <p className="text-sm">
                {caseData?.admissionDate
                  ? new Date(caseData.admissionDate).toLocaleDateString('es-CO')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Primera Audiencia
              </p>
              <p className="text-sm">
                {caseData?.firstHearingDate
                  ? `${new Date(caseData.firstHearingDate).toLocaleDateString('es-CO')} ${caseData.firstHearingTime ? `a las ${caseData.firstHearingTime}` : ''}`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Operador Designado
              </p>
              <p className="text-sm">{caseData?.designatedOperator || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procesos Judiciales */}
      {caseData?.legalProcesses && caseData.legalProcesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Procesos Judiciales en Contra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.legalProcesses.map((process, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="mb-2">
                    <h4 className="font-medium">Proceso #{index + 1}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {process.processType && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Tipo de Proceso
                        </p>
                        <p>{process.processType}</p>
                      </div>
                    )}
                    {process.plaintiff && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Demandante
                        </p>
                        <p>{process.plaintiff}</p>
                      </div>
                    )}
                    {process.court && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Juzgado
                        </p>
                        <p>{process.court}</p>
                      </div>
                    )}
                    {process.fileNumber && (
                      <div>
                        <p className="text-muted-foreground text-xs font-medium">
                          Expediente
                        </p>
                        <p>{process.fileNumber}</p>
                      </div>
                    )}
                    {process.precautionaryMeasure && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs font-medium">
                          Medida Cautelar
                        </p>
                        <p>{process.precautionaryMeasure}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
