'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Users, Building } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { globalSearch } from '@/features/search/actions';

/**
 * Diálogo de búsqueda global (la parte pesada: `cmdk` + resultados).
 *
 * No se importa de forma estática: `global-search.tsx` lo carga con
 * `next/dynamic` la primera vez que se pide la búsqueda, para que `cmdk` no
 * viaje en el JS inicial de todas las pantallas que muestran el header.
 * Un test de código fuente (global-search-bundle-guard.test.ts) lo vigila.
 */

const CATEGORY_CONFIG = {
  case: { label: 'Casos', icon: FileText },
  debtor: { label: 'Deudores', icon: Users },
  creditor: { label: 'Acreedores', icon: Building },
} as const;

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'case' | 'debtor' | 'creditor';
  href: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: Readonly<GlobalSearchDialogProps>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const result = await globalSearch(q);
      if (result.success && result.data) {
        setResults(result.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void doSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    setQuery('');
    setResults([]);
    router.push(href);
  };

  // Group results by category
  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar casos, deudores, acreedores..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-b-2" />
          </div>
        ) : (
          <>
            <CommandEmpty>
              {query.length < 2
                ? 'Escriba al menos 2 caracteres para buscar...'
                : 'No se encontraron resultados.'}
            </CommandEmpty>
            {Object.entries(grouped).map(([category, items]) => {
              const config =
                CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
              const Icon = config.icon;
              return (
                <CommandGroup key={category} heading={config.label}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${item.category}-${item.id}`}
                      value={item.title}
                      onSelect={() => handleSelect(item.href)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {item.subtitle}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
