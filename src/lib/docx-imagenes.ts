/**
 * Tamaño de los logos de branding en los DOCX.
 *
 * Los PDF limitan los logos con CSS (`max-height`, `max-width` por clase). El
 * DOCX sale por otra ruta: `html-to-docx` ignora las hojas de estilo y solo
 * respeta `width`/`height` del atributo `style` del `<img>`. Sin eso usa el
 * tamaño natural de la imagen recortado al ancho útil de la página, y los
 * logos de branding son grandes:
 *
 *  - logo del encabezado de Armonía (1477 × 1477 px) → 18,6 × 18,6 cm, más de
 *    media primera hoja;
 *  - logo del encabezado de Constructores de Paz (1536 × 345 px) → 18,6 × 4,2 cm;
 *  - logo de la firma (1024 × 1024 px, los dos centros) → 18,6 × 18,6 cm.
 *
 * Este módulo es el único punto de control: antes de convertir, fija en cada
 * logo un `width`/`height` en px con los mismos topes que su CSS del PDF, con
 * la proporción de la imagen. No toca el contenido de las plantillas ni otras
 * imágenes (la firma del operador ya es pequeña y sale bien).
 *
 * Sin `'use server'` ni dependencias: lógica pura, probada en
 * `tests/unit/lib/docx-imagenes.test.ts`.
 */

interface Tope {
  /** Ancho máximo en px (CSS `max-width`). */
  maxAncho: number;
  /** Alto máximo en px (CSS `max-height`), si la clase lo tiene. */
  maxAlto?: number;
  /** Centrar el logo en su línea, como en el PDF. */
  centrar?: boolean;
}

/**
 * Topes por clase del `<img>`, los mismos de las hojas de estilo del PDF:
 *
 *  - Encabezado (`styles-base.css`, `styles-conciliacion-base.css`, e5d53e9):
 *    alto 100 px, ancho 380 px (260 px en las remisiones al juzgado), centrado.
 *  - Logo de la firma (`.firma-section .logo-firma` y `.logo-secundario` de
 *    las remisiones): 200 px de ancho. `.logo-small` (Trámite Audiencia) tiene
 *    250 px en su CSS; en el DOCX se deja en 200, el tope de los demás logos de
 *    firma.
 */
export const TOPES_POR_CLASE: Readonly<Record<string, Tope>> = {
  logo: { maxAncho: 380, maxAlto: 100, centrar: true },
  'logo-institucional': { maxAncho: 380, maxAlto: 100, centrar: true },
  'logo-principal': { maxAncho: 260, maxAlto: 100, centrar: true },
  'logo-firma': { maxAncho: 200 },
  'logo-secundario': { maxAncho: 200 },
  'logo-small': { maxAncho: 200 },
};

export interface Dimensiones {
  ancho: number;
  alto: number;
}

/** Ancho y alto en px de un PNG o un JPEG, leídos de su cabecera. */
export function dimensionesDeImagen(buffer: Buffer): Dimensiones | null {
  // PNG: firma de 8 bytes y el chunk IHDR primero (ancho y alto big-endian).
  if (
    buffer.length >= 24 &&
    buffer.readUInt32BE(0) === 0x89504e47 &&
    buffer.toString('ascii', 12, 16) === 'IHDR'
  ) {
    return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
  }
  // JPEG: recorrer los segmentos hasta un SOFn (no DHT, JPG ni DAC).
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) return null;
      const marcador = buffer[i + 1];
      const largo = buffer.readUInt16BE(i + 2);
      const esSof =
        marcador >= 0xc0 &&
        marcador <= 0xcf &&
        marcador !== 0xc4 &&
        marcador !== 0xc8 &&
        marcador !== 0xcc;
      if (esSof) {
        return {
          alto: buffer.readUInt16BE(i + 5),
          ancho: buffer.readUInt16BE(i + 7),
        };
      }
      i += 2 + largo;
    }
  }
  return null;
}

/**
 * Tamaño final con los topes: como `max-width`/`max-height` en CSS, reduce
 * manteniendo la proporción y nunca agranda.
 */
export function medidaConTope(natural: Dimensiones, tope: Tope): Dimensiones {
  const escala = Math.min(
    1,
    tope.maxAncho / natural.ancho,
    tope.maxAlto !== undefined ? tope.maxAlto / natural.alto : 1,
  );
  return {
    ancho: Math.max(1, Math.round(natural.ancho * escala)),
    alto: Math.max(1, Math.round(natural.alto * escala)),
  };
}

const DATA_URI = /^data:image\/(png|jpe?g);base64,(.+)$/i;

function atributo(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\s${nombre}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(
    etiqueta,
  );
  return m ? m[2] : null;
}

function topeDe(clases: string | null): Tope | null {
  for (const clase of (clases ?? '').split(/\s+/)) {
    if (clase && clase in TOPES_POR_CLASE) return TOPES_POR_CLASE[clase];
  }
  return null;
}

/** El `<img>` con `width`/`height` en px en su `style`, conservando el resto. */
function conMedida(etiqueta: string, medida: string): string {
  const estilo = atributo(etiqueta, 'style');
  if (estilo === null) {
    return etiqueta.replace(
      /\s*\/?>$/,
      (cierre) => ` style="${medida}"${cierre.trim() === '/>' ? ' />' : '>'}`,
    );
  }
  const resto = estilo
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !/^(width|height)\s*:/i.test(d));
  const nuevo = [...resto, medida.replace(/;$/, '')].join('; ');
  return etiqueta.replace(
    /(\sstyle\s*=\s*)(["'])[\s\S]*?\2/i,
    (_m, previo: string, comilla: string) =>
      `${previo}${comilla}${nuevo}${comilla}`,
  );
}

/**
 * Fija el tamaño de los logos de branding de un HTML ya listo para convertir a
 * DOCX (con las imágenes en data URI, tras `inlineAssets`).
 *
 * Un logo cuyo tamaño no se puede leer (no es data URI, o no es PNG/JPEG)
 * recibe solo el tope que manda (alto en el encabezado, ancho en la firma): la
 * librería calcula el otro lado con la proporción de la imagen.
 */
export function limitarLogosParaDocx(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (etiqueta) => {
    const tope = topeDe(atributo(etiqueta, 'class'));
    if (!tope) return etiqueta;

    const src = atributo(etiqueta, 'src') ?? '';
    const dataUri = DATA_URI.exec(src.trim());
    const natural = dataUri
      ? dimensionesDeImagen(Buffer.from(dataUri[2], 'base64'))
      : null;

    let medida: string;
    if (natural) {
      const { ancho, alto } = medidaConTope(natural, tope);
      medida = `width:${ancho}px;height:${alto}px`;
    } else {
      medida =
        tope.maxAlto !== undefined
          ? `height:${tope.maxAlto}px`
          : `width:${tope.maxAncho}px`;
    }

    const conTamano = conMedida(etiqueta, medida);
    // html-to-docx toma la alineación del párrafo que contiene la imagen.
    return tope.centrar
      ? `<p style="text-align:center">${conTamano}</p>`
      : conTamano;
  });
}
