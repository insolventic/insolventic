import { Users, DollarSign, Briefcase } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { verifyToken } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { Card, CardContent } from '@/components/ui/card';
import { getAllDebtors } from '@/features/debtor/actions';
import { formatCurrency } from '@/lib/utils';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { DebtorManagement } from './components/debtor-management';

export default async function DebtorsPage() {
  // Verify authentication server-side before rendering
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect('/login?redirect=/debtors');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect('/login?redirect=/debtors');
  }

  const { success, data: debtors, error } = await getAllDebtors();

  if (!success || !debtors) {
    throw new Error(error || 'Error al obtener los deudores');
  }
  const totalDebtors = debtors.length;
  const totalIncome = debtors.reduce((sum, d) => sum + d.monthlyIncome, 0);
  const totalDebt = debtors.reduce((sum, d) => sum + d.totalDebt, 0);

  return (
    <PermissionGuard
      permission="Ver deudores"
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
                No tienes permisos para ver deudores.
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
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total Deudores
                      </p>
                      <p className="text-2xl font-bold">{totalDebtors}</p>
                    </div>
                    <Users className="text-primary h-8 w-8" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Total Ingresos
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(totalIncome)}
                      </p>
                    </div>
                    <Briefcase className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm font-medium">
                        Deuda Total
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(totalDebt)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <DebtorManagement debtors={debtors} />
          </div>
        </main>
      </div>
    </PermissionGuard>
  );
}
