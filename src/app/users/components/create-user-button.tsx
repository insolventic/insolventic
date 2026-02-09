'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

import { CreateUserDialog } from './create-user-dialog';

import type { Role } from '@/features/role/schemas';

interface CreateUserButtonProps {
  roles: Role[];
}

export function CreateUserButton({ roles }: Readonly<CreateUserButtonProps>) {
  const [showDialog, setShowDialog] = useState(false);
  const { checkPermission } = useAuth();

  const canCreateUsers = checkPermission('Crear usuarios');

  return (
    <>
      <Button onClick={() => setShowDialog(true)} disabled={!canCreateUsers}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Usuario
      </Button>
      <CreateUserDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        roles={roles}
      />
    </>
  );
}
