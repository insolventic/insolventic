'use client';

import {
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Download,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { P } from '@/lib/permissions';

import { CreateDebtorDialog } from './create-debtor-dialog';
import { DeleteDebtorDialog } from './delete-debtor-dialog';
import { DebtorFilterSelect } from './debtor-filter-select';
import { EditDebtorDialog } from './edit-debtor-dialog';
import { ViewDebtorDialog } from './view-debtor-dialog';

import type { Debtor } from '@/features/debtor/schemas';

interface DebtorManagementProps {
  debtors: Debtor[];
}

export function DebtorManagement({ debtors }: Readonly<DebtorManagementProps>) {
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get('search') ?? '',
  );
  const [occupationFilter, setOccupationFilter] = useState('all');

  const { checkPermission } = useAuth();
  const canViewDebtors = checkPermission(P.VER_DEUDORES);
  const canCreateDebtors = checkPermission(P.CREAR_DEUDORES);
  const canEditDebtors = checkPermission(P.EDITAR_DEUDORES);
  const canDeleteDebtors = checkPermission(P.ELIMINAR_DEUDORES);

  const [openCreateDebtorDialog, setOpenCreateDebtorDialog] = useState(false);
  const [openEditDebtorDialog, setOpenEditDebtorDialog] = useState(false);
  const [openViewDebtorDialog, setOpenViewDebtorDialog] = useState(false);
  const [openDeleteDebtorDialog, setOpenDeleteDebtorDialog] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);

  const handleViewDebtor = (debtor: Debtor) => {
    setSelectedDebtor(debtor);
    setOpenViewDebtorDialog(true);
  };

  const handleEditDebtor = (debtor: Debtor) => {
    setSelectedDebtor(debtor);
    setOpenEditDebtorDialog(true);
  };

  const handleDeleteDebtor = (debtor: Debtor) => {
    setSelectedDebtor(debtor);
    setOpenDeleteDebtorDialog(true);
  };

  const handleDebtorCreated = () => {
    setOpenCreateDebtorDialog(false);
  };

  const handleDebtorUpdated = () => {
    setOpenEditDebtorDialog(false);
    setSelectedDebtor(null);
  };

  const handleDebtorDeleted = () => {
    setOpenDeleteDebtorDialog(false);
    setSelectedDebtor(null);
  };

  // Get unique occupations from debtors
  const uniqueOccupations = Array.from(
    new Set(debtors.map((debtor) => debtor.occupation).filter(Boolean)),
  ).sort();

  const filteredDebtors = debtors.filter((debtor) => {
    const matchesSearch =
      debtor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.idNumber.includes(searchTerm);
    const matchesOccupation =
      occupationFilter === 'all' || debtor.occupation === occupationFilter;
    return matchesSearch && matchesOccupation;
  });

  const exportToCSV = (data: Debtor[], filename: string) => {
    if (!data || data.length === 0) {
      toast.info('No hay datos para exportar.');
      return;
    }

    const spanishHeaders: Record<string, string> = {
      id: 'ID',
      name: 'Nombre',
      idNumber: 'Número de Identificación',
      idType: 'Tipo de Identificación',
      email: 'Correo Electrónico',
      phone: 'Teléfono',
      address: 'Dirección',
      city: 'Ciudad',
      department: 'Departamento',
      birthDate: 'Fecha de Nacimiento',
      maritalStatus: 'Estado Civil',
      occupation: 'Ocupación',
      monthlyIncome: 'Ingresos Mensuales',
      monthlyExpenses: 'Gastos Mensuales',
      dependents: 'Dependientes',
      educationLevel: 'Nivel Educativo',
      totalDebt: 'Deuda Total',
      status: 'Estado',
      emergencyContact: 'Contacto de Emergencia',
      emergencyPhone: 'Teléfono de Emergencia',
      bankAccount: 'Cuenta Bancaria',
      bankName: 'Nombre del Banco',
      accountType: 'Tipo de Cuenta',
      description: 'Descripción',
      activeCases: 'Casos Activos',
      createdDate: 'Fecha de Creación',
      lastUpdate: 'Última Actualización',
    };

    const csvRows = [];

    const headers = Object.keys(data[0]);
    const spanishHeaderRow = headers.map(
      (header) => spanishHeaders[header] || header,
    );
    csvRows.push(spanishHeaderRow.join(','));

    for (const row of data) {
      const values = headers.map((header) => {
        const cellValue = (row as unknown as Record<string, unknown>)[header];
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Deudores</CardTitle>
              <CardDescription>
                Personas naturales en proceso de insolvencia
              </CardDescription>
            </div>
            <Button
              onClick={() => setOpenCreateDebtorDialog(true)}
              disabled={!canCreateDebtors}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Deudor
            </Button>
          </div>
          <div className="mt-4 flex items-center space-x-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                placeholder="Buscar deudores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10"
              />
            </div>
            <DebtorFilterSelect
              value={occupationFilter}
              onValueChange={setOccupationFilter}
              placeholder="Filtrar por ocupación"
              className="w-56"
              includeAllOption={true}
              allOptionLabel="Todas las ocupaciones"
              occupations={uniqueOccupations}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filteredDebtors, 'deudores.csv')}
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
                  <TableHead>Deudor</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Ocupación</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Deuda Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebtors.map((debtor) => (
                  <TableRow key={debtor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{debtor.name}</p>
                        <p className="text-muted-foreground flex items-center text-sm">
                          <MapPin className="mr-1 h-3 w-3" />
                          {debtor.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{debtor.idNumber}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="flex items-center text-sm">
                          <Mail className="mr-1 h-3 w-3" />
                          {debtor.email}
                        </p>
                        <p className="flex items-center text-sm">
                          <Phone className="mr-1 h-3 w-3" />
                          {debtor.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{debtor.occupation}</TableCell>
                    <TableCell>
                      {formatCurrency(debtor.monthlyIncome)}
                    </TableCell>
                    <TableCell>{formatCurrency(debtor.totalDebt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDebtor(debtor)}
                          disabled={!canViewDebtors}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDebtor(debtor)}
                          disabled={!canEditDebtors}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDebtor(debtor)}
                          disabled={!canDeleteDebtors}
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
        </CardContent>
      </Card>

      <CreateDebtorDialog
        open={openCreateDebtorDialog}
        onOpenChange={setOpenCreateDebtorDialog}
        onDebtorCreated={handleDebtorCreated}
      />

      {selectedDebtor && (
        <EditDebtorDialog
          debtor={selectedDebtor}
          open={openEditDebtorDialog}
          onOpenChange={setOpenEditDebtorDialog}
          onDebtorUpdated={handleDebtorUpdated}
        />
      )}

      {selectedDebtor && (
        <ViewDebtorDialog
          debtor={selectedDebtor}
          open={openViewDebtorDialog}
          onOpenChange={setOpenViewDebtorDialog}
        />
      )}

      {selectedDebtor && (
        <DeleteDebtorDialog
          debtor={selectedDebtor}
          open={openDeleteDebtorDialog}
          onOpenChange={setOpenDeleteDebtorDialog}
          onDebtorDeleted={handleDebtorDeleted}
        />
      )}
    </div>
  );
}
