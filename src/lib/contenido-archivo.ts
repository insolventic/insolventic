/**
 * Verificación del CONTENIDO real de un archivo subido (no de su extensión ni
 * del tipo que declara el navegador). Pura y sin dependencias: la usan el
 * cliente (al elegir el archivo, leyendo los primeros bytes) y el servidor
 * (`uploadCaseDocument`, sobre el archivo completo).
 *
 * Tipos admitidos: PDF, PNG y JPEG — los mismos que ya aceptaba la carga de
 * documentos del caso.
 */

export type TipoContenido = 'application/pdf' | 'image/png' | 'image/jpeg';

/** Bytes que hace falta leer para decidir el tipo. */
export const BYTES_CABECERA = 1024;

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function empiezaCon(datos: Uint8Array, firma: number[], desde = 0): boolean {
  if (datos.length < desde + firma.length) return false;
  return firma.every((b, i) => datos[desde + i] === b);
}

/**
 * Tipo según los primeros bytes, o `null` si no es PDF, PNG ni JPEG.
 *
 * El PDF admite basura antes de la cabecera (lo tolera la especificación y lo
 * producen algunos escáneres), así que se busca "%PDF-" en el primer KB.
 */
export function detectarTipoArchivo(datos: Uint8Array): TipoContenido | null {
  if (empiezaCon(datos, FIRMA_PNG)) return 'image/png';
  if (
    datos.length >= 3 &&
    datos[0] === 0xff &&
    datos[1] === 0xd8 &&
    datos[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  const limite = Math.min(datos.length, BYTES_CABECERA) - FIRMA_PDF.length;
  for (let i = 0; i <= limite; i++) {
    if (empiezaCon(datos, FIRMA_PDF, i)) return 'application/pdf';
  }
  return null;
}

const EXTENSIONES: Record<TipoContenido, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

/**
 * Por qué el archivo no sirve, o `null` si sirve. Exige que el contenido sea
 * PDF/PNG/JPEG y que coincida con el tipo declarado y con la extensión (un
 * "foto.png" que en realidad es un JPEG se rechaza: el visor de Drive y la
 * conversión a DOCX deciden por el tipo declarado).
 */
export function motivoContenidoInvalido(
  datos: Uint8Array,
  tipoDeclarado: string,
  nombre: string,
): string | null {
  if (datos.length === 0) return `${nombre}: el archivo está vacío.`;
  const detectado = detectarTipoArchivo(datos);
  if (!detectado) {
    return `${nombre}: el contenido no es un PDF, JPG o PNG válido.`;
  }
  const declarado =
    tipoDeclarado === 'image/jpg' ? 'image/jpeg' : tipoDeclarado;
  if (declarado && declarado !== detectado) {
    return `${nombre}: el contenido no corresponde al tipo de archivo declarado.`;
  }
  const ext = `.${nombre.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!EXTENSIONES[detectado].includes(ext)) {
    return `${nombre}: la extensión no corresponde al contenido del archivo.`;
  }
  return null;
}

/** `Blob.arrayBuffer` si existe; si no (navegadores viejos, jsdom), FileReader. */
function leerComoArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as ArrayBuffer);
    lector.onerror = () => reject(lector.error);
    lector.readAsArrayBuffer(blob);
  });
}

/** Versión para el navegador: lee solo la cabecera del `File`. */
export async function motivoContenidoInvalidoDeArchivo(
  archivo: File,
): Promise<string | null> {
  const cabecera = new Uint8Array(
    await leerComoArrayBuffer(archivo.slice(0, BYTES_CABECERA)),
  );
  // Un archivo vacío tiene cabecera vacía: el mensaje lo dice.
  return motivoContenidoInvalido(cabecera, archivo.type, archivo.name);
}
