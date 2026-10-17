import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Envoltorio compartido por /privacidad y /terminos — página pública,
 * accesible sin sesión (ver PUBLIC_ROUTES en src/middleware.ts).
 */
export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/login"
          className="text-primary text-sm hover:underline"
        >
          ← Volver al inicio de sesión
        </Link>

        <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <strong>BORRADOR PENDIENTE DE REVISIÓN LEGAL.</strong> Este
          documento describe, de buena fe, el tratamiento de datos que el
          sistema realiza hoy. No ha sido revisado ni aprobado por un
          abogado y no debe tomarse como asesoría legal ni como constancia
          de cumplimiento de la Ley 1581 de 2012 ni de ninguna otra norma.
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Última actualización: {lastUpdated}
          </p>
        </div>

        <article className="max-w-none space-y-4 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_li]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1">
          {children}
        </article>
      </div>
    </div>
  );
}

/** Marca visible de un dato que solo el cliente (el centro) puede llenar. */
export function Completar({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-yellow-200 px-1 font-mono text-xs text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200">
      ⟨COMPLETAR: {children}⟩
    </span>
  );
}
