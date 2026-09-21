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
import { getAllCases } from '@/features/case/actions';
import { getPhaseBadgeClass, getPhaseLabel } from '@/lib/case-phases';
import type { CaseListItem } from '@/features/case/schemas';

export function RecentCases() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const { success, data, error } = await getAllCases();
        if (success && data) {
          setCases(data.slice(0, 5));
        } else if (error) {
          // Only log non-auth errors to avoid console spam
          if (!error.includes('autorizado') && !error.includes('token')) {
            console.error('Error fetching cases:', error);
          }
        }
      } catch {
        // Silently handle auth errors - user will be redirected
      } finally {
        setLoading(false);
      }
    };

    void fetchCases();
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Insolvencia':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'Conciliación':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Acuerdo de Apoyo':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Casos Recientes</CardTitle>
        <CardDescription>
          Últimos casos ingresados al sistema con su estado actual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Caso</TableHead>
                <TableHead>Deudor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Acreedores</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Cargando casos...
                  </TableCell>
                </TableRow>
              ) : cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    No hay casos recientes
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((case_) => (
                  <TableRow key={case_.id}>
                    <TableCell className="font-medium">
                      {case_.caseNumber}
                    </TableCell>
                    <TableCell>{case_.debtor.name}</TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(case_.type)}>
                        {case_.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPhaseBadgeClass(case_.phase)}>
                        {getPhaseLabel(case_.phase)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                      }).format(case_.totalDebt)}
                    </TableCell>
                    <TableCell>{case_.creditors}</TableCell>
                    <TableCell>
                      {case_.createdDate.toLocaleDateString('es-CO')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
