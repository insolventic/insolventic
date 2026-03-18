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

type AuthUser = NonNullable<ValidateSessionResult['user']>;

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
    console.log('🔍 [useAuth] Current state:', {
      hasUser: !!user,
      userName: user?.name || 'N/A',
      isLoading,
      isAuthenticated: !!user,
      loadingDuration: loadingDuration + 's',
    });
    lastLogTimeRef.current = currentTime;

    // Advertencia si lleva demasiado tiempo loading
    if (loadingDuration > 30) {
      console.warn(
        '⚠️ [useAuth] Loading for over 30 seconds - potential issue detected',
      );
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
      console.log('🔄 [useAuth] Starting session refresh...');
      setIsLoading(true);
      const result = await validateSession();

      console.log('📋 [useAuth] Session validation result:', {
        valid: result?.valid,
        hasUser: !!result?.user,
        userName: result?.user?.name || 'N/A',
      });

      if (result?.valid && result.user) {
        setUser((prevUser) => {
          // Solo ejecutar force init si realmente cambió de no autenticado a autenticado
          const wasLoggedOut = !prevUser;
          console.log('👤 [useAuth] Setting user:', {
            wasLoggedOut,
            newUserName: result.user?.name,
          });

          if (wasLoggedOut && typeof window !== 'undefined') {
            const forceInit = (
              window as unknown as { __sessionTimeoutForceInit?: () => void }
            ).__sessionTimeoutForceInit;
            if (forceInit) {
              console.log(
                '🚀 [useAuth] User just logged in, forcing session timeout initialization',
              );
              // Aumentar el delay para dar más tiempo a que el estado se sincronice
              setTimeout(() => forceInit(), 1000);
            }
          }
          return result.user || null;
        });
      } else {
        console.log('❌ [useAuth] Invalid session, clearing user');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ [useAuth] Session refresh failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('✅ [useAuth] Session refresh completed');
    }
  }, []); // Eliminar la dependencia de user para evitar el bucle infinito

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Timeout de seguridad para casos donde el loading se queda pegado
  useEffect(() => {
    if (isLoading) {
      console.log(
        '🔍 [useAuth] Loading state detected, setting safety timeout...',
      );

      // Si el loading toma más de 5 segundos, forzar a falso
      const safetyTimeout = setTimeout(() => {
        console.log(
          '⚠️ [useAuth] Safety timeout triggered - forcing loading to false',
        );
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
      console.log('Logout redirect triggered (expected behavior)');
    }
  }, []);

  const switchDatabaseHandler = useCallback(async () => {
    try {
      // Clear user state immediately to prevent race conditions
      setUser(null);
      await switchDatabase();
    } catch (error) {
      // If there's an error, still redirect to home page as fallback
      console.error('Switch database error:', error);
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
        // redirect() throws an error by design in Next.js
        console.log('Tenant switch redirect triggered (expected behavior)');
        return { success: true };
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
