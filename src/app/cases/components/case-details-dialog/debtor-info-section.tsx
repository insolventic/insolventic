'use client';

import {
  User,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  DollarSign,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { CaseWithRelations } from '@/features/case/schemas';

interface DebtorInfoSectionProps {
  caseData: CaseWithRelations;
}

export function DebtorInfoSection({
  caseData,
}: Readonly<DebtorInfoSectionProps>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Información del Deudor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-start space-x-3">
              <User className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Nombre Completo
                </p>
                <p className="text-sm">{caseData?.debtor?.name || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CreditCard className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Documento
                </p>
                <p className="text-sm">
                  {caseData?.debtor?.idType || 'N/A'}:{' '}
                  {caseData?.debtor?.idNumber || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Phone className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Teléfono
                </p>
                <p className="text-sm">{caseData?.debtor?.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Mail className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Email
                </p>
                <p className="text-sm">{caseData?.debtor?.email || 'N/A'}</p>
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex items-start space-x-3">
            <MapPin className="text-muted-foreground mt-0.5 h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-sm font-medium">
                Dirección
              </p>
              <p className="text-sm">
                {caseData?.debtor?.address || 'N/A'},{' '}
                {caseData?.debtor?.city || 'N/A'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-start space-x-3">
              <DollarSign className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Ingresos Mensuales
                </p>
                <p className="text-sm font-semibold text-green-600">
                  ${(caseData?.debtor?.monthlyIncome || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <DollarSign className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  Gastos Mensuales
                </p>
                <p className="text-sm font-semibold text-red-600">
                  ${(caseData?.debtor?.monthlyExpenses || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ámbito de Aplicación */}
      {caseData?.applicantScope && caseData.applicantScope.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ámbito de Aplicación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {caseData.applicantScope.map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
