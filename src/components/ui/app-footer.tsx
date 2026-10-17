import Link from 'next/link';

/**
 * Pie de la app — enlaces legales (política de privacidad, términos de uso),
 * visibles en toda la app, con o sin sesión. Mismo estilo discreto que
 * `VersionBadge` (esquina inferior, texto mínimo), en la esquina opuesta
 * para no superponerse.
 */
export function AppFooter() {
  return (
    <div className="fixed bottom-2 right-3 z-50 text-[10px] text-muted-foreground/50">
      <Link href="/privacidad" className="hover:underline">
        Privacidad
      </Link>
      {' · '}
      <Link href="/terminos" className="hover:underline">
        Términos
      </Link>
    </div>
  );
}
