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

/**
 * Textos con que llega un cuerpo rechazado: el de `bodySizeLimit` en
 * desarrollo y el 413 de Vercel. Rara vez llegan: el cliente de Next solo copia
 * el texto de la respuesta si su tipo es exactamente `text/plain`, y el 413 de
 * Vercel viene con `; charset=utf-8`; en producción, el de Next llega enmascarado.
 * Por eso manda el tamaño enviado, y el texto solo cubre un cuerpo grande por
 * otros campos.
 */
const TEXTOS_DE_CUERPO_RECHAZADO =
  /Body exceeded|FUNCTION_PAYLOAD_TOO_LARGE|Request Entity Too Large/i;

/**
 * Si una server action con un archivo rechazó la promesa, el mensaje de tamaño
 * para el usuario cuando el rechazo se explica por el tamaño; `null` si no.
 *
 * `bytesEnviados` es lo que de verdad viajó: `new Blob([file]).size` no depende
 * de `file.size`, que la validación del cliente ya leyó.
 */
export function errorDeTamanoTrasRechazo(
  error: unknown,
  bytesEnviados: number,
): string | null {
  const porTamano = errorDeTamanoDeArchivo(bytesEnviados);
  if (porTamano) return porTamano;

  const texto = error instanceof Error ? error.message : String(error);
  if (TEXTOS_DE_CUERPO_RECHAZADO.test(texto)) {
    return (
      `El envío superó el tamaño que acepta el servidor. Cada archivo puede ` +
      `pesar hasta ${MAX_ARCHIVO_MB} MB: comprime el PDF o reduce la foto y vuelve a adjuntarlo.`
    );
  }
  return null;
}
