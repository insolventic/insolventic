/**
 * Firmas de las plantillas, resueltas desde la base y no desde el repositorio.
 *
 * El repositorio es público y una firma manuscrita no puede estar en él; lo
 * mismo vale para el sello de los centros que lo usan junto a la firma. Las
 * plantillas piden la firma con un placeholder (`{{FIRMA_OPERADOR_SRC}}`) igual
 * que cualquier imagen de branding, pero el mapper no produce una ruta de
 * archivo sino un ref simbólico (`imagen-privada:firma-operador`) que no nombra
 * ningún centro. Antes de generar, cada punto de entrada llama a
 * {@link resolverImagenesPrivadas} con el `tenantId` del expediente y cambia
 * esos refs por data URIs con {@link aplicarImagenesPrivadas}.
 *
 * Por qué así:
 *  - **Aislamiento por construcción.** El centro sale del expediente y la
 *    consulta filtra por `tenantId`; el ref no lleva centro, así que ningún
 *    valor de la plantilla o del mapper puede pedir la firma de otro centro.
 *  - **Falla antes de empezar.** Se resuelven todas las firmas del centro de
 *    una vez, antes de crear carpetas o convertir el primer documento: un lote
 *    no queda a medias porque al documento 12 le faltaba una firma.
 *  - **Una lectura por generación.** El resultado viaja con los placeholders;
 *    no hay caché global que sobreviva entre peticiones ni entre centros.
 *
 * Un documento legal sin la firma no se genera: es el mismo criterio del gate
 * de placeholders sin resolver, que bloquea en vez de subir a Drive un
 * documento incompleto.
 */

import { logger } from './logger';

/** Todo lo que puede guardarse en la tabla. */
export const TIPOS_IMAGEN_PRIVADA = [
  'firma-operador',
  'firma-director',
  'sello',
] as const;

export type TipoImagenPrivada = (typeof TIPOS_IMAGEN_PRIVADA)[number];

/** Cómo se nombra cada tipo en el mensaje que ve el usuario. */
const ETIQUETA_TIPO: Record<TipoImagenPrivada, string> = {
  'firma-operador': 'la firma del operador',
  'firma-director': 'la firma del director',
  sello: 'el sello',
};

const TIPOS_DE_TODO_CENTRO: readonly TipoImagenPrivada[] = [
  'firma-operador',
  'firma-director',
];

/**
 * Centros cuyo logo junto a la firma (`{{LOGO_FIRMA_SRC}}`) es un sello y por
 * eso tampoco se versiona. Los demás siguen leyendo `logo-firma.png` de
 * `templates/branding/<centro>/`.
 */
export const CENTROS_CON_SELLO: ReadonlySet<string> = new Set([
  'constructores-paz',
]);

/** Lo que un centro debe tener cargado para generar documentos. */
export function tiposRequeridos(
  slug: string | undefined,
): readonly TipoImagenPrivada[] {
  return slug && CENTROS_CON_SELLO.has(slug)
    ? [...TIPOS_DE_TODO_CENTRO, 'sello']
    : TIPOS_DE_TODO_CENTRO;
}

export const MIME_IMAGEN_PRIVADA = ['image/png', 'image/jpeg'] as const;

export type MimeImagenPrivada = (typeof MIME_IMAGEN_PRIVADA)[number];

/**
 * Tope por imagen. Las firmas reales pesan entre 10 y 25 KB; el margen cubre un
 * escaneo de mayor resolución sin dejar entrar un archivo que no es una firma.
 */
export const TAMANO_MAXIMO_IMAGEN_PRIVADA = 1024 * 1024;

const PREFIJO_REF = 'imagen-privada:';

/** El valor que el mapper pone en el placeholder de una firma. */
export function imagenPrivadaRef(tipo: TipoImagenPrivada): string {
  return `${PREFIJO_REF}${tipo}`;
}

export function esRefImagenPrivada(valor: string): boolean {
  return valor.startsWith(PREFIJO_REF);
}

export function esTipoImagenPrivada(valor: string): valor is TipoImagenPrivada {
  return (TIPOS_IMAGEN_PRIVADA as readonly string[]).includes(valor);
}

/**
 * El tipo MIME según los primeros bytes, o `null` si no es PNG ni JPEG. Se mira
 * el contenido y no la extensión ni lo que declare quien carga el archivo.
 */
