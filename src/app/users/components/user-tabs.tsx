'use client';

import { useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { RoleCard } from './role-card';
import { RoleManagementButton } from './role-management-button';
import { UsersTable } from './users-table';

import type { User } from '@/features/user/schemas';
import type { Role } from '@/features/role/schemas';

interface UserTabsProps {
  searchParams: {
    search?: string;
    role?: string;
  };
  users: User[];
  roles: Role[];
}

export function UserTabs({
  searchParams,
  users,
  roles,
}: Readonly<UserTabsProps>) {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="users">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="space-y-4">
        <UsersTable searchParams={searchParams} users={users} roles={roles} />
      </TabsContent>

      <TabsContent value="roles" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Roles y Permisos</CardTitle>
                <CardDescription>
                  Configure los roles del sistema y sus permisos asociados
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto">
                <RoleManagementButton />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <RoleCard key={role.id} role={role} users={users} />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
