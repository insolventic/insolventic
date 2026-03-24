'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  FileText,
  Users,
  Building,
  UserCog,
  Contact,
  FolderOpen,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { DashboardHeader } from '../../dashboard/components/dashboard-header';
import {
  getAuditLogs,
  getAuditLogUsers,
  exportAuditLogToExcel,
  type GetAuditLogsInput,
} from '@/features/audit-log/actions';

const PAGE_SIZE = 20;

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userCedula: string;
  description: string;
  createdAt: string;
}

const entityTypeLabels: Record<string, string> = {
  case: 'Caso',
  debtor: 'Deudor',
  creditor: 'Acreedor',
  user: 'Usuario',
  role: 'Rol',
  contact: 'Contacto',
  document: 'Documento',
};

const actionLabels: Record<string, string> = {
  created: 'Creación',
  updated: 'Actualización',
  deleted: 'Eliminación',
};

const entityTypeIcons: Record<string, typeof FileText> = {
  case: FileText,
  debtor: Users,
  creditor: Building,
  user: UserCog,
  role: ShieldCheck,
  contact: Contact,
  document: FolderOpen,
};

const actionIcons: Record<string, typeof Plus> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
};

const actionColors: Record<string, string> = {
  created:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  updated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const entityColors: Record<string, string> = {
  case: 'bg-primary/10 text-primary',
  debtor:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  creditor:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  user: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  role: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  contact: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  document: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function AuditLogManagement() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, startTransition] = useTransition();

  // Filters
  const [entityType, setEntityType] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Users for filter
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const loadLogs = useCallback(
    (page: number) => {
      startTransition(async () => {
        const input: GetAuditLogsInput = {
          page,
          pageSize: PAGE_SIZE,
        };

        if (entityType !== 'all') input.entityType = entityType;
        if (action !== 'all') input.action = action;
        if (userId !== 'all') input.userId = userId;
        if (search.trim()) input.search = search.trim();
        if (dateFrom) input.dateFrom = dateFrom;
        if (dateTo) input.dateTo = dateTo;

        const result = await getAuditLogs(input);
        if (result.success && result.data) {
          setLogs(result.data.logs);
          setTotal(result.data.total);
          setTotalPages(result.data.totalPages);
          setCurrentPage(result.data.page);
        }
      });
    },
    [entityType, action, userId, search, dateFrom, dateTo],
  );

  const loadUsers = useCallback(async () => {
    const result = await getAuditLogUsers();
    if (result.success && result.data) {
      setUsers(result.data);
    }
  }, []);

  useEffect(() => {
    loadLogs(1);
    loadUsers();
  }, [loadLogs, loadUsers]);

  const handleFilter = () => {
    setCurrentPage(1);
    loadLogs(1);
  };

  const handleClearFilters = () => {
    setEntityType('all');
    setAction('all');
    setUserId('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      const result = await exportAuditLogToExcel({
        page: 1,
        pageSize: 10000,
        entityType: entityType !== 'all' ? entityType : undefined,
        action: action !== 'all' ? action : undefined,
        userId: userId !== 'all' ? userId : undefined,
        search: search || undefined,
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
        a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      console.error('Error exporting audit log');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-background min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="text-primary h-8 w-8" />
          <div>
            <h1 className="text-foreground text-2xl font-bold">
              Registro de Auditoría
            </h1>
            <p className="text-muted-foreground text-sm">
              Historial inmutable de todas las acciones realizadas en el sistema
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto text-sm">
            {total} registros
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Search */}
              <div className="relative xl:col-span-2">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nombre, usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                  className="pl-9"
                />
              </div>

              {/* Entity Type */}
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las entidades</SelectItem>
                  <SelectItem value="case">Casos</SelectItem>
                  <SelectItem value="debtor">Deudores</SelectItem>
                  <SelectItem value="creditor">Acreedores</SelectItem>
                  <SelectItem value="user">Usuarios</SelectItem>
                  <SelectItem value="role">Roles</SelectItem>
                  <SelectItem value="contact">Contactos</SelectItem>
                  <SelectItem value="document">Documentos</SelectItem>
                </SelectContent>
              </Select>

              {/* Action */}
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="created">Creación</SelectItem>
                  <SelectItem value="updated">Actualización</SelectItem>
                  <SelectItem value="deleted">Eliminación</SelectItem>
                </SelectContent>
              </Select>

              {/* User */}
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Apply button */}
              <Button onClick={handleFilter} className="w-full">
                Filtrar
              </Button>
            </div>

            {/* Date filters row */}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-sm">
                  Desde
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-sm">
                  Hasta
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpiar filtros
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registros</CardTitle>
            <CardDescription>
              Mostrando {logs.length} de {total} registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="text-muted-foreground animate-pulse">
                  Cargando registros...
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                <Shield className="mb-3 h-12 w-12 opacity-50" />
                <p>No se encontraron registros de auditoría</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Fecha</TableHead>
                        <TableHead className="w-[100px]">Acción</TableHead>
                        <TableHead className="w-[110px]">Entidad</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="w-[160px]">Usuario</TableHead>
                        <TableHead className="w-[120px]">Cédula</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const ActionIcon = actionIcons[log.action] || Plus;
                        const EntityIcon =
                          entityTypeIcons[log.entityType] || FileText;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${actionColors[log.action] || ''}`}
                              >
                                <ActionIcon className="mr-1 h-3 w-3" />
                                {actionLabels[log.action] || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${entityColors[log.entityType] || ''}`}
                              >
                                <EntityIcon className="mr-1 h-3 w-3" />
                                {entityTypeLabels[log.entityType] ||
                                  log.entityType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <p
                                className="truncate text-sm"
                                title={log.description}
                              >
                                {log.description}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {log.userName}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {log.userCedula}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => loadLogs(currentPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => loadLogs(currentPage + 1)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
