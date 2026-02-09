'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { useAuth } from './use-auth';

interface UseSessionTimeoutOptions {
  /**
   * Tiempo de inactividad en milisegundos antes del logout automático
   * Por defecto: 15 minutos (900000 ms)
   */
  timeoutDuration?: number;
  /**
   * Tiempo en milisegundos antes del logout para mostrar advertencia
   * Por defecto: 2 minutos (120000 ms)
   */
  warningDuration?: number;
  /**
   * Si está habilitado el auto-logout
   * Por defecto: true
   */
  enabled?: boolean;
}

interface UseSessionTimeoutReturn {
  /**
   * Resetea el timer de inactividad manualmente
   */
  resetTimer: () => void;
  /**
   * Tiempo restante en milisegundos hasta el logout automático
   */
  timeRemaining: number;
  /**
   * Si se está mostrando la advertencia de expiración
   */
  isWarningActive: boolean;
  /**
   * Fuerza la inicialización del sistema de timeout (útil después del login)
   */
  forceInitialize: () => void;
}

export function useSessionTimeout(
  options: UseSessionTimeoutOptions = {},
): UseSessionTimeoutReturn {
  const {
    timeoutDuration = 15 * 60 * 1000, // 15 minutos
    warningDuration = 2 * 60 * 1000, // 2 minutos
    enabled = true,
  } = options;

  console.log('🔧 [SessionTimeout] Hook initialized with options:', {
    timeoutDuration: timeoutDuration / 1000 + 's',
    warningDuration: warningDuration / 1000 + 's',
    enabled,
  });

  const { logout, isAuthenticated, user } = useAuth();
  // const router = useRouter();
  const wasAuthenticatedRef = useRef(isAuthenticated);

  // Solo log cuando hay cambios en el estado de autenticación o en modo debug
  if (!isAuthenticated || timeoutDuration < 5 * 60 * 1000) {
    // Debug mode o no autenticado
    console.log('🔍 [SessionTimeout] Auth state:', {
      isAuthenticated,
      hasUser: !!user,
      userName: user?.name || 'N/A',
      wasAuthenticated: wasAuthenticatedRef.current,
      enabled,
      timeoutDuration: timeoutDuration / 1000 + 's',
    });
  }

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const timeRemainingRef = useRef(timeoutDuration);
  const isWarningActiveRef = useRef(false);

  const handleLogout = useCallback(async () => {
    console.log('🚨 [SessionTimeout] Auto-logout triggered due to inactivity');
    toast.error('Su sesión ha expirado por inactividad', {
      description: 'Por su seguridad, hemos cerrado su sesión automáticamente.',
      duration: 5000,
    });

    try {
      // Server-side redirect will handle navigation to home page
      await logout();
    } catch {
      // Next.js redirect() throws an error by design
      // This is expected, so we don't need to log it as an error
      console.log('✅ [SessionTimeout] Logout completed, server redirecting');
    }
  }, [logout]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current) {
      console.log('⚠️ [SessionTimeout] Warning already shown, skipping');
      return;
    }

    console.log('⚠️ [SessionTimeout] Showing session expiration warning');
    warningShownRef.current = true;
    isWarningActiveRef.current = true;

    const warningMinutes = Math.ceil(warningDuration / 1000 / 60);

    toast.warning('Su sesión expirará pronto', {
      description: `Su sesión se cerrará automáticamente en ${warningMinutes} minutos por inactividad. Realice cualquier acción para mantener su sesión activa.`,
      duration: warningDuration,
      action: {
        label: 'Mantener sesión',
        onClick: () => {
          console.log('🔄 [SessionTimeout] User clicked "Mantener sesión"');
          resetTimerRef.current();
          toast.success('Sesión extendida exitosamente');
        },
      },
    });
  }, [warningDuration]);

  const resetTimer = useCallback(() => {
    console.log('🔄 [SessionTimeout] Resetting timer...', {
      enabled,
      isAuthenticated,
      timeoutDuration: timeoutDuration / 1000 + 's',
      warningDuration: warningDuration / 1000 + 's',
    });

    // Limpiar timers existentes
    if (timeoutIdRef.current) {
      console.log('🧹 [SessionTimeout] Clearing existing timeout timer');
      clearTimeout(timeoutIdRef.current);
    }
    if (warningTimeoutIdRef.current) {
      console.log('🧹 [SessionTimeout] Clearing existing warning timer');
      clearTimeout(warningTimeoutIdRef.current);
    }
    if (countdownIntervalRef.current) {
      console.log('🧹 [SessionTimeout] Clearing existing countdown interval');
      clearInterval(countdownIntervalRef.current);
    }

    // Resetear estado
    warningShownRef.current = false;
    isWarningActiveRef.current = false;
    timeRemainingRef.current = timeoutDuration;

    if (!enabled || !isAuthenticated) {
      console.log(
        '❌ [SessionTimeout] Timer not started - disabled or not authenticated',
        {
          enabled,
          isAuthenticated,
        },
      );
      return;
    }

    // Configurar timer de advertencia
    const warningTime = timeoutDuration - warningDuration;
    console.log(
      '⏰ [SessionTimeout] Setting warning timer for',
      warningTime / 1000 + 's',
    );

    // Solo mostrar countdown en los últimos 10 segundos para evitar spam de logs
    let secondsRemaining = Math.floor(timeoutDuration / 1000);

    if (timeoutDuration <= 60000) {
      // Solo para testing (menos de 1 minuto)
      const startCountdown = () => {
        countdownIntervalRef.current = setInterval(() => {
          secondsRemaining--;
          if (secondsRemaining <= 10 && secondsRemaining > 0) {
            console.log(
              `⏱️ [SessionTimeout] ${secondsRemaining}s remaining until logout`,
            );
          }
          if (secondsRemaining <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
          }
        }, 1000);
      };

      startCountdown();
    }

    warningTimeoutIdRef.current = setTimeout(() => {
      console.log(
        '⚠️ [SessionTimeout] Warning timer triggered at',
        warningTime / 1000 + 's',
      );
      showWarning();
    }, warningTime);

    // Configurar timer de logout
    console.log(
      '⏰ [SessionTimeout] Setting logout timer for',
      timeoutDuration / 1000 + 's',
    );
    timeoutIdRef.current = setTimeout(() => {
      console.log(
        '🚨 [SessionTimeout] Logout timer triggered at',
        timeoutDuration / 1000 + 's',
      );
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      handleLogout();
    }, timeoutDuration);
  }, [
    enabled,
    isAuthenticated,
    timeoutDuration,
    warningDuration,
    showWarning,
    handleLogout,
  ]);

  // Crear referencia estable del resetTimer para evitar re-renders
  const resetTimerRef = useRef(resetTimer);
  resetTimerRef.current = resetTimer;

  // Lista de eventos que indican actividad del usuario (se mantiene estable)
  const activityEvents = useMemo(
    () => [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
    ],
    [],
  );

  const handleActivity = useCallback(() => {
    // Solo log en modo debug (timeouts menores a 5 minutos)
    if (timeoutDuration < 5 * 60 * 1000) {
      console.log(
        '👆 [SessionTimeout] User activity detected, resetting timer',
      );
    }
    resetTimerRef.current();
  }, [timeoutDuration]); // Incluir timeoutDuration como dependencia

  const forceInitialize = useCallback(() => {
    console.log('🚀 [SessionTimeout] Force initialization requested');

    // Intentar varias veces con un delay para manejar la condición de carrera
    const attemptInit = (attempt = 1, maxAttempts = 5) => {
      if (enabled && isAuthenticated) {
        console.log('✅ [SessionTimeout] Force initializing timeout system');
        resetTimerRef.current();
      } else if (attempt < maxAttempts) {
        console.log(
          `⏳ [SessionTimeout] Auth state not ready (attempt ${attempt}/${maxAttempts}), retrying...`,
          {
            enabled,
            isAuthenticated,
          },
        );
        setTimeout(() => attemptInit(attempt + 1, maxAttempts), 200 * attempt);
      } else {
        console.log(
          '❌ [SessionTimeout] Cannot force initialize after retries - disabled or not authenticated',
          {
            enabled,
            isAuthenticated,
          },
        );
      }
    };

    attemptInit();
  }, [enabled, isAuthenticated]);

  // Detectar cuando el usuario acaba de loguearse
  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    const isNowAuthenticated = isAuthenticated;

    if (!wasAuthenticated && isNowAuthenticated) {
      console.log(
        '🚀 [SessionTimeout] User just logged in! Forcing timer initialization',
      );
      // Delay más largo para asegurar que todo esté listo
      setTimeout(() => {
        if (enabled && isAuthenticated) {
          console.log(
            '✅ [SessionTimeout] Auto-initializing after login state change',
          );
          resetTimerRef.current();
        } else {
          console.log(
            '⚠️ [SessionTimeout] Cannot auto-initialize - state changed',
            {
              enabled,
              isAuthenticated,
            },
          );
        }
      }, 500);
    }

    wasAuthenticatedRef.current = isNowAuthenticated;
  }, [isAuthenticated, enabled]);

  useEffect(() => {
    console.log('🔧 [SessionTimeout] Main effect triggered', {
      enabled,
      isAuthenticated,
    });

    if (!enabled || !isAuthenticated) {
      console.log(
        '❌ [SessionTimeout] Effect skipped - disabled or not authenticated',
      );
      return;
    }

    console.log('✅ [SessionTimeout] Initializing session timeout system');

    // Inicializar timer
    resetTimerRef.current();

    // Agregar event listeners para detectar actividad
    console.log(
      '👂 [SessionTimeout] Adding activity event listeners:',
      activityEvents,
    );
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup
    return () => {
      console.log('🧹 [SessionTimeout] Cleaning up timers and event listeners');
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (warningTimeoutIdRef.current) {
        clearTimeout(warningTimeoutIdRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [enabled, isAuthenticated, handleActivity, activityEvents]); // Incluir activityEvents como dependencia

  // Limpiar timers cuando el usuario no está autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      console.log(
        '🧹 [SessionTimeout] User not authenticated, cleaning up all timers',
      );
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      if (warningTimeoutIdRef.current) {
        clearTimeout(warningTimeoutIdRef.current);
        warningTimeoutIdRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      warningShownRef.current = false;
      isWarningActiveRef.current = false;
    }
  }, [isAuthenticated]);

  return {
    resetTimer: useCallback(() => resetTimerRef.current(), []),
    timeRemaining: timeRemainingRef.current,
    isWarningActive: isWarningActiveRef.current,
    forceInitialize,
  };
}
