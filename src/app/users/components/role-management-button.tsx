'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

import { CreateRoleDialog } from './create-role-dialog';

interface RoleManagementButtonProps {
  onRoleCreated?: () => void;
}

export function RoleManagementButton({
  onRoleCreated,
}: Readonly<RoleManagementButtonProps>) {
  const [showDialog, setShowDialog] = useState(false);
  const { checkPermission } = useAuth();

  const canCreateRoles = checkPermission('Crear roles');

  return (
    <>
      <Button onClick={() => setShowDialog(true)} disabled={!canCreateRoles}>
        <UserPlus className="mr-2 h-4 w-4" />
        Nuevo Rol
      </Button>
      <CreateRoleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onRoleCreated={onRoleCreated}
      />
    </>
  );
}
