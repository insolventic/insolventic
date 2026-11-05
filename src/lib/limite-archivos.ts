/**
 * Tamaño máximo de un archivo subido por server action: comprobantes de pago y
 * documentos del caso. Una sola cifra para la UI, el servidor y
 * `docs/MANUAL_USUARIO.md`.
 *
 * No es una preferencia: lo fija el cuerpo de la petición, que corta primero
 * `bodySizeLimit` (`next.config.ts`, 4,25 MB) y después Vercel (medido en un
 * preview: 4.493.312 bytes). Solo vale para un `File`, que cuesta su tamaño más
 * unos cientos de bytes; en base64 el mismo archivo pesa un 33 % más y no cabe.
 * Lo vigila `tests/unit/payments/comprobante-limite-tamano.test.ts`.
 *
 * Subir de aquí exige otra forma de subir (ver `docs/DECISIONES.md`).
 */
export const MAX_ARCHIVO_MB = 4;
export const MAX_ARCHIVO_BYTES = MAX_ARCHIVO_MB * 1024 * 1024;

/** El mensaje para el usuario si el archivo no cabe; `null` si cabe. */
export function errorDeTamanoDeArchivo(bytes: number): string | null {
  if (bytes <= MAX_ARCHIVO_BYTES) return null;
  // Hacia arriba: 4,01 MB no debe leerse como "pesa 4 MB y el máximo es 4 MB".
  const pesaMb = Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
  return (
    `El archivo pesa ${pesaMb.toLocaleString('es-CO')} MB y el máximo es ` +
    `${MAX_ARCHIVO_MB} MB. Comprime el PDF o reduce la foto y vuelve a adjuntarlo.`
  );
}
