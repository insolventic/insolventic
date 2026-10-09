'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPhaseBadgeClass } from '@/lib/case-phases';
import {
  getCaseStatusReport,
  exportCasesToExcel,
} from '@/features/report/actions';

interface ReportData {
  totalCases: number;
  totalAmount: number;
  byPhase: { phase: string; count: number; amount: number }[];
  byType: {
    type: string;
    count: number;
    amount: number;
    showMonetary: boolean;
    monetaryLabel: string;
    entityLabel: string;
    description: string;
  }[];
}

export function CaseStatusReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const result = await getCaseStatusReport({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  // Deliberadamente con deps vacías: `fetchReport` no está memoizado, así que
  // se recrea en cada render. Agregarlo a las deps haría que el efecto corra en
  // cada render -> setLoading -> re-render -> efecto otra vez: un bucle infinito
  // de fetches contra el servidor. Memoizarlo con useCallback([dateFrom, dateTo])
  // tampoco es neutro: el reporte pasaría a refetchear ante cada cambio de
  // fecha, y la pantalla tiene un botón "Filtrar" explícito justamente para que
  // el refetch lo decida el usuario. La carga inicial va una vez al montar; las
  // siguientes las dispara el botón.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = () => {
    void fetchReport();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCasesToExcel({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (result.success && result.data) {
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-casos-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Reporte exportado exitosamente');
      } else {
        toast.error(result.error ?? 'Error al exportar');
      }
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

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
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label className="text-sm font-medium">Desde</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Hasta</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={handleFilter}>Filtrar</Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Casos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalCases}</p>
            <p className="text-muted-foreground text-sm">
              Casos registrados en el sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Monto Total (Insolvencia)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-2xl font-bold sm:text-3xl">
              {formatCurrency(data.totalAmount)}
            </p>
            <p className="text-muted-foreground text-sm">
              Suma de deuda en procesos de insolvencia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By Phase */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Casos por Fase</CardTitle>
          <CardDescription>
            Distribución de casos por fase actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fase</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Monto Asociado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byPhase.map((item) => (
                  <TableRow key={item.phase}>
                    <TableCell>
                      <Badge className={getPhaseBadgeClass(item.phase)}>
                        {item.phase}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* By Service Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Casos por Tipo de Servicio
          </CardTitle>
          <CardDescription>
            Desglose por cada servicio con su contexto financiero
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Casos</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byType.map((item) => (
                  <TableRow key={item.type}>
                    <TableCell className="font-medium">{item.type}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right">
                      {item.showMonetary ? (
                        <>
                          <div>{formatCurrency(item.amount)}</div>
                          <span className="text-muted-foreground text-xs">
                            {item.monetaryLabel}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          N/A
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
