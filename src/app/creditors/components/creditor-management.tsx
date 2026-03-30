'use client';

import {
  Plus,
  Search,
  Eye,
  Edit,
  Mail,
  Phone,
  MapPin,
  Building,
  Download,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
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
import {
  TablePagination,
  usePagination,
} from '@/components/ui/table-pagination';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';

import { CreateCreditorDialog } from './create-creditor-dialog';
import { CreditorTypeSelect } from './creditor-type-select';
import { DeleteCreditorDialog } from './delete-creditor-dialog';
import { EditCreditorDialog } from './edit-creditor-dialog';
import { ViewCreditorDialog } from './view-creditor-dialog';

import type { Creditor } from '@/features/creditor/schemas';

interface CreditorManagementProps {
  creditors: Creditor[];
}

export function CreditorManagement({
  creditors,
}: Readonly<CreditorManagementProps>) {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get('search') ?? '',
  );
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewingCreditor, setViewingCreditor] = useState<Creditor | null>(null);
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  const [deletingCreditor, setDeletingCreditor] = useState<Creditor | null>(
    null,
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { checkPermission } = useAuth();
  const canViewCreditors = checkPermission(P.VER_ACREEDORES);
  const canCreateCreditors = checkPermission(P.CREAR_ACREEDORES);
  const canEditCreditors = checkPermission(P.EDITAR_ACREEDORES);
  const canDeleteCreditors = checkPermission(P.ELIMINAR_ACREEDORES);

  const getCreditorTypeInSpanish = (type: string) => {
    switch (type) {
      case 'BANK':
        return 'Entidad Financiera';
      case 'COOPERATIVE':
        return 'Cooperativa';
      case 'FINANCIAL':
        return 'Financiera';
      case 'OTHER':
        return 'Otro';
      default:
        return type;
    }
  };

  const filteredCreditors = creditors.filter((creditor) => {
    const matchesSearch =
      creditor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creditor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creditor.nit.includes(searchTerm);
    const matchesType = typeFilter === 'all' || creditor.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const { paginatedItems: paginatedCreditors, paginationProps } = usePagination(
    filteredCreditors,
    20,
  );

  const exportToCSV = (data: Creditor[], filename: string) => {
    if (!data || data.length === 0) {
      toast.info('No hay datos para exportar.');
      return;
    }

    const spanishHeaders: Record<string, string> = {
      id: 'ID',
      name: 'Nombre',
      nit: 'NIT',
      type: 'Tipo',
      email: 'Correo Electrónico',
      phone: 'Teléfono',
      address: 'Dirección',
      city: 'Ciudad',
      department: 'Departamento',
      representative: 'Representante',
      representativeEmail: 'Correo del Representante',
      representativePhone: 'Teléfono del Representante',
      website: 'Sitio Web',
      description: 'Descripción',
      createdDate: 'Fecha de Creación',
      lastUpdate: 'Última Actualización',
      contacts: 'Contactos',
      debts: 'Deudas',
    };

    const csvRows = [];

    const headers = Object.keys(data[0]);
    const spanishHeaderRow = headers.map(
      (header) => spanishHeaders[header] || header,
    );
    csvRows.push(spanishHeaderRow.join(','));

    for (const row of data) {
      const values = headers.map((header) => {
        const cellValue = (row as Record<string, unknown>)[header];
        if (typeof cellValue === 'string') {
          return `"${cellValue.replace(/"/g, '""')}"`;
        }
        if (typeof cellValue === 'number' || typeof cellValue === 'boolean') {
          return cellValue.toString();
        }
        if (cellValue === null || cellValue === undefined) {
          return '';
        }
        return `"${JSON.stringify(cellValue).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvData = csvRows.join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvData], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();

    toast.success(`Los datos se han exportado a ${filename}`);
  };

  const totalDebtAmount = creditors.reduce(
    (sum, c) =>
      sum + c.debts.reduce((debtSum, debt) => debtSum + Number(debt.amount), 0),
    0,
  );
  const averageDebtPerCreditor =
    creditors.length > 0 ? totalDebtAmount / creditors.length : 0;

  return (
    <>
      <div className="space-y-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Total Acreedores
                  </p>
                  <p className="text-2xl font-bold">{creditors.length}</p>
                </div>
                <Building className="text-primary h-8 w-8" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Total Deuda
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(totalDebtAmount)}
                  </p>
                </div>
                <Building className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Promedio Deuda
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(averageDebtPerCreditor)}
                  </p>
                </div>
                <Building className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lista de Acreedores</CardTitle>
                <CardDescription>
                  Entidades financieras y acreedores registrados
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                disabled={!canCreateCreditors}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Acreedor
              </Button>
            </div>
            <div className="mt-4 flex items-center space-x-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  placeholder="Buscar acreedores..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchTerm(e.target.value)
                  }
                  className="w-80 pl-10"
                />
              </div>
              <CreditorTypeSelect
                value={typeFilter}
                onValueChange={setTypeFilter}
                placeholder="Filtrar por tipo"
                className="w-48"
                includeAllOption={true}
                allOptionLabel="Todos los tipos"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(creditors, 'acreedores.csv')}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acreedor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCreditors.map((creditor) => (
                    <TableRow key={creditor.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{creditor.name}</p>
                          <p className="text-muted-foreground flex items-center text-sm">
                            <MapPin className="mr-1 h-3 w-3" />
                            {creditor.address}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCreditorTypeInSpanish(creditor.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{creditor.nit}</TableCell>
                      <TableCell>{creditor.representative}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="flex items-center text-sm">
                            <Mail className="mr-1 h-3 w-3" />
                            {creditor.email}
                          </p>
                          <p className="flex items-center text-sm">
                            <Phone className="mr-1 h-3 w-3" />
                            {creditor.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingCreditor(creditor)}
                            disabled={!canViewCreditors}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCreditor(creditor)}
                            disabled={!canEditCreditors}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingCreditor(creditor)}
                            disabled={!canDeleteCreditors}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination {...paginationProps} itemLabel="acreedores" />
          </CardContent>
        </Card>
      </div>

      <CreateCreditorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreditorCreated={() => setShowCreateDialog(false)}
      />

      <EditCreditorDialog
        creditor={editingCreditor}
        open={!!editingCreditor}
        onOpenChange={(open) => !open && setEditingCreditor(null)}
        onCreditorUpdated={() => setEditingCreditor(null)}
      />

      <ViewCreditorDialog
        creditor={viewingCreditor}
        open={!!viewingCreditor}
        onOpenChange={(open) => !open && setViewingCreditor(null)}
      />

      <DeleteCreditorDialog
        creditor={deletingCreditor}
        open={!!deletingCreditor}
        onOpenChange={(open) => !open && setDeletingCreditor(null)}
        onCreditorDeleted={() => setDeletingCreditor(null)}
      />
    </>
  );
}
