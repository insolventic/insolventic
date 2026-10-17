/**
 * GD-A1 (issue #3) — troceo de lotes grandes de generación en tandas que
 * caben holgadas en `maxDuration = 60` (techo del plan Hobby).
 *
 * Medición de referencia (`docs/IMPLEMENTACION_SEMANA_3.md` §5.1, tabla de
 * capacidad): con `batchHtmlToPdf` (que ya usa `batchGenerateDocuments`),
 * Admisión INSOLVENCY (8 docs) tardó ~24 s → ~3 s/documento. Con 30% de
 * margen de seguridad sobre los 60 s (queda un presupuesto de 42 s por
 * tanda), 42 / 3 ≈ 14 documentos caben — `TANDA_TEMPLATE_COUNT` se fija en
 * 10, más conservador, porque casi toda plantilla produce 1 documento pero
 * una (`suspension-juzgados`, ver `template-variants.ts`) puede producir
 * varios si el caso tiene procesos en distintos juzgados, y el troceo de
 * abajo cuenta PLANTILLAS, no documentos ya expandidos (esa expansión
 * depende de los datos del caso, no de la lista estática de plantillas).
 *
 * Sin dependencias de Prisma/Next ('use server' exige que todo export sea
 * async) para poder probarse como función pura.
 */

export const TANDA_TEMPLATE_COUNT = 10;

/**
 * Parte una lista de ids de plantilla en tandas de a lo sumo `size`.
 * Una lista vacía produce cero tandas (nada que generar, no un error).
 */
export function chunkIntoTandas(
  templateIds: readonly string[],
  size: number = TANDA_TEMPLATE_COUNT,
): string[][] {
  if (size <= 0) {
    throw new Error('El tamaño de tanda debe ser mayor que cero');
  }
  const tandas: string[][] = [];
  for (let i = 0; i < templateIds.length; i += size) {
    tandas.push(templateIds.slice(i, i + size));
  }
  return tandas;
}
