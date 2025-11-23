'use client';

import { UserTabs } from './user-tabs';

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface UsersContentProps {
  initialUsers: User[];
  roles: Role[];
  searchParams: {
    search?: string;
    role?: string;
  };
}

export function UsersContent({
  initialUsers,
  roles,
  searchParams,
}: Readonly<UsersContentProps>) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gestión de usuarios y permisos
        </h1>
        <p className="text-gray-600">
          Administre usuarios y permisos del sistema
        </p>
      </div>

      <UserTabs
        searchParams={searchParams}
        users={initialUsers}
        roles={roles}
      />
    </>
  );
}
