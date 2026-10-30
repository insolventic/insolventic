export const dynamic = 'force-dynamic';

// C-4: `createCase` dispara la generación inicial vía `after()`, que consume
// el mismo presupuesto de ejecución de la función. Con el default de Vercel
// (10 s en Hobby) el job se cortaba a mitad. 60 s es el máximo en Hobby.
export const maxDuration = 60;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { getAllCases, getCaseStats } from '@/features/case/actions';
import { CASES_PAGE_SIZE_DEFAULT } from '@/features/case/schemas';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { CasesContent } from './components/cases-content';

/**
 * El listado se pide **por página**, y la página y los filtros viven en el
 * query string.
 *
 * Que el estado esté en la URL no es cosmético: así el servidor renderiza
 * siempre la página que el usuario está viendo, y el refresh que disparan las
 * mutaciones (`revalidateTag('cases')`) sigue funcionando sin que el cliente
 * tenga que mantener una copia del listado. También hace compartible un
 * filtro, y `?search=` ya se usaba así.
 *
 * Los valores no se validan acá: `getAllCasesParamsSchema` los acota (página
 * mínima 1, `pageSize` con tope) y cae al default ante cualquier basura.
 */
type CasesSearchParams = Record<string, string | string[] | undefined>;

function soloTexto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined;
}

export default async function CasesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<CasesSearchParams> }>) {
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

  const sp = await searchParams;
  const filtros = {
    page: soloTexto(sp.page),
    pageSize: soloTexto(sp.pageSize),
    search: soloTexto(sp.search),
    phase: soloTexto(sp.phase),
    type: soloTexto(sp.type),
  };

  const [casesResult, statsResult] = await Promise.all([
    getAllCases(filtros),
    getCaseStats(),
  ]);
  const stats = statsResult.data;
  const casesPage = casesResult.data ?? {
    items: [],
    total: 0,
    page: 1,
    pageSize: CASES_PAGE_SIZE_DEFAULT,
  };

  return (
    <PermissionGuard
      permission="Ver casos"
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
                No tienes permisos para ver casos.
              </p>
            </div>
          </main>
        </div>
      }
    >
      <CasesContent
        casesPage={casesPage}
        filtros={{
          search: filtros.search ?? '',
          phase: filtros.phase ?? 'all',
          type: filtros.type ?? 'all',
        }}
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