export function detectarMimeImagen(
  datos: Uint8Array,
): MimeImagenPrivada | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (datos.length >= png.length && png.every((b, i) => datos[i] === b)) {
    return 'image/png';
  }
  if (
    datos.length >= 3 &&
    datos[0] === 0xff &&
    datos[1] === 0xd8 &&
    datos[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  return null;
}

/**
 * Por qué una imagen no sirve como firma, o `null` si sirve. La usan la carga,
 * la verificación previa al deploy y la lectura en cada generación.
 */
export function motivoImagenInvalida(
  datos: Uint8Array,
  mimeType: string,
): string | null {
  if (datos.length === 0) return 'está vacía';
  if (datos.length > TAMANO_MAXIMO_IMAGEN_PRIVADA) {
    return `pesa ${datos.length} bytes; el máximo es ${TAMANO_MAXIMO_IMAGEN_PRIVADA}`;
  }
  const detectado = detectarMimeImagen(datos);
  if (!detectado) return 'no es PNG ni JPEG';
  if (detectado !== mimeType) {
    return `el contenido es ${detectado} pero está registrada como ${mimeType}`;
  }
  return null;
}

/**
 * Falta una firma del centro, o la que hay no es válida. El mensaje es el que
 * ve el usuario: nombra el centro y la firma, sin detalles internos.
 */
export class ImagenPrivadaFaltanteError extends Error {
  readonly centro: string;
  readonly tipo: TipoImagenPrivada;

  constructor(centro: string, tipo: TipoImagenPrivada) {
    super(
      `Falta ${ETIQUETA_TIPO[tipo]} para ${centro}. Contacta al administrador.`,
    );
    this.name = 'ImagenPrivadaFaltanteError';
    this.centro = centro;
    this.tipo = tipo;
  }
}

/** Las imágenes de un centro, ya como data URI, listas para los placeholders. */
export type ImagenesPrivadas = ReadonlyMap<TipoImagenPrivada, string>;

/**
 * Lee de la base las imágenes `tipos` del centro, en una sola consulta. Los
 * puntos de entrada pasan {@link tiposRequeridos} del centro del expediente.
 *
 * @throws {ImagenPrivadaFaltanteError} si falta alguna o alguna no es válida.
 *   Antes de lanzar deja un evento en Sentry con el centro y la firma, sin la
 *   imagen ni datos del expediente.
 */
export async function resolverImagenesPrivadas(
  tenantId: string,
  tipos: readonly TipoImagenPrivada[] = TIPOS_DE_TODO_CENTRO,
): Promise<ImagenesPrivadas> {
  if (!tenantId) {
    throw new Error(
      'No se pueden resolver las firmas sin el centro del expediente',
    );
  }

  // Import diferido: los scripts de carga y verificación usan las funciones
  // puras de este módulo con su propio PrismaClient.
  const { default: prisma } = await import('./prisma');
  const filas = await prisma.imagenPrivada.findMany({
    where: { tenantId, tipo: { in: [...tipos] } },
    select: { tipo: true, mimeType: true, datos: true },
  });

  const imagenes = new Map<TipoImagenPrivada, string>();
  for (const tipo of tipos) {
    const fila = filas.find((f) => f.tipo === tipo);
    const motivo = fila
      ? motivoImagenInvalida(fila.datos, fila.mimeType)
      : 'no está cargada';

    if (!fila || motivo) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });
      const error = new ImagenPrivadaFaltanteError(
        tenant?.name ?? 'este centro',
        tipo,
      );
      logger.error(
        'Falta una firma del centro para generar documentos',
        error,
        {
          action: 'documentos.imagen-privada',
          centro: tenant?.slug ?? tenantId,
          clave: tipo,
          motivo,
        },
      );
      throw error;
    }

    const base64 = Buffer.from(fila.datos).toString('base64');
    imagenes.set(tipo, `data:${fila.mimeType};base64,${base64}`);
  }
  return imagenes;
}

/**
 * Cambia los refs de firma de los placeholders por sus data URIs. Lo que no es
 * un ref de firma queda igual.
 *
 * @throws si un placeholder pide una imagen que no está en `imagenes`: el mapper
 *   y {@link tiposRequeridos} se desincronizaron.
 */
export function aplicarImagenesPrivadas<T extends Record<string, string>>(
  placeholders: T,
  imagenes: ImagenesPrivadas,
): T {
  const resultado: Record<string, string> = { ...placeholders };
  for (const [clave, valor] of Object.entries(placeholders)) {
    if (!esRefImagenPrivada(valor)) continue;
    const tipo = valor.slice(PREFIJO_REF.length);
    const dataUri = esTipoImagenPrivada(tipo) ? imagenes.get(tipo) : undefined;
    if (!dataUri) {
      throw new Error(
        `El placeholder ${clave} pide una imagen que no se resolvió: ${tipo}`,
      );
    }
    resultado[clave] = dataUri;
  }
  return resultado as T;
}
