'use client';

import {
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  User,
  Hash,
  Calendar,
  Users,
  Building2,
  FileText,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import type { Creditor } from '@/features/creditor/schemas';

interface ViewCreditorDialogProps {
  creditor: Creditor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewCreditorDialog({
  creditor,
  open,
  onOpenChange,
}: Readonly<ViewCreditorDialogProps>) {
  if (!creditor) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Entidad Financiera':
      case 'BANK':
        return <Building className="h-4 w-4" />;
      case 'Cooperativa':
      case 'COOPERATIVE':
        return <Users className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            {getTypeIcon(getCreditorTypeInSpanish(creditor?.type ?? ''))}
            {creditor?.name ?? 'N/A'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Building className="text-muted-foreground h-4 w-4" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Hash className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">NIT</p>
                    <p className="font-medium">{creditor.nit}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">Tipo</p>
                    <p className="font-medium">
                      {getCreditorTypeInSpanish(creditor.type)}
                    </p>
                  </div>
                </div>
                {creditor.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm">Sitio Web</p>
                      <a
                        href={
                          creditor.website.startsWith('http')
                            ? creditor.website
                            : `https://${creditor.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium hover:underline"
                      >
                        {creditor.website}
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Phone className="text-muted-foreground h-4 w-4" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">Email</p>
                    <a
                      href={`mailto:${creditor.email}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {creditor.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">Teléfono</p>
                    <p className="font-medium">{creditor.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">Dirección</p>
                    <p className="font-medium">{creditor.address}</p>
                    {(creditor.city ?? creditor.department) && (
                      <p className="text-muted-foreground text-sm">
                        {[creditor.city, creditor.department]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <User className="text-muted-foreground h-4 w-4" />
                  Representante Legal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm">Nombre</p>
                    <p className="font-medium">{creditor.representative}</p>
                  </div>
                </div>
                {creditor.representativeEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm">Email</p>
                      <a
                        href={`mailto:${creditor.representativeEmail}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {creditor.representativeEmail}
                      </a>
                    </div>
                  </div>
                )}
                {creditor.representativePhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm">Teléfono</p>
                      <p className="font-medium">
                        {creditor.representativePhone}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  Fechas Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {creditor.createdDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm">
                        Fecha de Registro
                      </p>
                      <p className="font-medium">
                        {new Date(creditor.createdDate).toLocaleDateString(
                          'es-CO',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          },
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {creditor.lastUpdate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-muted-foreground text-sm">
                        Última Actualización
                      </p>
                      <p className="font-medium">
                        {new Date(creditor.lastUpdate).toLocaleDateString(
                          'es-CO',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          },
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {creditor.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <FileText className="text-muted-foreground h-4 w-4" />
                  Descripción
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {creditor.description}
                </p>
              </CardContent>
            </Card>
          )}

          {creditor.contacts && creditor.contacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Users className="text-muted-foreground h-4 w-4" />
                  Contactos Adicionales ({creditor.contacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {creditor.contacts.map((contact, index) => (
                    <div key={contact.id}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <User className="text-muted-foreground mt-0.5 h-4 w-4" />
                            <div className="flex-1">
                              <p className="text-muted-foreground text-sm">
                                Nombre
                              </p>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-muted-foreground text-sm">
                                {contact.role}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <Mail className="text-muted-foreground mt-0.5 h-4 w-4" />
                            <div className="flex-1">
                              <p className="text-muted-foreground text-sm">
                                Email
                              </p>
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-primary text-sm font-medium hover:underline"
                              >
                                {contact.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Phone className="text-muted-foreground mt-0.5 h-4 w-4" />
                            <div className="flex-1">
                              <p className="text-muted-foreground text-sm">
                                Teléfono
                              </p>
                              <p className="text-sm font-medium">
                                {contact.phone}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
