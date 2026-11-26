'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { AvisoErrorCarga } from '@/components/aviso-error-carga';

import { DashboardHeader } from '../../dashboard/components/dashboard-header';

/**
 * Lo que `/cases` muestra cuando no pudo cargar el listado o las
 * estadísticas, en lugar de la lista y los contadores en cero.
 *
 * No recibe el error a propósito: el detalle técnico se registra en el
 * servidor (`page.tsx`) y no viaja al navegador. "Reintentar" vuelve a
 * renderizar la página en el servidor con `router.refresh()`; la página es
 * `force-dynamic`, así que la consulta se repite de verdad.
 */
export function CasesLoadError() {
  const router = useRouter();
  const [reintentando, startTransition] = useTransition();

  return (
    <div className="bg-background min-h-screen">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-foreground mb-6 text-2xl font-bold">
          Gestión de Casos
        </h1>
        <AvisoErrorCarga
          titulo="No se pudieron cargar los casos"
          descripcion="Ocurrió un problema al consultar los expedientes. Sus datos no se perdieron: intente de nuevo en unos segundos y, si el problema continúa, avise al administrador del sistema."
          reintentando={reintentando}
          onReintentar={() => startTransition(() => router.refresh())}
          className="max-w-2xl"
        />
      </main>
    </div>
  );
}
