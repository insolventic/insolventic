'use client';

import { Search, Filter, Eye, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import { useAuth } from '@/hooks/use-auth';

import { CreateUserButton } from './create-user-button';
import { EditUserDialog } from './edit-user-dialog';
import { DeleteUserDialog } from './delete-user-dialog';
import { UserDetailsDialog } from './user-details-dialog';

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface UsersTableProps {
  searchParams: {
    search?: string;
    role?: string;
  };
  users: User[];
  roles: Role[];
}

export function UsersTable({
  searchParams,
  users,
  roles,
}: Readonly<UsersTableProps>) {
  const [searchTerm, setSearchTerm] = useState(searchParams.search ?? '');
  const [roleFilter, setRoleFilter] = useState(searchParams.role ?? 'all');
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { checkPermission } = useAuth();

  const canViewUsers = checkPermission('Ver usuarios');
  const canEditUsers = checkPermission('Editar usuarios');
  const canDeleteUsers = checkPermission('Eliminar usuarios');

  const getRoleColor = (role: string) => {
    const roleConfig = roles.find((r) => r.name === role);
    return roleConfig?.color ?? 'bg-gray-100 text-gray-800';
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role.name === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Usuarios</CardTitle>
              <CardDescription>
                Usuarios registrados en el sistema
              </CardDescription>
            </div>
            <CreateUserButton roles={roles} />
          </div>
          <div className="mt-4 flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.name} value={role.name}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Casos Asignados</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead>Tarjeta Profesional</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getRoleColor(user.role.name)}
                      >
                        {user.role.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.assignedCases.length}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {!user.lastLogin
                          ? 'Nunca'
                          : new Date(user.lastLogin).toLocaleString('es-CO')}
                      </span>
                    </TableCell>
                    <TableCell>{user.professionalCard}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingUser(user)}
                          title="Ver detalles"
                          disabled={!canViewUsers}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                          title="Editar usuario"
                          disabled={!canEditUsers}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingUser(user)}
                          title="Eliminar usuario"
                          disabled={!canDeleteUsers}
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

      {viewingUser && (
        <UserDetailsDialog
          user={viewingUser}
          open={!!viewingUser}
          onOpenChange={(open) => !open && setViewingUser(null)}
        />
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          roles={roles}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          open={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
        />
      )}
    </>
  );
}
