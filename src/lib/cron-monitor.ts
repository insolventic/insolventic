/**
 * Heartbeat del cron hacia Sentry (Cron Monitors) — O-4.
 *
 * EL HUECO QUE CIERRA. Si el cron de alertas deja de correr un martes, hoy se
 * descubre cuando un operador nota que no le llegaron avisos. El runbook §3.6
 * explica cómo diagnosticarlo, lo que confirma que lo que falta no es el
 * procedimiento sino la **detección**: nada compara el resultado del cron
 * contra nada, y un cron que no corre no produce ningún error que reportar
 * — produce **silencio**, que es justo lo que ningún `logger.error` puede
 * detectar (hallazgo O-4 de `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * Detectar una ausencia necesita que alguien espere la señal. Eso es un cron
 * monitor: la corrida avisa cuando arranca y cuando termina, y el que vigila
 * alerta si el aviso **no llega** a la hora esperada.
 *
 * POR QUÉ SENTRY Y NO UN SERVICIO NUEVO. La cuenta ya existe, el SDK ya está
 * instalado y el DSN ya está configurado: no hay una cuenta más que crear ni
 * un secreto más que rotar. El monitor se crea solo con el primer check-in
 * (`monitorConfig`), así que tampoco hay que configurarlo a mano.
 *
 * SIN DSN ES UN NO-OP. Igual que el resto de la integración: en desarrollo y
 * en un entorno sin Sentry no se manda nada y el cron corre idéntico.
 */

/** El slug del monitor en Sentry. Si se cambia, se crea un monitor nuevo. */
export const CRON_MONITOR_SLUG = 'cron-alertas';

/**
 * La programación que el monitor espera, en el mismo formato que `vercel.json`.
 *
 * Tiene que coincidir con la entrada de `crons` de `vercel.json`: es con esto
 * con lo que Sentry decide que una corrida **falta**. `checkinMargin` es
 * cuántos minutos de atraso se toleran antes de considerarla perdida, y
 * `maxRuntime` cuántos puede durar antes de darla por colgada — 2 minutos,
 * holgado contra el `maxDuration` de 60 s de la función.
 */
const MONITOR_CONFIG = {
  schedule: { type: 'crontab' as const, value: '0 8 * * *' },
  checkinMargin: 60,
  maxRuntime: 2,
  timezone: 'Etc/UTC',
};

function sentryEstaConfigurado(): boolean {
  return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Avisa que la corrida arrancó. Devuelve el id con el que cerrarla, o
 * `undefined` si no hay nada que avisar (sin DSN) o si el envío falló.
 *
 * Nunca lanza: un problema del monitor no puede tumbar el cron que vigila.
 */
export async function cronCheckInStart(): Promise<string | undefined> {
  if (!sentryEstaConfigurado()) return undefined;

  try {
    const Sentry = await import('@sentry/nextjs');
    return Sentry.captureCheckIn(
      { monitorSlug: CRON_MONITOR_SLUG, status: 'in_progress' },
      MONITOR_CONFIG,
    );
  } catch {
    return undefined;
  }
}

/**
 * Cierra la corrida como `ok` o como `error`.
 *
 * `error` no es solo para una excepción: una corrida que se corta por el
 * deadline o que acumula errores de un tenant también lo es, porque el
 * resultado no es el que el runbook espera.
 */
export async function cronCheckInFinish(
  checkInId: string | undefined,
  status: 'ok' | 'error',
): Promise<void> {
  if (!checkInId) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: CRON_MONITOR_SLUG,
      status,
    });
    // El runtime Node de Vercel congela la función en cuanto responde, y el
    // envío queda encolado: el mismo motivo por el que `onRequestError` hace
    // un flush explícito (ver `src/instrumentation.ts`).
    await Sentry.flush(2_000);
  } catch {
    /* el monitor no puede tumbar al cron */
  }
}
