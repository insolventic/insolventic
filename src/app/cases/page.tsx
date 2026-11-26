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
import type { CasesPage, CaseStats } from '@/features/case/schemas';
import { logger } from '@/lib/logger';

import { DashboardHeader } from '../dashboard/components/dashboard-header';
import { CasesContent } from './components/cases-content';
import { CasesLoadError } from './components/cases-load-error';

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

/**
 * El listado y las estadísticas, o `null` si cualquiera de los dos no se pudo
 * cargar.
 *
 * Antes la página caía a `{ items: [], total: 0 }` cuando `getAllCases`
 * fallaba, y la pantalla decía "Total Casos 0" sin avisar: el 2026-11-13 un
 * Preview contra una rama de Neon sin la columna `deleted_at` se veía vacío
 * con 3 casos en la base. Un fallo de carga no es una lista vacía, así que
 * acá no hay valores por defecto: con error, la página muestra un aviso.
 *
 * Las estadísticas cuentan igual: unos contadores en cero junto a la lista
 * engañan del mismo modo. El detalle (que puede ser el mensaje crudo de
 * Prisma) se registra y no viaja al navegador.
 */
async function cargarCasos(
  filtros: Parameters<typeof getAllCases>[0],
): Promise<{ casesPage: CasesPage; stats: CaseStats } | null> {
  try {
    const [casesResult, statsResult] = await Promise.all([
      getAllCases(filtros),
      getCaseStats(),
    ]);
    if (
      casesResult.success &&
      casesResult.data &&
      statsResult.success &&
      statsResult.data
    ) {
      return { casesPage: casesResult.data, stats: statsResult.data };
    }
    logger.warn('No se pudo cargar /cases', {
      action: 'cases-page',
      casos: casesResult.success ? 'ok' : casesResult.error,
      estadisticas: statsResult.success ? 'ok' : statsResult.error,
    });
    return null;
  } catch (error) {
    // Las acciones atrapan sus propios errores; esto es lo que se les escapa.
    logger.error('Excepción al cargar /cases', error, {
      action: 'cases-page',
    });
    return null;
  }
}

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

  const carga = await cargarCasos(filtros);

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
      {carga ? (
        <CasesContent
          casesPage={carga.casesPage}
          filtros={{
            search: filtros.search ?? '',
            phase: filtros.phase ?? 'all',
            type: filtros.type ?? 'all',
          }}
          stats={carga.stats}
        />
      ) : (
        <CasesLoadError />
      )}
    </PermissionGuard>
  );
}
