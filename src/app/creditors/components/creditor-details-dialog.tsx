'use client';

import {
  Building,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Calendar,
  Globe,
  Users,
  Activity,
  Eye,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Creditor } from '@/features/creditor/schemas';
import type { Contact } from '@/features/contact/schemas';

import type React from 'react';

interface RecentCase {
  id: string;
  caseNumber: string;
  debtorName: string;
  status: string;
  totalDebt: number;
  createdDate: Date;
}

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  timestamp: Date;
  userId: string;
  userName: string;
}

interface CreditorDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditor: Creditor;
}

export function CreditorDetailsDialog({
  open,
  onOpenChange,
  creditor,
}: Readonly<CreditorDetailsDialogProps>) {
  if (!creditor) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Entidad Financiera':
        return 'bg-blue-100 text-blue-800';
      case 'Cooperativa':
        return 'bg-green-100 text-green-800';
      case 'Financiera':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  const recentCases: RecentCase[] = [
    {
      id: 'INS-2025-001',
      caseNumber: 'INS-2025-001',
      debtorName: 'María González Pérez',
      status: 'Insolvencia',
      totalDebt: 15000000,
      createdDate: new Date('2025-01-15'),
    },
    {
      id: 'CON-2025-002',
      caseNumber: 'CON-2025-002',
      debtorName: 'Carlos Rodríguez Silva',
      status: 'Conciliación',
      totalDebt: 8500000,
      createdDate: new Date('2025-01-14'),
    },
  ];

  const activityLog: ActivityLog[] = [
    {
      id: '1',
      action: 'Actualización de información de contacto',
      description: 'Se actualizó la información de contacto del acreedor',
      timestamp: new Date('2025-01-20'),
      userId: '1',
      userName: 'Beatriz Helena Malavera',
    },
    {
      id: '2',
      action: 'Nuevo caso asignado: INS-2025-001',
      description: 'Se asignó un nuevo caso al acreedor',
      timestamp: new Date('2025-01-15'),
      userId: 'system',
      userName: 'Sistema',
    },
    {
      id: '3',
      action: 'Verificación de datos completada',
      description: 'Se completó la verificación de datos del acreedor',
      timestamp: new Date('2025-01-10'),
      userId: '1',
      userName: 'Beatriz Helena Malavera',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Eye className="mr-2 h-5 w-5" />
            Detalles del Acreedor
          </DialogTitle>
          <DialogDescription>
            Información completa de {creditor.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="rounded-lg bg-blue-100 p-3">
                    <Building className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{creditor.name}</h2>
                    <p className="mt-1 flex items-center text-gray-600">
                      <MapPin className="mr-1 h-4 w-4" />
                      {creditor.address}
                    </p>
                    <div className="mt-2 flex items-center space-x-2">
                      <Badge
                        className={getTypeColor(
                          getCreditorTypeInSpanish(creditor.type),
                        )}
                      >
                        {getCreditorTypeInSpanish(creditor.type)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">NIT</p>
                  <p className="font-medium">{creditor.nit}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="representative">Representante</TabsTrigger>
              <TabsTrigger value="contacts">Contactos</TabsTrigger>
              <TabsTrigger value="cases">Casos</TabsTrigger>
              <TabsTrigger value="activity">Actividad</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building className="mr-2 h-5 w-5" />
                      Información de la Entidad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <Badge
                        className={getTypeColor(
                          getCreditorTypeInSpanish(creditor.type),
                        )}
                      >
                        {getCreditorTypeInSpanish(creditor.type)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">NIT:</span>
                      <span className="font-medium">{creditor.nit}</span>
                    </div>
                    {creditor.website && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Sitio Web:</span>
                        <a
                          href={creditor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:underline"
                        >
                          <Globe className="mr-1 h-4 w-4" />
                          Visitar
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Phone className="mr-2 h-5 w-5" />
                      Información de Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{creditor.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{creditor.phone}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="mt-1 h-4 w-4 text-gray-400" />
                      <div>
                        <p>{creditor.address}</p>
                        <p className="text-sm text-gray-600">
                          {creditor.city}, {creditor.department}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="mr-2 h-5 w-5" />
                      Fechas Importantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Fecha de Registro:</span>
                      <span>
                        {new Date(
                          creditor.createdDate ?? Date.now(),
                        ).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Última Actualización:
                      </span>
                      <span>
                        {new Date(
                          creditor.lastUpdate ?? Date.now(),
                        ).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {creditor.description && (
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Descripción</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{creditor.description}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="representative" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Representante Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Nombre Completo
                      </Label>
                      <p className="font-medium">
                        {creditor.representative || 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Cédula
                      </Label>
                      <p className="font-medium">
                        {creditor.representativeId ?? 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Correo Electrónico
                      </Label>
                      <p className="font-medium">
                        {creditor.representativeEmail ?? 'No especificado'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Teléfono
                      </Label>
                      <p className="font-medium">
                        {creditor.representativePhone ?? 'No especificado'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Contactos Adicionales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {creditor.contacts && creditor.contacts.length > 0 ? (
                    <div className="space-y-3">
                      {creditor.contacts.map((contact: Contact) => (
                        <div key={contact.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-gray-600">
                                {contact.role}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="flex items-center">
                                <Mail className="mr-1 h-3 w-3" />
                                {contact.email}
                              </p>
                              <p className="flex items-center">
                                <Phone className="mr-1 h-3 w-3" />
                                {contact.phone}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-gray-500">
                      No hay contactos adicionales registrados
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cases" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Casos Relacionados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Caso</TableHead>
                        <TableHead>Deudor</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCases.map((case_) => (
                        <TableRow key={case_.id}>
                          <TableCell className="font-medium">
                            {case_.id}
                          </TableCell>
                          <TableCell>{case_.debtorName}</TableCell>
                          <TableCell>
                            ${case_.totalDebt.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{case_.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {case_.createdDate.toLocaleDateString('es-CO')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    Registro de Actividad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLog.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.timestamp.toLocaleDateString('es-CO')}
                          </TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.userName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <p className={`text-sm font-medium text-gray-600 ${className}`}>
      {children}
    </p>
  );
}
