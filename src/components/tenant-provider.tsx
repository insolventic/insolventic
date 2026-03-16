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
  const [preAuthTenantId, setPreAuthTenantId] = useState<string | null>(null);

  // Detect tenant from localStorage for pre-auth pages (login, register, etc.)
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

  useEffect(() => {
    // Apply tenant colors when we have any tenant identification
    if (!activeTenantId) return;

    const isDark = resolvedTheme === 'dark';
    const accent = isDark ? tenantTheme.accentDark : tenantTheme.accentLight;
    const fg = isDark
      ? tenantTheme.accentForegroundDark
      : tenantTheme.accentForegroundLight;

    const el = document.documentElement;
    el.style.setProperty('--tenant-accent', accent);
    el.style.setProperty('--tenant-accent-foreground', fg);
    // Override primary so all primary-colored elements reflect tenant identity
    el.style.setProperty('--primary', accent);
    el.style.setProperty('--primary-foreground', fg);
    el.style.setProperty('--ring', accent);

    return () => {
      el.style.removeProperty('--tenant-accent');
      el.style.removeProperty('--tenant-accent-foreground');
      el.style.removeProperty('--primary');
      el.style.removeProperty('--primary-foreground');
      el.style.removeProperty('--ring');
    };
  }, [tenantTheme, resolvedTheme, activeTenantId]);

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
