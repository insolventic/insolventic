/**
 * Servicios de manutención del deudor, desglosados por tipo.
 *
 * Antes solo existía `Case.gastosServiciosPublicos`: un único monto agregado.
 * Servía para el cálculo de capacidad de pago, pero no decía QUÉ servicios
 * tiene el deudor, que es lo que el operador necesita al revisar el expediente
 * y al pedir los comprobantes (el slot de adjuntos opcionales ya se llamaba
 * "Copia de gastos de manutención (gas, agua, luz)", sin nada estructurado
 * detrás).
 *
 * Se guardan en una columna `Json?` de `Case`, siguiendo el patrón de
 * `apoyoClausulas` y las cláusulas de conciliación: es una lista heterogénea y
 * de forma libre —el "+ Otros" lleva nombre y descripción escritos por el
 * operador— así que una tabla hija no aportaría nada.
 *
 * IMPORTANTE — este desglose NO va a los documentos generados. La garantía es
 * por omisión: el mapper es opt-in (un dato llega a un documento solo si alguien
 * le escribe un placeholder), así que basta con no agregar ninguno. Hay un test
 * que falla si alguna clave del desglose aparece en la salida del mapper, para
 * que sea una invariante y no una convención. El monto agregado
 * `gastosServiciosPublicos` no cambia: sigue alimentando la propuesta de pago y
 * el Excel de exportación.
 */

/** Tipo de los servicios con nombre fijo. */
export const SERVICIO_MANUTENCION_OTRO = 'OTRO';

export interface ServicioManutencionTipo {
  readonly value: string;
  readonly label: string;
}

/** Los tres que el cliente pidió desglosar explícitamente. */
export const SERVICIOS_MANUTENCION_BASE: readonly ServicioManutencionTipo[] = [
  { value: 'GAS', label: 'Gas' },
  { value: 'AGUA', label: 'Agua' },
  { value: 'LUZ', label: 'Luz' },
] as const;

export interface ServicioManutencion {
  tipo: string;
  nombre: string;
  descripcion?: string;
}

export function isOtroServicio(tipo: string | null | undefined): boolean {
  return tipo === SERVICIO_MANUTENCION_OTRO;
}

/**
 * Nombre a mostrar.
 *
 * En los tres fijos gana la etiqueta del catálogo, para que no dependa de lo que
 * se haya guardado en `nombre`. En "Otros" es el texto del operador; si vino
 * vacío, cae a "Otro servicio" en vez de dejar la fila sin nombre.
 */
export function servicioManutencionLabel(
  servicio: ServicioManutencion | null | undefined,
): string {
  if (!servicio) return '';

  const base = SERVICIOS_MANUTENCION_BASE.find(
    (s) => s.value === servicio.tipo,
  );
  if (base) return base.label;

  const nombre = (servicio.nombre ?? '').trim();
  return nombre || 'Otro servicio';
}

/** Fila nueva para el tipo pedido. */
export function nuevoServicio(tipo: string): ServicioManutencion {
  const base = SERVICIOS_MANUTENCION_BASE.find((s) => s.value === tipo);
  return {
    tipo,
    nombre: base?.label ?? '',
    descripcion: '',
  };
}
