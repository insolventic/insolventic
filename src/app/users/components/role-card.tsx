'use client';

import { Edit, Users, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

import { DeleteRoleDialog } from './delete-role-dialog';
import { EditRoleDialog } from './edit-role-dialog';
import { RoleUsersDialog } from './role-users-dialog';

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface RoleCardProps {
  role: Role;
  users: User[];
}

export function RoleCard({ role, users }: Readonly<RoleCardProps>) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRoleUsersDialog, setShowRoleUsersDialog] = useState(false);

  const { checkPermission } = useAuth();

  const canEditRoles = checkPermission('Editar roles');
  const canDeleteRoles = checkPermission('Eliminar roles');
  const canViewUsers = checkPermission('Ver usuarios');

  const getDeleteButtonTitle = () => {
    if (!canDeleteRoles) {
      return 'No tienes permisos para eliminar roles';
    }
    if (role.users.length > 0) {
      return 'No se puede eliminar un rol con usuarios asignados';
    }
    return '';
  };

  return (
    <>
      <Card className="border transition-shadow hover:shadow-lg">
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{role.name}</h3>
              <p className="text-sm text-gray-600">{role.description}</p>
            </div>
            <div className="text-center">
              <Badge className={role.color}>{role.users.length}</Badge>
              <p className="mt-1 text-xs text-gray-500">usuarios</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Permisos:</p>
            <ul className="space-y-1 text-sm text-gray-600">
              {role.permissions.slice(0, 5).map((permission: string) => (
                <li key={permission} className="flex items-center">
                  <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
                  {permission}
                </li>
              ))}
              {role.permissions.length > 5 && (
                <li className="pl-4 text-xs text-gray-500">
                  +{role.permissions.length - 5} permisos más...
                </li>
              )}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="w-full"
              disabled={!canEditRoles}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRoleUsersDialog(true)}
              className="w-full"
              disabled={!canViewUsers}
            >
              <Users className="mr-2 h-4 w-4" />
              Ver Usuarios
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={!canDeleteRoles || role.users.length > 0}
              className="w-full hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              title={getDeleteButtonTitle()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditRoleDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        role={role}
      />

      <DeleteRoleDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        role={role}
      />

      <RoleUsersDialog
        open={showRoleUsersDialog}
        onOpenChange={setShowRoleUsersDialog}
        role={role}
        users={users}
      />
    </>
  );
}
