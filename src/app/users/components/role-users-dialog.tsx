'use client';

import { Users, Mail, Phone, Calendar, UserCheck, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface RoleUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  users: User[];
}

export function RoleUsersDialog({
  open,
  onOpenChange,
  role,
  users,
}: Readonly<RoleUsersDialogProps>) {
  if (!role) return null;

  const roleUsers = users.filter((user) => user?.role?.name === role?.name);

  const formatLastLogin = (lastLogin: string) => {
    if (lastLogin === 'Nunca') return 'Nunca';
    return new Date(lastLogin).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuarios con rol: {role?.name ?? 'N/A'}
          </DialogTitle>
          <DialogDescription>
            Lista de usuarios asignados al rol &quot;{role?.name ?? 'N/A'}&quot;
            ({roleUsers.length} usuarios)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Información del Rol</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Nombre del Rol
                  </p>
                  <p className="text-lg font-semibold">{role?.name ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Descripción
                  </p>
                  <p className="text-foreground text-sm">
                    {role?.description ?? 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Usuarios Asignados
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className={role?.color ?? ''}>
                      {roleUsers.length}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      usuarios
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-sm font-medium">
                  Permisos del Rol
                </p>
                <div className="flex flex-wrap gap-2">
                  {(role?.permissions ?? []).map((permission, index) => (
                    <Badge
                      key={`${permission}-${index}`}
                      variant="outline"
                      className="text-xs"
                    >
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {roleUsers.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Usuarios Asignados</CardTitle>
                <CardDescription>
                  Detalles de los usuarios que tienen el rol &quot;{role.name}
                  &quot;
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Casos Asignados</TableHead>
                        <TableHead>Último Acceso</TableHead>
                        <TableHead>Tarjeta Profesional</TableHead>
                        <TableHead>Contacto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{user.name}</p>
                              <div className="text-muted-foreground flex items-center text-sm">
                                <Mail className="mr-1 h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <UserCheck className="text-primary mr-2 h-4 w-4" />
                              {user?.assignedCases.length ?? 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm">
                              <Clock className="text-muted-foreground mr-1 h-3 w-3" />
                              {formatLastLogin(
                                user?.lastLogin
                                  ? user.lastLogin.toISOString()
                                  : 'Nunca',
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {user.professionalCard}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center">
                                <Phone className="text-muted-foreground mr-1 h-3 w-3" />
                                {user.phone}
                              </div>
                              <div className="flex items-center">
                                <Calendar className="text-muted-foreground mr-1 h-3 w-3" />
                                Desde{' '}
                                {new Date(user.createdDate).toLocaleDateString(
                                  'es-CO',
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="py-8 text-center">
                <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="text-foreground mb-2 text-lg font-medium">
                  No hay usuarios asignados
                </h3>
                <p className="text-muted-foreground">
                  Actualmente no hay usuarios con el rol &quot;{role.name}&quot;
                </p>
              </CardContent>
            </Card>
          )}

          {roleUsers.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total de Usuarios
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {roleUsers.length}
                      </p>
                    </div>
                    <UserCheck className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total Casos
                      </p>
                      <p className="text-primary text-2xl font-bold">
                        {roleUsers.reduce(
                          (sum, u) => sum + (u?.assignedCases.length ?? 0),
                          0,
                        )}
                      </p>
                    </div>
                    <Users className="text-primary h-8 w-8" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Promedio Casos
                      </p>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round(
                          roleUsers.reduce(
                            (sum, u) => sum + (u?.assignedCases.length ?? 0),
                            0,
                          ) / roleUsers.length,
                        )}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Con Tarjeta Prof.
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        {
                          roleUsers.filter((u) => u.professionalCard !== 'N/A')
                            .length
                        }
                      </p>
                    </div>
                    <Badge className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
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
