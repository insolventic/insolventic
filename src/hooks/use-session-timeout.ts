'use client';

/**
 * Auto-logout por inactividad.
 *
 * Las trazas de este hook van por `logger.debug`, no por `console.log`:
 * el nivel por defecto en producción es `warn`, así que en el bundle de
 * producción no imprimen nada, y en desarrollo siguen estando completas.
 * Antes eran 30 `console.log` sin guarda de entorno, y uno de ellos
 * imprimía el nombre del usuario en la consola del navegador en
 * producción; ese dato ya no se registra, porque para depurar solo hace
 * falta saber si hay usuario (`hasUser`), no quién es.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';

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

  logger.debug('Session timeout: hook inicializado', {
    action: 'sessionTimeout',
    timeoutSeconds: timeoutDuration / 1000,
    warningSeconds: warningDuration / 1000,
    enabled,
  });

  const { logout, isAuthenticated, user } = useAuth();
  // const router = useRouter();
  const wasAuthenticatedRef = useRef(isAuthenticated);

  // Solo log cuando hay cambios en el estado de autenticación o en modo debug
  if (!isAuthenticated || timeoutDuration < 5 * 60 * 1000) {
    // Debug mode o no autenticado
    logger.debug('Session timeout: estado de autenticación', {
      action: 'sessionTimeout',
      isAuthenticated,
      hasUser: !!user,
      wasAuthenticated: wasAuthenticatedRef.current,
      enabled,
      timeoutSeconds: timeoutDuration / 1000,
    });
  }

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const timeRemainingRef = useRef(timeoutDuration);
  const isWarningActiveRef = useRef(false);

  const handleLogout = useCallback(async () => {
    logger.info('Auto-logout triggered due to inactivity', {
      action: 'sessionTimeout',
    });
    toast.error('Su sesión ha expirado por inactividad', {
      description: 'Por su seguridad, hemos cerrado su sesión automáticamente.',
      duration: 5000,
    });

    try {
      // Server-side redirect will handle navigation to home page
      await logout();
    } catch (error) {
      // logout() ya absorbe la redirección esperada del servidor y registra por
      // sí mismo sus fallos reales, así que en el flujo normal no rechaza. Si
      // llega algo aquí es inesperado y no puede quedar oculto: este handler lo
      // dispara un setTimeout, sin nadie más que lo atrape. Antes se absorbía
      // con un console.log "Logout completed" que lo presentaba como éxito.
      logger.error('Auto-logout failed', error, { action: 'sessionTimeout' });
    }
  }, [logout]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current) {
      logger.debug('Session timeout: el aviso ya se mostró, se omite', {
        action: 'sessionTimeout',
      });
      return;
    }

    logger.debug('Session timeout: mostrando el aviso de expiración', {
      action: 'sessionTimeout',
    });
    warningShownRef.current = true;
    isWarningActiveRef.current = true;

    const warningMinutes = Math.ceil(warningDuration / 1000 / 60);

    toast.warning('Su sesión expirará pronto', {
      description: `Su sesión se cerrará automáticamente en ${warningMinutes} minutos por inactividad. Realice cualquier acción para mantener su sesión activa.`,
      duration: warningDuration,
      action: {
        label: 'Mantener sesión',
        onClick: () => {
          logger.debug('Session timeout: el usuario pidió mantener la sesión', {
            action: 'sessionTimeout',
          });
          resetTimerRef.current();
          toast.success('Sesión extendida exitosamente');
        },
      },
    });
  }, [warningDuration]);

  const resetTimer = useCallback(() => {
    logger.debug('Session timeout: reiniciando el temporizador', {
      action: 'sessionTimeout',
      enabled,
      isAuthenticated,
      timeoutSeconds: timeoutDuration / 1000,
      warningSeconds: warningDuration / 1000,
    });

    // Limpiar timers existentes
    if (timeoutIdRef.current) {
      logger.debug('Session timeout: limpiando el temporizador de cierre', {
        action: 'sessionTimeout',
      });
      clearTimeout(timeoutIdRef.current);
    }
    if (warningTimeoutIdRef.current) {
      logger.debug('Session timeout: limpiando el temporizador de aviso', {
        action: 'sessionTimeout',
      });
      clearTimeout(warningTimeoutIdRef.current);
    }
    if (countdownIntervalRef.current) {
      logger.debug('Session timeout: limpiando la cuenta regresiva', {
        action: 'sessionTimeout',
      });
      clearInterval(countdownIntervalRef.current);
    }

    // Resetear estado
    warningShownRef.current = false;
    isWarningActiveRef.current = false;
    timeRemainingRef.current = timeoutDuration;

    if (!enabled || !isAuthenticated) {
      logger.debug(
        'Session timeout: temporizador no iniciado (deshabilitado o sin sesión)',
        {
          action: 'sessionTimeout',
          enabled,
          isAuthenticated,
        },
      );
      return;
    }

    // Configurar timer de advertencia
    const warningTime = timeoutDuration - warningDuration;
    logger.debug('Session timeout: programando el aviso', {
      action: 'sessionTimeout',
      warningAtSeconds: warningTime / 1000,
    });

    // Solo mostrar countdown en los últimos 10 segundos para evitar spam de logs
    let secondsRemaining = Math.floor(timeoutDuration / 1000);

    if (timeoutDuration <= 60000) {
      // Solo para testing (menos de 1 minuto)
      const startCountdown = () => {
        countdownIntervalRef.current = setInterval(() => {
          secondsRemaining--;
          if (secondsRemaining <= 10 && secondsRemaining > 0) {
            logger.debug('Session timeout: cuenta regresiva', {
              action: 'sessionTimeout',
              secondsRemaining,
            });
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
      logger.debug('Session timeout: se disparó el aviso', {
        action: 'sessionTimeout',
        warningAtSeconds: warningTime / 1000,
      });
      showWarning();
    }, warningTime);

    // Configurar timer de logout
    logger.debug('Session timeout: programando el cierre de sesión', {
      action: 'sessionTimeout',
      logoutAtSeconds: timeoutDuration / 1000,
    });
    timeoutIdRef.current = setTimeout(() => {
      logger.debug('Session timeout: se disparó el cierre de sesión', {
        action: 'sessionTimeout',
        logoutAtSeconds: timeoutDuration / 1000,
      });
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
      logger.debug(
        'Session timeout: actividad del usuario, se reinicia el temporizador',
        { action: 'sessionTimeout' },
      );
    }
    resetTimerRef.current();
  }, [timeoutDuration]); // Incluir timeoutDuration como dependencia

  const forceInitialize = useCallback(() => {
    logger.debug('Session timeout: inicialización forzada solicitada', {
      action: 'sessionTimeout',
    });

    // Intentar varias veces con un delay para manejar la condición de carrera
    const attemptInit = (attempt = 1, maxAttempts = 5) => {
      if (enabled && isAuthenticated) {
        logger.debug('Session timeout: inicialización forzada en curso', {
          action: 'sessionTimeout',
        });
        resetTimerRef.current();
      } else if (attempt < maxAttempts) {
        logger.debug(
          'Session timeout: estado de autenticación no listo, reintentando',
          {
            action: 'sessionTimeout',
            attempt,
            maxAttempts,
            enabled,
            isAuthenticated,
          },
        );
        setTimeout(() => attemptInit(attempt + 1, maxAttempts), 200 * attempt);
      } else {
        logger.debug(
          'Session timeout: no se pudo inicializar tras los reintentos (deshabilitado o sin sesión)',
          {
            action: 'sessionTimeout',
            attempt,
            maxAttempts,
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
      logger.debug(
        'Session timeout: sesión recién iniciada, se fuerza el temporizador',
        { action: 'sessionTimeout' },
      );
      // Delay más largo para asegurar que todo esté listo
      setTimeout(() => {
        if (enabled && isAuthenticated) {
          logger.debug(
            'Session timeout: autoinicializando tras el cambio de sesión',
            { action: 'sessionTimeout' },
          );
          resetTimerRef.current();
        } else {
          logger.debug(
            'Session timeout: no se pudo autoinicializar, el estado cambió',
            {
              action: 'sessionTimeout',
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
    logger.debug('Session timeout: efecto principal disparado', {
      action: 'sessionTimeout',
      enabled,
      isAuthenticated,
    });

    if (!enabled || !isAuthenticated) {
      logger.debug(
        'Session timeout: efecto omitido (deshabilitado o sin sesión)',
        { action: 'sessionTimeout' },
      );
      return;
    }

    logger.debug('Session timeout: inicializando el sistema', {
      action: 'sessionTimeout',
    });

    // Inicializar timer
    resetTimerRef.current();

    // Agregar event listeners para detectar actividad
    logger.debug('Session timeout: registrando los eventos de actividad', {
      action: 'sessionTimeout',
      events: activityEvents.join(', '),
    });
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup
    return () => {
      logger.debug('Session timeout: limpiando temporizadores y eventos', {
        action: 'sessionTimeout',
      });
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
      logger.debug(
        'Session timeout: sin sesión, se limpian todos los temporizadores',
        { action: 'sessionTimeout' },
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
