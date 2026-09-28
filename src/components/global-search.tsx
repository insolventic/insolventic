'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';

/**
 * Búsqueda global — la parte liviana: botón, atajo Ctrl/Cmd+K y estado.
 *
 * El diálogo (`cmdk` + resultados) vive en `global-search-dialog.tsx` y se
 * carga con `next/dynamic` recién cuando se pide la búsqueda por primera vez.
 * Este componente está en el header que renderizan casi todas las pantallas,
 * así que importar `cmdk` aquí lo mandaba en el JS inicial de todas ellas.
 *
 * - `ssr: false`: el diálogo solo existe tras una acción del usuario.
 * - Precarga por intención (hover/foco/toque del botón): al abrir, el chunk
 *   suele estar ya descargado.
 * - El atajo Ctrl/Cmd+K se registra aquí (siempre activo); la primera vez
 *   espera a que baje el chunk, unos pocos kB.
 */

const loadDialog = () =>
  import('./global-search-dialog').then((mod) => mod.GlobalSearchDialog);

const GlobalSearchDialog = dynamic(loadDialog, { ssr: false });

/** Empieza a descargar el chunk del diálogo sin abrirlo. */
function preloadDialog(): void {
  void loadDialog();
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  // El diálogo se monta la primera vez que se pide y ya no se desmonta:
  // conserva la consulta y los resultados entre aperturas, como antes.
  const [requested, setRequested] = useState(false);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setRequested(true);
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      <button
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
        onMouseEnter={preloadDialog}
        onFocus={preloadDialog}
        onTouchStart={preloadDialog}
        className="text-muted-foreground hover:bg-accent flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="bg-muted pointer-events-none hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>

      {requested && <GlobalSearchDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
