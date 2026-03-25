'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  DollarSign,
  Plus,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  getPaymentTrackingReport,
  getPaymentHistory,
  getCasesForPayment,
  getCasePaymentSummaries,
  registerPayment,
} from '@/features/payment/actions';
import { PAYMENT_METHODS } from '@/features/payment/constants';
import type {
  PaymentTrackingData,
  PaymentWithRelations,
} from '@/features/payment/actions';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  pagado: {
    label: 'Pagado',
    icon: CheckCircle,
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  pendiente: {
    label: 'Pendiente',
    icon: Clock,
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  vencido: {
    label: 'Vencido',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  parcial: {
    label: 'Parcial',
    icon: Clock,
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

function getEffectiveStatus(payment: PaymentWithRelations): string {
  if (payment.status === 'pagado') return 'pagado';
  if (payment.status === 'parcial') return 'parcial';
  if (
    payment.status === 'pendiente' &&
    payment.dueDate &&
    new Date(payment.dueDate) < new Date()
  ) {
    return 'vencido';
  }
  return payment.status;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaseOption = {
  id: string;
  caseNumber: string;
  debtorName: string;
  debtorId: string;
  totalDebt: number;
  type: string;
};

type CaseSummary = {
  caseId: string;
  caseNumber: string;
  debtorName: string;
  type: string;
  totalObligation: number;
  totalPaid: number;
  totalPendiente: number;
  paymentsCount: number;
  paidCount: number;
  overdueCount: number;
  progressPercent: number;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PaymentTrackingReport() {
  const [activeTab, setActiveTab] = useState<'payments' | 'progress'>(
    'progress',
  );
  const [data, setData] = useState<PaymentTrackingData | null>(null);
  const [caseSummaries, setCaseSummaries] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [caseHistory, setCaseHistory] = useState<{
    payments: PaymentWithRelations[];
    totalObligation: number;
    totalPaid: number;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Registration dialog
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  // Filters
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasReceipt, setHasReceipt] = useState('all');
  const [search, setSearch] = useState('');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const [reportResult, summariesResult] = await Promise.all([
        getPaymentTrackingReport({
          status: status !== 'all' ? status : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          hasReceipt: hasReceipt as 'yes' | 'no' | 'all',
          search: search || undefined,
        }),
        getCasePaymentSummaries(),
      ]);
      if (reportResult.success && reportResult.data) {
        setData(reportResult.data);
      }
      if (summariesResult.success && summariesResult.data) {
        setCaseSummaries(summariesResult.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  const handleFilter = () => {
    setExpandedCase(null);
    setCaseHistory(null);
    void fetchReport();
  };

  const handleClearFilters = () => {
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setHasReceipt('all');
    setSearch('');
    setExpandedCase(null);
    setCaseHistory(null);
    setTimeout(() => void fetchReport(), 0);
  };

  const handleExpandCase = async (caseId: string) => {
    if (expandedCase === caseId) {
      setExpandedCase(null);
      setCaseHistory(null);
      return;
    }
    setExpandedCase(caseId);
    setLoadingHistory(true);
    try {
      const result = await getPaymentHistory(caseId);
      if (result.success && result.data) {
        setCaseHistory(result.data);
      }
    } catch {
      // handle error
    } finally {
      setLoadingHistory(false);
    }
  };

  const openRegisterDialog = async () => {
    setShowRegisterDialog(true);
    if (cases.length === 0) {
      setLoadingCases(true);
      const result = await getCasesForPayment();
      if (result.success && result.data) {
        setCases(result.data);
      }
      setLoadingCases(false);
    }
  };

  const handlePaymentRegistered = () => {
    setShowRegisterDialog(false);
    void fetchReport();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalRecaudado: 0,
    totalPendiente: 0,
    totalVencido: 0,
    casesConPagos: 0,
  };
  const payments = data?.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'progress' ? 'default' : 'outline'}
            onClick={() => setActiveTab('progress')}
          >
            Progreso por Caso
          </Button>
          <Button
            variant={activeTab === 'payments' ? 'default' : 'outline'}
            onClick={() => setActiveTab('payments')}
          >
            Todos los Pagos
          </Button>
        </div>
        <Button onClick={openRegisterDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Pago
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Recaudado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-xl font-bold text-emerald-600 sm:text-2xl">
              {formatCurrency(summary.totalRecaudado)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Pendiente
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-xl font-bold text-yellow-600 sm:text-2xl">
              {formatCurrency(summary.totalPendiente)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Vencido
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-xl font-bold text-red-600 sm:text-2xl">
              {formatCurrency(summary.totalVencido)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Casos con Pagos
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-blue-600 sm:text-2xl">
              {summary.casesConPagos}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab: Progress by Case */}
      {activeTab === 'progress' && (
        <CaseProgressView
          summaries={caseSummaries}
          formatCurrency={formatCurrency}
          onExpandCase={handleExpandCase}
          expandedCase={expandedCase}
          loadingHistory={loadingHistory}
          caseHistory={caseHistory}
          formatDate={formatDate}
        />
      )}

      {/* Tab: All Payments */}
      {activeTab === 'payments' && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Estado
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pagado">Pagado</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Desde
                  </label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Hasta
                  </label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Comprobante
                  </label>
                  <Select value={hasReceipt} onValueChange={setHasReceipt}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Con comprobante</SelectItem>
                      <SelectItem value="no">Sin comprobante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Buscar caso / deudor
                  </label>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-8"
                      onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleFilter} className="flex-1">
                    Filtrar
                  </Button>
                  <Button variant="outline" onClick={handleClearFilters}>
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registro de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  No se encontraron pagos con los filtros seleccionados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caso</TableHead>
                        <TableHead>Deudor</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead>Registrado por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const effectiveStatus = getEffectiveStatus(payment);
                        const config =
                          STATUS_CONFIG[effectiveStatus] ??
                          STATUS_CONFIG.pendiente;
                        const StatusIcon = config.icon;

                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {payment.caseNumber}
                            </TableCell>
                            <TableCell>{payment.debtorName}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>
                              {formatDate(
                                payment.paymentDate ?? payment.dueDate,
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {payment.paymentMethod ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className={config.className}>
                                <StatusIcon className="mr-1 h-3 w-3" />
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
                            <TableCell className="text-muted-foreground text-sm">
                              {payment.registeredByName ?? '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Register Payment Dialog */}
      <RegisterPaymentDialog
        open={showRegisterDialog}
        onOpenChange={setShowRegisterDialog}
        cases={cases}
        loadingCases={loadingCases}
        formatCurrency={formatCurrency}
        onRegistered={handlePaymentRegistered}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case Progress View
// ---------------------------------------------------------------------------

function CaseProgressView({
  summaries,
  formatCurrency,
  onExpandCase,
  expandedCase,
  loadingHistory,
  caseHistory,
  formatDate,
}: {
  summaries: CaseSummary[];
  formatCurrency: (v: number) => string;
  onExpandCase: (caseId: string) => void;
  expandedCase: string | null;
  loadingHistory: boolean;
  caseHistory: {
    payments: PaymentWithRelations[];
    totalObligation: number;
    totalPaid: number;
  } | null;
  formatDate: (d: Date | string | null) => string;
}) {
  if (summaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No hay casos con pagos registrados aún. Usa el botón &quot;Registrar
            Pago&quot; para comenzar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progreso de Pagos por Caso</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Caso</TableHead>
                <TableHead>Deudor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Obligación</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="w-48">Progreso</TableHead>
                <TableHead className="text-center">Cuotas</TableHead>
                <TableHead className="text-center">Vencidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => {
                const isExpanded = expandedCase === s.caseId;
                return (
                  <>
                    <TableRow
                      key={s.caseId}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => onExpandCase(s.caseId)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.caseNumber}
                      </TableCell>
                      <TableCell>{s.debtorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.totalObligation > 0
                          ? formatCurrency(s.totalObligation)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(s.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(s.totalPendiente)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
                            <div
                              className={`h-full rounded-full transition-all ${
                                s.progressPercent >= 100
                                  ? 'bg-emerald-500'
                                  : s.progressPercent >= 50
                                    ? 'bg-blue-500'
                                    : s.progressPercent > 0
                                      ? 'bg-yellow-500'
                                      : 'bg-gray-300'
                              }`}
                              style={{
                                width: `${s.progressPercent}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-medium">
                            {s.progressPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.paidCount}/{s.paymentsCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.overdueCount > 0 ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            {s.overdueCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${s.caseId}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/30 p-4">
                          {loadingHistory ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="border-primary h-5 w-5 animate-spin rounded-full border-b-2" />
                            </div>
                          ) : caseHistory ? (
                            <ExpandedPaymentHistory
                              history={caseHistory}
                              formatCurrency={formatCurrency}
                              formatDate={formatDate}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Expanded Payment History
// ---------------------------------------------------------------------------

function ExpandedPaymentHistory({
  history,
  formatCurrency,
  formatDate,
}: {
  history: {
    payments: PaymentWithRelations[];
    totalObligation: number;
    totalPaid: number;
  };
  formatCurrency: (v: number) => string;
  formatDate: (d: Date | string | null) => string;
}) {
  const { payments, totalObligation, totalPaid } = history;
  const remaining = Math.max(0, totalObligation - totalPaid);
  const progressPercent =
    totalObligation > 0
      ? Math.min(100, Math.round((totalPaid / totalObligation) * 100))
      : 0;

  return (
    <div className="space-y-4">
      {totalObligation > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso de pago</span>
            <span className="font-medium">
              {formatCurrency(totalPaid)} / {formatCurrency(totalObligation)} (
              {progressPercent}%)
            </span>
          </div>
          <div className="bg-muted h-3 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-600">
              Pagado: {formatCurrency(totalPaid)}
            </span>
            <span className="text-orange-600">
              Pendiente: {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Fecha Pago</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p, idx) => {
            const effectiveStatus =
              p.status === 'pagado'
                ? 'pagado'
                : p.status === 'pendiente' &&
                    p.dueDate &&
                    new Date(p.dueDate) < new Date()
                  ? 'vencido'
                  : p.status;
            const config =
              STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.pendiente;
            const StatusIcon = config.icon;

            return (
              <TableRow key={p.id}>
                <TableCell>{p.paymentNumber ?? idx + 1}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.amount)}
                </TableCell>
                <TableCell>{formatDate(p.dueDate)}</TableCell>
                <TableCell>{formatDate(p.paymentDate)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.paymentMethod ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge className={config.className}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.receiptFileUrl ? (
                    <a
                      href={p.receiptFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver
                    </a>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
                  {p.observations ?? '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Payment Dialog
// ---------------------------------------------------------------------------

function RegisterPaymentDialog({
  open,
  onOpenChange,
  cases,
  loadingCases,
  formatCurrency,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cases: CaseOption[];
  loadingCases: boolean;
  formatCurrency: (v: number) => string;
  onRegistered: () => void;
}) {
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [method, setMethod] = useState('');
  const [observations, setObservations] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [caseSearch, setCaseSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const filteredCases = caseSearch
    ? cases.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(caseSearch.toLowerCase()) ||
          c.debtorName.toLowerCase().includes(caseSearch.toLowerCase()),
      )
    : cases;

  const reset = () => {
    setSelectedCaseId('');
    setAmount('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod('');
    setObservations('');
    setReceiptFile(null);
    setError('');
    setCaseSearch('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    if (!selectedCaseId || !amount || parseFloat(amount) <= 0) {
      setError('Selecciona un caso e ingresa un monto válido.');
      return;
    }

    setSubmitting(true);
    setError('');
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

      const result = await registerPayment({
        caseId: selectedCaseId,
        amount: parseFloat(amount),
        paymentDate,
        paymentMethod: method || undefined,
        observations: observations || undefined,
        receipt,
      });

      if (result.success) {
        toast.success('Pago registrado exitosamente');
        reset();
        onRegistered();
      } else {
        setError(result.error ?? 'Error al registrar pago');
      }
    } catch {
      setError('Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Selecciona el caso y registra los detalles del pago con su
            comprobante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Case selector */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Caso <span className="text-red-500">*</span>
            </label>
            {loadingCases ? (
              <div className="flex items-center gap-2 py-2">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2" />
                <span className="text-muted-foreground text-sm">
                  Cargando casos...
                </span>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar por número de caso o deudor..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {filteredCases.length === 0 ? (
                    <p className="text-muted-foreground p-3 text-center text-sm">
                      No se encontraron casos
                    </p>
                  ) : (
                    filteredCases.slice(0, 20).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(c.id);
                          setCaseSearch('');
                        }}
                        className={`hover:bg-muted w-full px-3 py-2 text-left text-sm transition-colors ${
                          selectedCaseId === c.id
                            ? 'bg-primary/10 font-medium'
                            : ''
                        }`}
                      >
                        <span className="font-medium">{c.caseNumber}</span>
                        {' — '}
                        <span className="text-muted-foreground">
                          {c.debtorName}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Selected case info */}
          {selectedCase && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Caso:</span>{' '}
                    <span className="font-medium">
                      {selectedCase.caseNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>{' '}
                    <Badge variant="outline">{selectedCase.type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Deudor:</span>{' '}
                    <span className="font-medium">
                      {selectedCase.debtorName}
                    </span>
                  </div>
                  {selectedCase.totalDebt > 0 && (
                    <div>
                      <span className="text-muted-foreground">Obligación:</span>{' '}
                      <span className="font-medium">
                        {formatCurrency(selectedCase.totalDebt)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Valor pagado <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
            />
          </div>

          {/* Payment date */}
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

          {/* Payment method */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Método de pago
            </label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observations */}
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

          {/* Receipt upload */}
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
                      toast.error('El archivo no puede superar los 10MB');
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
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !selectedCaseId ||
              !amount ||
              parseFloat(amount) <= 0
            }
          >
            {submitting ? 'Registrando...' : 'Registrar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
