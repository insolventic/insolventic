import { z } from 'zod';

const FECHA_SOLO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA_24 = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `2026-02-31` cumple el formato, pero `Date.UTC` lo correría al 3 de marzo. */
function esFechaReal(valor: string): boolean {
  const partes = FECHA_SOLO_DIA.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Lo que llena el operador; también lo usa el formulario. */
export const datosAudienciaSchema = z.object({
  fecha: z
    .string()
    .min(1, 'La fecha es requerida')
    .refine(esFechaReal, 'La fecha no es válida'),
  hora: z
    .string()
    .min(1, 'La hora es requerida')
    .regex(HORA_24, 'La hora no es válida'),
});

export type DatosAudiencia = z.infer<typeof datosAudienciaSchema>;

export const programarAudienciaSchema = datosAudienciaSchema.extend({
  caseId: z.string().min(1),
  version: z.number().int().optional(),
});

export const cancelarAudienciaSchema = z.object({
  caseId: z.string().min(1),
  version: z.number().int().optional(),
});
