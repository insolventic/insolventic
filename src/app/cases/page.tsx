export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { getAllCases, getCaseStats } from '@/features/case/actions';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { CasesContent } from './components/cases-content';

export default async function CasesPage() {
  // Verify authentication server-side before rendering
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect('/login?redirect=/cases');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect('/login?redirect=/cases');
  }

  const [casesResult, statsResult] = await Promise.all([
    getAllCases(),
    getCaseStats(),
  ]);
  const cases = casesResult.data || [];
  const stats = statsResult.data;

  return (
    <PermissionGuard
      permission="Ver casos"
      redirectTo="/dashboard"
      fallback={
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <main className="container mx-auto px-4 py-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Acceso Denegado
              </h1>
              <p className="text-gray-600">
                No tienes permisos para ver casos.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <CasesContent
        cases={cases || []}
        stats={
          stats || {
            total: 0,
            byType: [],
            averageDebt: 0,
            totalDebt: null,
            totalCreditors: null,
          }
        }
      />
    </PermissionGuard>
  );
}
