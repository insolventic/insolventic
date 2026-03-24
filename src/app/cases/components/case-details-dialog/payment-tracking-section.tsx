'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, CalendarPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { CaseWithRelations } from '@/features/case/schemas';
import {
  getPaymentSchedule,
  generatePaymentSchedule,
  markPaymentPaid,
  type Payment,
} from '@/features/payment/actions';

interface PaymentTrackingSectionProps {
  caseData: CaseWithRelations;
}

const STATUS_CONFIG = {
  pendiente: {
    label: 'Pendiente',
    icon: Clock,
    badgeClass:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  pagado: {
    label: 'Pagado',
    icon: CheckCircle,
    badgeClass:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  vencido: {
    label: 'Vencido',
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
} as const;

function getEffectiveStatus(payment: Payment): keyof typeof STATUS_CONFIG {
  if (payment.status === 'pagado') return 'pagado';
  if (
    payment.status === 'pendiente' &&
    new Date(payment.dueDate) < new Date()
  ) {
    return 'vencido';
  }
  return 'pendiente';
}

export function PaymentTrackingSection({
  caseData,
}: Readonly<PaymentTrackingSectionProps>) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPaymentSchedule(caseData.id);
      if (result.success && result.data) {
        setPayments(result.data);
      } else {
        setError(result.error || 'Error al cargar pagos');
      }
    } catch {
      setError('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [caseData.id]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generatePaymentSchedule(caseData.id);
      if (result.success && result.data) {
        setPayments(result.data);
      } else {
        setError(result.error || 'Error al generar cronograma');
      }
    } catch {
      setError('Error al generar cronograma');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    setMarkingPaid(paymentId);
    try {
      const result = await markPaymentPaid(paymentId);
      if (result.success) {
        await loadPayments();
      } else {
        setError(result.error || 'Error al registrar pago');
      }
    } catch {
      setError('Error al registrar pago');
    } finally {
      setMarkingPaid(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === 'pagado').length;
  const paidAmount = payments
    .filter((p) => p.status === 'pagado')
    .reduce((sum, p) => sum + p.amount, 0);
  const overdueCount = payments.filter(
    (p) => getEffectiveStatus(p) === 'vencido',
  ).length;

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seguimiento de Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            No hay cronograma de pagos para este caso.
          </p>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button onClick={handleGenerate} disabled={generating}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            {generating ? 'Generando...' : 'Generar Cronograma de Pagos'}
          </Button>
          <p className="text-muted-foreground text-xs">
            Se generará basado en la propuesta de pago del caso (plazo,
            periodicidad y fecha de inicio).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-muted-foreground text-xs">
              {payments.length} cuotas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Pagado</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(paidAmount)}
            </p>
            <p className="text-muted-foreground text-xs">{paidCount} cuotas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Pendiente</p>
            <p className="text-lg font-bold">
              {formatCurrency(totalAmount - paidAmount)}
            </p>
            <p className="text-muted-foreground text-xs">
              {payments.length - paidCount} cuotas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Vencidas</p>
            <p
              className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`}
            >
              {overdueCount}
            </p>
            <p className="text-muted-foreground text-xs">cuotas atrasadas</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Payments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cronograma de Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-28">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const effectiveStatus = getEffectiveStatus(payment);
                  const config = STATUS_CONFIG[effectiveStatus];
                  const Icon = config.icon;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.paymentNumber}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell>
                        {payment.paidDate ? formatDate(payment.paidDate) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={config.badgeClass}>
                          <Icon className="mr-1 h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {effectiveStatus !== 'pagado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(payment.id)}
                            disabled={markingPaid === payment.id}
                          >
                            {markingPaid === payment.id ? (
                              <div className="border-primary h-3 w-3 animate-spin rounded-full border-b-2" />
                            ) : (
                              <>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Pagar
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
