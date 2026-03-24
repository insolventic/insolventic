'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFinancialReport } from '@/features/report/actions';

interface ServiceTypeSummary {
  type: string;
  totalAmount: number;
  caseCount: number;
  creditorCount: number;
  monetaryLabel: string;
  description: string;
}

interface CreditorEntry {
  name: string;
  nit: string;
  type: string;
  totalAmount: number;
  count: number;
  services: string[];
}

interface FinancialData {
  totalAmount: number;
  totalRecords: number;
  totalCases: number;
  byServiceType: ServiceTypeSummary[];
  byCreditor: CreditorEntry[];
}

export function FinancialReport() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const result = await getFinancialReport();
        if (result.success && result.data) {
          setData(result.data);
        }
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monto Total Gestionado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-2xl font-bold sm:text-3xl">
              {formatCurrency(data.totalAmount)}
            </p>
            <p className="text-muted-foreground text-sm">
              Suma de todos los servicios
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Casos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalCases}</p>
            <p className="text-muted-foreground text-sm">
              Total de casos en el sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acreedores / Partes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.byCreditor.length}</p>
            <p className="text-muted-foreground text-sm">
              Con obligaciones registradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By Service Type */}
      {data.byServiceType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resumen por Tipo de Servicio
            </CardTitle>
            <CardDescription>
              Desglose financiero por cada tipo de servicio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.byServiceType.map((svc) => (
                <Card key={svc.type} className="border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {svc.type}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {svc.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="truncate text-xl font-bold">
                        {formatCurrency(svc.totalAmount)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {svc.monetaryLabel}
                      </p>
                    </div>
                    <div className="text-muted-foreground flex justify-between text-sm">
                      <span>{svc.caseCount} casos</span>
                      <span>{svc.creditorCount} partes</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Creditor / Party */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Obligaciones por Acreedor / Parte
          </CardTitle>
          <CardDescription>
            Ordenado por monto total (mayor a menor)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>NIT</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead className="text-right">Obligaciones</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCreditor.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground text-center"
                    >
                      No hay datos disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  data.byCreditor.map((creditor) => (
                    <TableRow key={creditor.nit}>
                      <TableCell className="font-medium">
                        {creditor.name}
                      </TableCell>
                      <TableCell>{creditor.nit}</TableCell>
                      <TableCell>{creditor.type}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {creditor.services.map((svc) => (
                            <Badge
                              key={svc}
                              variant="outline"
                              className="text-xs"
                            >
                              {svc}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {creditor.count}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(creditor.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
