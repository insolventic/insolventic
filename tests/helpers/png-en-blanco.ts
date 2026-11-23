/**
 * Un PNG válido en blanco, de escala de grises, con el tamaño pedido.
 *
 * Sirve para probar lógica que depende de las medidas de una imagen privada
 * (una firma, un sello) sin tenerla en el repositorio. Pesa poco aunque sea
 * grande: las filas en blanco se comprimen casi del todo.
 */
import zlib from 'node:zlib';

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const tipoYDatos = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tipoYDatos));
  return Buffer.concat([largo, tipoYDatos, crc]);
}

export function pngEnBlanco(ancho: number, alto: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // 8 bits por muestra
  ihdr[9] = 0; // escala de grises
  // compresión, filtro y entrelazado: 0
  // Cada fila: un byte de filtro (0) y `ancho` píxeles blancos.
  const fila = Buffer.alloc(1 + ancho, 0xff);
  fila[0] = 0;
  const crudo = Buffer.concat(Array.from({ length: alto }, () => fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', zlib.deflateSync(crudo)),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}
