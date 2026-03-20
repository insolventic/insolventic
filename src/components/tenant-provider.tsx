'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';

import {
  getTenantTheme,
  TENANT_THEMES,
  type TenantTheme,
} from '@/lib/tenant-theme';
import { useAuth } from '@/hooks/use-auth';

const TenantContext = createContext<TenantTheme | null>(null);

/**
 * Applies the tenant CSS custom properties on <html>.
 *
 * Inline styles on documentElement override the :root / .dark values in
 * globals.css, so every component that uses `bg-primary`, `text-primary`,
 * `ring-primary`, etc. automatically reflects the tenant identity.
 */
function applyTenantStyles(theme: TenantTheme, isDark: boolean) {
  const accent = isDark ? theme.accentDark : theme.accentLight;
  const fg = isDark ? theme.accentForegroundDark : theme.accentForegroundLight;

  const el = document.documentElement;
  el.style.setProperty('--tenant-accent', accent);
  el.style.setProperty('--tenant-accent-foreground', fg);
  el.style.setProperty('--primary', accent);
  el.style.setProperty('--primary-foreground', fg);
  el.style.setProperty('--ring', accent);
}

function removeTenantStyles() {
  const el = document.documentElement;
  el.style.removeProperty('--tenant-accent');
  el.style.removeProperty('--tenant-accent-foreground');
  el.style.removeProperty('--primary');
  el.style.removeProperty('--primary-foreground');
  el.style.removeProperty('--ring');
}

/**
 * Reads the current user's tenantId from auth (or from localStorage for
 * pre-auth pages like login/register) and sets CSS custom properties
 * (--primary, --primary-foreground, --ring) on <html>, so every component
 * that uses `bg-primary` / `text-primary` etc. reflects the tenant identity.
 *
 * Place this inside ThemeProvider and SessionTimeoutProvider in the layout.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [preAuthTenantId, setPreAuthTenantId] = useState<string | null>(() => {
    // Read localStorage synchronously on first render (SSR-safe guard)
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('selectedDatabase');
    return stored && TENANT_THEMES[stored] ? stored : null;
  });

  // Keep pre-auth tenant in sync with localStorage
  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem('selectedDatabase');
      if (stored && TENANT_THEMES[stored]) {
        setPreAuthTenantId(stored);
      }
    } else {
      setPreAuthTenantId(null);
    }
  }, [user]);

  // Use authenticated user's tenant, or fall back to pre-auth selection
  const activeTenantId = user?.tenantId ?? preAuthTenantId;

  const tenantTheme = useMemo(
    () => getTenantTheme(activeTenantId),
    [activeTenantId],
  );

  // Apply / update tenant CSS custom properties
  useEffect(() => {
    if (!activeTenantId) return;

    const isDark = resolvedTheme === 'dark';
    applyTenantStyles(tenantTheme, isDark);

    // Only remove styles when the component truly unmounts (no tenant),
    // NOT on every dependency change — that would flash the default blue.
    return () => {
      // We only clean up when the provider unmounts entirely.
      // If the effect re-runs (theme/tenant changed), the new invocation
      // immediately overwrites the properties, so no flash occurs.
    };
  }, [tenantTheme, resolvedTheme, activeTenantId]);

  // Clean up on true unmount (e.g. root layout teardown)
  useEffect(() => {
    return () => {
      removeTenantStyles();
    };
  }, []);

  return (
    <TenantContext.Provider value={tenantTheme}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Access the current tenant's theme config from any client component.
 */
export function useTenant(): TenantTheme {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    return getTenantTheme(null);
  }
  return ctx;
}
