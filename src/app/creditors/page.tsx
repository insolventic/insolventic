export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { getAllCreditors } from '@/features/creditor/actions';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { CreditorManagement } from './components/creditor-management';

export default async function CreditorsPage() {
  // Verify authentication server-side before rendering
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect('/login?redirect=/creditors');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect('/login?redirect=/creditors');
  }

  const { data: creditors } = await getAllCreditors();

  return (
    <PermissionGuard
      permission="Ver acreedores"
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
                No tienes permisos para ver acreedores.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <div className="bg-background min-h-screen">
        <DashboardHeader />

        <main className="container mx-auto px-4 py-6">
          <CreditorManagement creditors={creditors || []} />
        </main>
      </div>
    </PermissionGuard>
  );
}
