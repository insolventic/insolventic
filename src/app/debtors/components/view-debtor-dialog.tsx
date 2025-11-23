'use client';

import {
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Users,
  Building,
  Calendar,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Debtor } from '@/features/debtor/schemas';

interface ViewDebtorDialogProps {
  debtor: Debtor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewDebtorDialog({
  debtor,
  open,
  onOpenChange,
}: Readonly<ViewDebtorDialogProps>) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getIdTypeLabel = (type: string) => {
    switch (type) {
      case 'CC':
        return 'Cédula de Ciudadanía';
      case 'CE':
        return 'Cédula de Extranjería';
      case 'PA':
        return 'Pasaporte';
      default:
        return type;
    }
  };

  const getMaritalStatusLabel = (status: string | null | undefined) => {
    if (!status) return 'No especificado';
    switch (status) {
      case 'SOLTERO':
        return 'Soltero(a)';
      case 'CASADO':
        return 'Casado(a)';
      case 'UNION_LIBRE':
        return 'Unión Libre';
      case 'DIVORCIADO':
        return 'Divorciado(a)';
      case 'VIUDO':
        return 'Viudo(a)';
      default:
        return status;
    }
  };

  const getEducationLevelLabel = (level: string | null | undefined) => {
    if (!level) return 'No especificado';
    switch (level) {
      case 'PRIMARIA':
        return 'Primaria';
      case 'SECUNDARIA':
        return 'Secundaria';
      case 'TECNICO':
        return 'Técnico';
      case 'UNIVERSITARIO':
        return 'Universitario';
      case 'POSTGRADO':
        return 'Postgrado';
      default:
        return level;
    }
  };

  const getAccountTypeLabel = (type: string | null | undefined) => {
    if (!type) return 'No especificado';
    switch (type) {
      case 'AHORROS':
        return 'Ahorros';
      case 'CORRIENTE':
        return 'Corriente';
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Información del Deudor</DialogTitle>
          <DialogDescription>
            Detalles completos de {debtor.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="financial">Financiero</TabsTrigger>
            <TabsTrigger value="contact">Contacto</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <User className="mr-2 h-5 w-5" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">
                    Nombre Completo
                  </p>
                  <p className="font-medium">{debtor.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Documento</p>
                  <p className="font-medium">
                    {getIdTypeLabel(debtor.idType)} {debtor.idNumber}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Estado Civil</p>
                  <p className="font-medium">
                    {getMaritalStatusLabel(debtor.maritalStatus)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Personas a Cargo
                  </p>
                  <p className="font-medium">{debtor.dependents ?? 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Calendar className="mr-2 h-5 w-5" />
                  Información de Deuda
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Deuda Total</p>
                  <p className="text-lg font-medium">
                    {formatCurrency(debtor.totalDebt)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Casos Activos</p>
                  <p className="text-lg font-medium">{debtor.activeCases}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Información Laboral y Financiera
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Ocupación</p>
                  <p className="font-medium">{debtor.occupation}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Nivel Educativo
                  </p>
                  <p className="font-medium">
                    {getEducationLevelLabel(debtor.educationLevel)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Ingresos Mensuales
                  </p>
                  <p className="font-medium">
                    {formatCurrency(debtor.monthlyIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Gastos Mensuales
                  </p>
                  <p className="font-medium">
                    {formatCurrency(debtor.monthlyExpenses ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Building className="mr-2 h-5 w-5" />
                  Información Bancaria
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Banco</p>
                  <p className="font-medium">
                    {debtor.bankName ?? 'No especificado'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    Tipo de Cuenta
                  </p>
                  <p className="font-medium">
                    {getAccountTypeLabel(debtor.accountType)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-sm">
                    Número de Cuenta
                  </p>
                  <p className="font-medium">
                    {debtor.bankAccount ?? 'No especificado'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <MapPin className="mr-2 h-5 w-5" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Email</p>
                  <p className="flex items-center font-medium">
                    <Mail className="mr-2 h-4 w-4" />
                    {debtor.email}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Teléfono</p>
                  <p className="flex items-center font-medium">
                    <Phone className="mr-2 h-4 w-4" />
                    {debtor.phone}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-sm">Dirección</p>
                  <p className="font-medium">{debtor.address}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Ciudad</p>
                  <p className="font-medium">{debtor.city}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Departamento</p>
                  <p className="font-medium">{debtor.department}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Users className="mr-2 h-5 w-5" />
                  Contacto de Emergencia
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">Nombre</p>
                  <p className="font-medium">
                    {debtor.emergencyContact ?? 'No especificado'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Teléfono</p>
                  <p className="font-medium">
                    {debtor.emergencyPhone ?? 'No especificado'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {debtor.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notas Adicionales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {debtor.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
