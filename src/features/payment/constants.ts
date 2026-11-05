export const PAYMENT_METHODS = [
  'Transferencia',
  'Efectivo',
  'Cheque',
  'PSE',
  'Otro',
] as const;

/**
 * Tamaño máximo del comprobante de pago. Una sola cifra para la UI, la
 * validación del servidor y `docs/MANUAL_USUARIO.md`.
 *
 * No es una preferencia: lo fija la plataforma. El archivo viaja dentro de una
 * server action, y Vercel corta el cuerpo de las funciones en 4,5 MB antes de
 * que llegue a la aplicación. Por eso `bodySizeLimit` (`next.config.ts`) tiene
 * que quedar por encima de este valor y por debajo de ese corte; lo vigila
 * `tests/unit/payments/comprobante-limite-tamano.test.ts`.
 *
 * Subir de aquí exige otra forma de subir (ver `docs/DECISIONES.md`).
 */
export const MAX_COMPROBANTE_MB = 4;
export const MAX_COMPROBANTE_BYTES = MAX_COMPROBANTE_MB * 1024 * 1024;

/** El mensaje para el usuario si el archivo no cabe; `null` si cabe. */
export function errorDeTamanoDeComprobante(bytes: number): string | null {
  if (bytes <= MAX_COMPROBANTE_BYTES) return null;
  // Hacia arriba: 4,01 MB no debe leerse como "pesa 4 MB y el máximo es 4 MB".
  const pesaMb = Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
  return (
    `El archivo pesa ${pesaMb.toLocaleString('es-CO')} MB y el máximo es ` +
    `${MAX_COMPROBANTE_MB} MB. Comprímelo o adjunta una versión más liviana.`
  );
}
