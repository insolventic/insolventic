'use client';

import {
  Mail,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Calendar,
  Clock,
  User as UserIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import type { User } from '@/features/user/schemas';

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
}: Readonly<UserDetailsDialogProps>) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Operadora de Insolvencia':
        return 'bg-red-100 text-red-800';
      case 'Abogado':
        return 'bg-blue-100 text-blue-800';
      case 'Asistente Legal':
        return 'bg-green-100 text-green-800';
      case 'Secretaria':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detalles del Usuario</DialogTitle>
          <DialogDescription>
            Información completa de {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start space-x-4 rounded-lg p-4 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <UserIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <p className="text-gray-600">{user.email}</p>
              <div className="mt-2">
                <Badge className={getRoleColor(user.role.name)}>
                  {user.role.name}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              Información de Contacto
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Correo Electrónico</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Teléfono</p>
                  <p className="font-medium">
                    {user.phone || 'No especificado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Dirección</p>
                  <p className="font-medium">
                    {user.address || 'No especificada'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Tarjeta Profesional</p>
                  <p className="font-medium">{user.professionalCard}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              Información Profesional
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Rol</p>
                  <p className="font-medium">{user.role.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Casos Asignados</p>
                  <p className="font-medium">{user.assignedCases.length}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Último Acceso</p>
                  <p className="font-medium">
                    {!user.lastLogin
                      ? 'Nunca'
                      : new Date(user.lastLogin).toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Permisos del Usuario</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {user.role.permissions.map((permission) => (
                <div key={permission} className="flex items-center">
                  <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
                  {permission}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">
              Información del Sistema
            </h4>
            <div className="rounded-lg p-4 shadow-sm">
              <div>
                <p className="text-sm text-gray-600">Fecha de Creación</p>
                <p className="font-medium">
                  {new Date(user.createdDate).toLocaleDateString('es-CO')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
