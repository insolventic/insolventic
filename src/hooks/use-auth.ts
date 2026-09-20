'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import {
  validateSession,
  logoutUser,
  switchDatabase,
  switchTenant,
} from '@/features/auth/actions';
import type { ValidateSessionResult } from '@/features/auth/schemas';
import { logger } from '@/lib/logger';

type AuthUser = NonNullable<ValidateSessionResult['user']>;

/**
 * ¿Es el error con el que Next señala una redirección (`redirect()`)? Next lo
 * marca con un `digest` que empieza por "NEXT_REDIRECT;" — el mismo criterio
 * que su `isRedirectError` interno, sin importar de `next/dist`.
 */
function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;');
}

interface UseAuthReturn {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  switchDatabase: () => Promise<void>;
  switchTenant: (
    targetTenantSlug: string,
  ) => Promise<{ success: boolean; error?: string }>;
  checkPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  refreshSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const loadingStartTimeRef = useRef<number>(Date.now());
  const lastLogTimeRef = useRef<number>(0);

  // Solo log cada 2 segundos para evitar spam, y cuando hay cambios importantes
  const currentTime = Date.now();
  const shouldLog = currentTime - lastLogTimeRef.current > 2000;

  if ((isLoading || !user) && shouldLog) {
    const loadingDuration = Math.round(
      (currentTime - loadingStartTimeRef.current) / 1000,
    );
    logger.debug('useAuth state', {
      action: 'useAuth',
      hasUser: !!user,
      isLoading,
      loadingDurationSeconds: loadingDuration,
    });
    lastLogTimeRef.current = currentTime;

    // Advertencia si lleva demasiado tiempo loading
    if (loadingDuration > 30) {
      logger.warn('useAuth loading for over 30 seconds', {
        action: 'useAuth',
        loadingDurationSeconds: loadingDuration,
      });
    }
  }

  // Reset loading start time when loading ends
  useEffect(() => {
    if (!isLoading) {
      loadingStartTimeRef.current = Date.now();
    }
  }, [isLoading]);

  const refreshSession = useCallback(async () => {
    try {
      logger.debug('Session refresh started', { action: 'refreshSession' });
      setIsLoading(true);
      const result = await validateSession();

      logger.debug('Session validation result', {
        action: 'refreshSession',
        valid: result?.valid,
        hasUser: !!result?.user,
      });

      if (result?.valid && result.user) {
        setUser((prevUser) => {
          // Solo ejecutar force init si realmente cambió de no autenticado a autenticado
          const wasLoggedOut = !prevUser;

          if (wasLoggedOut && typeof window !== 'undefined') {
            const forceInit = (
              window as unknown as { __sessionTimeoutForceInit?: () => void }
            ).__sessionTimeoutForceInit;
            if (forceInit) {
              logger.debug('Forcing session timeout initialization', {
                action: 'refreshSession',
              });
              // Aumentar el delay para dar más tiempo a que el estado se sincronice
              setTimeout(() => forceInit(), 1000);
            }
          }
          return result.user || null;
        });
      } else {
        logger.debug('Invalid session, clearing user', {
          action: 'refreshSession',
        });
        setUser(null);
      }
    } catch (error) {
      logger.error('Session refresh failed', error, {
        action: 'refreshSession',
      });
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // Eliminar la dependencia de user para evitar el bucle infinito

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Timeout de seguridad para casos donde el loading se queda pegado
  useEffect(() => {
    if (isLoading) {
      // Si el loading toma más de 5 segundos, forzar a falso
      const safetyTimeout = setTimeout(() => {
        logger.warn('useAuth safety timeout triggered', {
          action: 'useAuth',
          timeoutMs: 5000,
        });
        setIsLoading(false);
      }, 5000);

      return () => {
        clearTimeout(safetyTimeout);
      };
    }
  }, [isLoading]);

  const logout = useCallback(async () => {
    try {
      // Clear user state immediately to prevent race conditions
      // where components might try to fetch data during logout
      setUser(null);
      await logoutUser();
    } catch {
      // Next.js redirect() throws an error by design to perform the redirect
      // This is expected behavior, so we just clear the user state
      // The server-side redirect will handle navigation
      logger.debug('Logout redirect triggered (expected behavior)', {
        action: 'logout',
      });
    }
  }, []);

  const switchDatabaseHandler = useCallback(async () => {
    try {
      // Clear user state immediately to prevent race conditions
      setUser(null);
      await switchDatabase();
    } catch (error) {
      // If there's an error, still redirect to home page as fallback
      logger.error('Switch database error', error, {
        action: 'switchDatabase',
      });
      router.push('/');
    }
  }, [router]);

  const switchTenantHandler = useCallback(
    async (targetTenantSlug: string) => {
      try {
        const result = await switchTenant(targetTenantSlug);
        if (!result.success) {
          return result;
        }
        // If successful, the server action will redirect to /dashboard
        // This line is unlikely to be reached due to the redirect
        await refreshSession();
        return result;
      } catch (error) {
        if (isNextRedirectError(error)) {
          // El cambio exitoso termina en redirect('/dashboard') en el servidor y
          // Next rechaza la promesa de la action con un error de redirección:
          // es el camino normal. (También redirige a /login si la sesión ya no
          // es válida.) En ambos casos Next navega.
          logger.debug('Tenant switch redirect triggered (expected behavior)', {
            action: 'switchTenant',
          });
          return { success: true };
        }
        // Cualquier otra excepción (red caída, 5xx, server action inexistente
        // tras un deploy…) es un fallo real: NO puede reportarse como éxito o
        // el usuario cree que cambió de centro cuando no lo hizo. Los fallos de
        // negocio ya vuelven como { success: false } sin lanzar.
        logger.error('Switch tenant error', error, {
          action: 'switchTenant',
          targetTenantSlug,
        });
        return { success: false, error: 'Error al cambiar de organización' };
      }
    },
    [refreshSession],
  );

  const checkPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.some((permission) =>
        user.permissions.includes(permission),
      );
    },
    [user],
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.every((permission) =>
        user.permissions.includes(permission),
      );
    },
    [user],
  );

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
    switchDatabase: switchDatabaseHandler,
    switchTenant: switchTenantHandler,
    checkPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshSession,
  };
}
