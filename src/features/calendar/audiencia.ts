/**
 * La regla única de "cuál es la audiencia de este caso".
 *
 * POR QUÉ EXISTE. `Case` tiene dos fechas y cada pantalla elegía la suya: el
 * calendario y los documentos preferían `firstHearingDate`, las alertas y el
 * listado `hearingDate`. Reprogramar una audiencia dejaba al documento
 * imprimiendo una fecha y al listado mostrando otra.
 *
 * QUÉ SIGNIFICA CADA COLUMNA:
 *   - `firstHearingDate` / `firstHearingTime`: la primera audiencia que se fijó.
 *     Es la que cita el Auto de Admisión, y una reprogramación no la toca.
 *   - `hearingDate` / `hearingTime`: la audiencia vigente. Manda sobre la primera.
 *
 * SIN `'use server'` NI PRISMA A PROPÓSITO: la usan server actions, el cron, el
 * mapper de documentos y componentes de cliente.
 */

import {
  COLOMBIA_TZ,
  displayTimeZone,
  formatDateColombia,
} from '@/lib/date-colombia';
import { CLOSED_PHASES } from '@/lib/case-phases';

export interface CamposAudiencia {
  hearingDate?: Date | string | null;
  hearingTime?: string | null;
  firstHearingDate?: Date | string | null;
  firstHearingTime?: string | null;
}

export interface Audiencia {
  fecha: Date;
  hora: string | null;
}

const aFecha = (valor: Date | string | null | undefined): Date | null => {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * El día de calendario de un instante, como `YYYY-MM-DD`. Lee las filas viejas
 * (00:00 UTC) en UTC y el resto en hora de Colombia, igual que los documentos.
 */
export function claveDia(
  fecha: Date,
  timeZone = displayTimeZone(fecha),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/** Hoy en Colombia, como `YYYY-MM-DD`. Cortar por UTC adelantaba el día a las 19:00. */
export function hoyColombia(ahora: Date = new Date()): string {
  return claveDia(ahora, COLOMBIA_TZ);
}

/** La audiencia vigente del caso, o `null` si nunca se fijó ninguna. */
export function audienciaVigente(caso: CamposAudiencia): Audiencia | null {
  const vigente = aFecha(caso.hearingDate);
  const primera = aFecha(caso.firstHearingDate);

  if (!vigente) {
    return primera
      ? { fecha: primera, hora: caso.firstHearingTime || null }
      : null;
  }

  // Filas anteriores a `hearingTime`: la hora solo estaba en `firstHearingTime`,
  // y sirve únicamente si las dos columnas hablan del mismo día.
  const mismoDia = primera && claveDia(primera) === claveDia(vigente);
  return {
    fecha: vigente,
    hora: caso.hearingTime || (mismoDia ? caso.firstHearingTime || null : null),
  };
}

/** La primera audiencia que se fijó; sin ella, la vigente. */
export function primeraAudiencia(caso: CamposAudiencia): Audiencia | null {
  const primera = aFecha(caso.firstHearingDate);
  return primera
    ? { fecha: primera, hora: caso.firstHearingTime || null }
    : audienciaVigente(caso);
}

/**
 * `where` de Prisma con la misma regla que `audienciaVigente`: una primera
 * audiencia solo cuenta si no hay una vigente que la reemplace. Sin ese `AND`,
 * un caso reprogramado aparecía también en el mes de su fecha anterior.
 */
export function whereAudienciaEntre(desde: Date, hasta: Date) {
  const rango = { gte: desde, lte: hasta };
  return {
    OR: [
      { hearingDate: rango },
      { AND: [{ hearingDate: null }, { firstHearingDate: rango }] },
    ],
  };
}

/**
 * `where` de Prisma de los casos que no están cerrados. El `phase: null` va
 * explícito: en SQL `NULL NOT IN (...)` no es verdadero, y un `notIn` a secas
 * dejaría por fuera a los casos sin fase, que la app trata como "Inicial".
 */
export function whereCasoAbierto() {
  return {
    OR: [{ phase: null }, { phase: { notIn: [...CLOSED_PHASES] } }],
  };
}

export function esCasoCerrado(phase: string | null | undefined): boolean {
  return CLOSED_PHASES.includes(phase ?? '');
}

/**
 * ¿La audiencia vigente del caso es hoy o después? Una fecha pasada se guarda
 * como registro, pero no es una audiencia programada.
 */
export function tieneAudienciaPendiente(
  caso: CamposAudiencia,
  ahora: Date = new Date(),
): boolean {
  const audiencia = audienciaVigente(caso);
  return audiencia ? claveDia(audiencia.fecha) >= hoyColombia(ahora) : false;
}

/** Día del mes en que cae la audiencia, para ubicarla en la grilla del calendario. */
export function diaDelMes(fecha: Date | string): number {
  const instante = new Date(fecha);
  return Number(claveDia(instante).slice(8));
}

/** `"20/11/2026"` o `"20/11/2026 a las 10:00"`. */
export function formatearAudiencia(audiencia: Audiencia | null): string {
  if (!audiencia) return '';
  const dia = formatDateColombia(audiencia.fecha, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return audiencia.hora ? `${dia} a las ${audiencia.hora}` : dia;
}
