/**
 * Versión vigente de los documentos legales que cada usuario tiene que aceptar
 * (N-G-07). Única fuente: la página muestra `version` como "Última
 * actualización" y la aceptación guarda `version` y `sha256`.
 *
 * Sin `'use server'` ni imports de Node: lo importan las páginas, la action y
 * el diálogo del cliente.
 *
 * Al cambiar el texto de /terminos o /privacidad hay que subir `version` (la
 * fecha del cambio) y actualizar `sha256`. Si se cambia el texto y no el hash,
 * `tests/unit/legal/version-documentos-legales.test.ts` falla e imprime el
 * hash nuevo. Subir la versión hace que todos los usuarios vuelvan a aceptar
 * al próximo ingreso.
 */

export const DOCUMENTOS_LEGALES = ['terminos', 'privacidad'] as const;
export type DocumentoLegal = (typeof DOCUMENTOS_LEGALES)[number];

export interface VersionDocumentoLegal {
  documento: DocumentoLegal;
  titulo: string;
  ruta: string;
  version: string;
  sha256: string;
  /** Texto de la casilla del diálogo: lo que el usuario declara. */
  casilla: string;
}

export const TERMINOS: VersionDocumentoLegal = {
  documento: 'terminos',
  titulo: 'Términos de uso para operadores',
  ruta: '/terminos',
  version: '2026-10-17',
  sha256: '0713478e5923de1fdc39e52a925c3b41bc216b98daae7ba8bdb8a05b03d474c3',
  casilla: 'Leí y acepto los términos de uso.',
};

/**
 * La política no se "acepta": trata datos de deudores y acreedores, y el
 * operador no es su titular, así que no puede consentir por ellos (Ley 1581).
 * Lo que se registra es que la leyó.
 */
export const PRIVACIDAD: VersionDocumentoLegal = {
  documento: 'privacidad',
  titulo: 'Política de tratamiento de datos personales',
  ruta: '/privacidad',
  version: '2026-10-17',
  sha256: '44d3538c7c286673d7b29e8ec7b6a55895b6f992509a5cb19917314da49f1bbe',
  casilla: 'Declaro que leí la política de tratamiento de datos personales.',
};

export const VERSIONES_VIGENTES: Record<DocumentoLegal, VersionDocumentoLegal> =
  {
    terminos: TERMINOS,
    privacidad: PRIVACIDAD,
  };

export interface AceptacionRegistrada {
  documento: string;
  version: string;
  sha256: string;
}

/** Una aceptación cubre la versión vigente si coinciden la versión y el hash. */
export function cubreVersionVigente(a: AceptacionRegistrada): boolean {
  const vigente = VERSIONES_VIGENTES[a.documento as DocumentoLegal];
  return (
    !!vigente && a.version === vigente.version && a.sha256 === vigente.sha256
  );
}

/** Documentos cuya versión vigente el usuario todavía no aceptó. */
export function documentosPendientes(
  aceptaciones: readonly AceptacionRegistrada[],
): DocumentoLegal[] {
  return DOCUMENTOS_LEGALES.filter(
    (doc) =>
      !aceptaciones.some((a) => a.documento === doc && cubreVersionVigente(a)),
  );
}

export type EstadoDocumentoLegal = 'al-dia' | 'version-anterior' | 'pendiente';

/** Estado de un documento para un usuario, para la vista del Administrador. */
export function estadoDelDocumento(
  documento: DocumentoLegal,
  aceptaciones: readonly AceptacionRegistrada[],
): EstadoDocumentoLegal {
  const delDocumento = aceptaciones.filter((a) => a.documento === documento);
  if (delDocumento.some(cubreVersionVigente)) return 'al-dia';
  return delDocumento.length > 0 ? 'version-anterior' : 'pendiente';
}
