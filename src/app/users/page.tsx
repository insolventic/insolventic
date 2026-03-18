import { Shield, Users, UserCheck, Settings, AlertCircle } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { verifyToken } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Card, CardContent } from '@/components/ui/card';
import { getAllRoles } from '@/features/role/actions';
import { getAllUsers } from '@/features/user/actions';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { UsersContent } from './components/users-content';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
  }>;
}

export default async function UsersPage({ searchParams }: Readonly<PageProps>) {
  // Verify authentication server-side before rendering
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect('/login?redirect=/users');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect('/login?redirect=/users');
  }

  const params = await searchParams;

  const [usersResult, rolesResult] = await Promise.all([
    getAllUsers(),
    getAllRoles(),
  ]);

  if (!usersResult.success || !rolesResult.success) {
    return (
      <PermissionGuard
        permission="Ver usuarios"
        redirectTo="/dashboard"
        fallback={
          <div className="bg-background min-h-screen">
            <DashboardHeader />
            <main className="container mx-auto px-4 py-6">
              <div className="text-center">
                <h1 className="text-foreground text-2xl font-bold">
                  Acceso Denegado
                </h1>
                <p className="text-muted-foreground">
                  No tienes permisos para ver usuarios.
                </p>
              </div>
            </main>
          </div>
        }
      >
        <div className="bg-background min-h-screen">
          <DashboardHeader />
          <main className="container mx-auto px-4 py-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-12">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <h1 className="text-foreground text-2xl font-bold">
                Error al cargar datos
              </h1>
              <p className="text-muted-foreground text-center">
                {!usersResult.success && 'No se pudieron cargar los usuarios. '}
                {!rolesResult.success && 'No se pudieron cargar los roles. '}
                Por favor, verifica tu conexión e intenta nuevamente.
              </p>
            </div>
          </main>
        </div>
      </PermissionGuard>
    );
  }

  const users = usersResult.data || [];
  const roles = rolesResult.data || [];

  const totalUsersCount = users.length;
  const operatorsCount = users.filter(
    (u) => u.role.name === 'Operadora de Insolvencia',
  ).length;
  const totalCases = users.reduce((sum, u) => sum + u.assignedCases.length, 0);

  return (
    <PermissionGuard
      permission="Ver usuarios"
      redirectTo="/dashboard"
      fallback={
        <div className="bg-background min-h-screen">
          <DashboardHeader />
          <main className="container mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-foreground text-2xl font-bold">
                Acceso Denegado
              </h1>
              <p className="text-muted-foreground">
                No tienes permisos para ver usuarios.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <div className="bg-background min-h-screen">
        <DashboardHeader />

        <main className="container mx-auto px-4 py-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total Usuarios
                      </p>
                      <p className="text-2xl font-bold">{users.length}</p>
                    </div>
                    <Users className="text-primary h-8 w-8" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total de Usuarios
                      </p>
                      <p className="text-2xl font-bold">{totalUsersCount}</p>
                    </div>
                    <UserCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Operadores
                      </p>
                      <p className="text-2xl font-bold">{operatorsCount}</p>
                    </div>
                    <Shield className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Casos Asignados
                      </p>
                      <p className="text-2xl font-bold">{totalCases}</p>
                    </div>
                    <Settings className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <UsersContent
              initialUsers={users}
              roles={roles}
              searchParams={params}
            />
          </div>
        </main>
      </div>
    </PermissionGuard>
  );
}
