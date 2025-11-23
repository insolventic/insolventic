'use client';

import { useEffect } from 'react';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import type React from 'react';

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  /**
   * Tiempo de inactividad en minutos antes del logout automático
   * Por defecto: 15 minutos
   */
  timeoutMinutes?: number;
  /**
   * Tiempo en minutos antes del logout para mostrar advertencia
   * Por defecto: 2 minutos
   */
  warningMinutes?: number;
  /**
   * Si está habilitado el auto-logout
   * Por defecto: true
   */
  enabled?: boolean;
}

/**
 * Componente que proporciona funcionalidad de timeout de sesión automático
 * por inactividad del usuario. Debe ser usado como wrapper en el layout principal.
 */
export function SessionTimeoutProvider({
  children,
  timeoutMinutes = 15,
  warningMinutes = 2,
  enabled = true,
}: SessionTimeoutProviderProps) {
  // Convertir minutos a milisegundos
  const timeoutDuration = timeoutMinutes * 60 * 1000;
  const warningDuration = warningMinutes * 60 * 1000;

  console.log('🔧 [SessionTimeoutProvider] Initialized with:', {
    timeoutMinutes,
    warningMinutes,
    enabled,
    timeoutDuration: timeoutDuration + 'ms',
    warningDuration: warningDuration + 'ms',
  });

  // Usar el hook de timeout de sesión
  const { forceInitialize } = useSessionTimeout({
    timeoutDuration,
    warningDuration,
    enabled,
  });

  // Exponer la función globalmente para que pueda ser usada después del login
  useEffect(() => {
    (
      window as unknown as { __sessionTimeoutForceInit?: () => void }
    ).__sessionTimeoutForceInit = forceInitialize;
    return () => {
      delete (window as unknown as { __sessionTimeoutForceInit?: () => void })
        .__sessionTimeoutForceInit;
    };
  }, [forceInitialize]);

  // Este componente solo proporciona la funcionalidad, no renderiza nada visual
  return <>{children}</>;
}
