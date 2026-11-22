/**
 * Firmas sintéticas para los tests de generación. No son imágenes reales: solo
 * la firma de bytes de PNG seguida de un marcador por centro y tipo, que basta
 * para que pasen la validación de formato y para saber, en el HTML generado,
 * de qué centro salió cada una.
 */

import { TIPOS_IMAGEN_PRIVADA } from '@/lib/imagenes-privadas';

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function pngDePrueba(marca: string): Uint8Array {
  return new Uint8Array([...FIRMA_PNG, ...Buffer.from(marca, 'utf8')]);
}

/** El data URI que el resolver produce para `pngDePrueba(marca)`. */
export function dataUriDePrueba(marca: string): string {
  return `data:image/png;base64,${Buffer.from(pngDePrueba(marca)).toString('base64')}`;
}

export interface FilaImagenPrivada {
  tenantId: string;
  tipo: string;
  mimeType: string;
  datos: Uint8Array;
}

/** Todas las firmas de un centro, cada una marcada con `<tenantId>/<tipo>`. */
export function firmasDelCentro(tenantId: string): FilaImagenPrivada[] {
  return TIPOS_IMAGEN_PRIVADA.map((tipo) => ({
    tenantId,
    tipo,
    mimeType: 'image/png',
    datos: pngDePrueba(`${tenantId}/${tipo}`),
  }));
}

/**
 * `findMany` falso que respeta el filtro por `tenantId` y `tipo` como lo haría
 * Postgres. Así un test de aislamiento falla si la consulta deja de filtrar.
 */
export function findManyDeImagenes(filas: FilaImagenPrivada[]) {
  return async (args: {
    where?: { tenantId?: string; tipo?: { in?: string[] } };
  }) =>
    filas.filter(
      (f) =>
        (args.where?.tenantId === undefined ||
          f.tenantId === args.where.tenantId) &&
        (args.where?.tipo?.in === undefined ||
          args.where.tipo.in.includes(f.tipo)),
    );
}
