'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  CalendarPlus,
  Upload,
  ExternalLink,
  Plus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import type { CaseWithRelations } from '@/features/case/schemas';
import {
  getPaymentSchedule,
  generatePaymentSchedule,
  markPaymentPaid,
  registerPayment,
  type Payment,
} from '@/features/payment/actions';
import { PAYMENT_METHODS } from '@/features/payment/constants';

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
    payment.dueDate &&
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
  const [error, setError] = useState<string | null>(null);

  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [observations, setObservations] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const resetForm = () => {
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentDate('');
    setObservations('');
    setReceiptFile(null);
    setSelectedPayment(null);
    setIsManualPayment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openPayDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsManualPayment(false);
    setPaymentAmount(payment.amount.toString());
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setShowPaymentDialog(true);
  };

  const openManualPayDialog = () => {
    resetForm();
    setIsManualPayment(true);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setShowPaymentDialog(true);
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix: "data:...;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmitPayment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let receipt:
        | { fileName: string; mimeType: string; dataBase64: string }
        | undefined;

      if (receiptFile) {
        const dataBase64 = await readFileAsBase64(receiptFile);
        receipt = {
          fileName: receiptFile.name,
          mimeType: receiptFile.type,
          dataBase64,
        };
      }

      let result: { success: boolean; error?: string };

      if (isManualPayment) {
        result = await registerPayment({
          caseId: caseData.id,
          amount: parseFloat(paymentAmount),
          paymentDate,
          paymentMethod: paymentMethod || undefined,
          observations: observations || undefined,
          receipt,
        });
      } else if (selectedPayment) {
        result = await markPaymentPaid({
          paymentId: selectedPayment.id,
          amount: parseFloat(paymentAmount) || undefined,
          paymentMethod: paymentMethod || undefined,
          observations: observations || undefined,
          receipt,
        });
      } else {
        result = { success: false, error: 'No se seleccionó un pago' };
      }

      if (result.success) {
        setShowPaymentDialog(false);
        resetForm();
        await loadPayments();
      } else {
        setError(result.error || 'Error al registrar pago');
      }
    } catch {
      setError('Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={generating}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              {generating ? 'Generando...' : 'Generar Cronograma de Pagos'}
            </Button>
            <Button variant="outline" onClick={openManualPayDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago Manual
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Se generará basado en la propuesta de pago del caso (plazo,
            periodicidad y fecha de inicio).
          </p>

          {/* Payment Dialog */}
          <PaymentDialog
            open={showPaymentDialog}
            onOpenChange={(open) => {
              setShowPaymentDialog(open);
              if (!open) resetForm();
            }}
            isManual={isManualPayment}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paymentDate={paymentDate}
            setPaymentDate={setPaymentDate}
            observations={observations}
            setObservations={setObservations}
            receiptFile={receiptFile}
            setReceiptFile={setReceiptFile}
            fileInputRef={fileInputRef}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmitPayment}
          />
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

      {/* Action bar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={openManualPayDialog}>
          <Plus className="mr-1 h-4 w-4" />
          Registrar Pago Manual
        </Button>
      </div>

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
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comprobante</TableHead>
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
                        {payment.paymentNumber ?? '—'}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{formatDate(payment.dueDate)}</TableCell>
                      <TableCell>
                        {payment.paymentDate
                          ? formatDate(payment.paymentDate)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {payment.paymentMethod ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={config.badgeClass}>
                          <Icon className="mr-1 h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.receiptFileUrl ? (
                          <a
                            href={payment.receiptFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {effectiveStatus !== 'pagado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPayDialog(payment)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Pagar
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

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) resetForm();
        }}
        isManual={isManualPayment}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        observations={observations}
        setObservations={setObservations}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        fileInputRef={fileInputRef}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmitPayment}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment Dialog Component
// ---------------------------------------------------------------------------

function PaymentDialog({
  open,
  onOpenChange,
  isManual,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  paymentDate,
  setPaymentDate,
  observations,
  setObservations,
  receiptFile,
  setReceiptFile,
  fileInputRef,
  submitting,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isManual: boolean;
  paymentAmount: string;
  setPaymentAmount: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentDate: string;
  setPaymentDate: (v: string) => void;
  observations: string;
  setObservations: (v: string) => void;
  receiptFile: File | null;
  setReceiptFile: (v: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isManual ? 'Registrar Pago Manual' : 'Registrar Pago'}
          </DialogTitle>
          <DialogDescription>
            {isManual
              ? 'Registra un pago no asociado a una cuota programada.'
              : 'Completa la información del pago.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Monto <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
            />
          </div>

          {isManual && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Fecha de pago <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Método de pago
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Observaciones
            </label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas sobre el pago..."
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Comprobante de pago
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" />
                {receiptFile ? 'Cambiar archivo' : 'Adjuntar comprobante'}
              </Button>
              {receiptFile && (
                <span className="text-muted-foreground max-w-[200px] truncate text-sm">
                  {receiptFile.name}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      alert('El archivo no puede superar los 10MB');
                      return;
                    }
                    setReceiptFile(file);
                  }
                }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              PDF, JPG o PNG. Máximo 10MB.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              submitting || !paymentAmount || parseFloat(paymentAmount) <= 0
            }
          >
            {submitting ? 'Registrando...' : 'Registrar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
