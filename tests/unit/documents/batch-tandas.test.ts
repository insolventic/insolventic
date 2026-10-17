/**
 * Unit test: troceo de lotes grandes en tandas (GD-A1, issue #3).
 *
 * `chunkIntoTandas` es la función pura que decide cuántas tandas necesita un
 * lote y qué va en cada una — sin Prisma, sin auth, para poder fijar el
 * troceo exacto sin montar todo `batchGenerateDocuments`.
 */

import { chunkIntoTandas, TANDA_TEMPLATE_COUNT } from '@/features/document/batch-tandas';

const idsOfLength = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `tpl-${i}`);

describe('chunkIntoTandas', () => {
  it('TANDA_TEMPLATE_COUNT está fijado en 10 (ver el comentario con la medición de IMPLEMENTACION_SEMANA_3)', () => {
    expect(TANDA_TEMPLATE_COUNT).toBe(10);
  });

  it('1 documento: una sola tanda de 1', () => {
    const tandas = chunkIntoTandas(idsOfLength(1));
    expect(tandas).toEqual([['tpl-0']]);
  });

  it('27 documentos (Paquete 5 - Fracaso, etiqueta de la UI): 3 tandas de 10/10/7', () => {
    const tandas = chunkIntoTandas(idsOfLength(27));
    expect(tandas).toHaveLength(3);
    expect(tandas.map((t) => t.length)).toEqual([10, 10, 7]);
    // Ninguna plantilla se pierde ni se repite entre tandas.
    expect(tandas.flat()).toEqual(idsOfLength(27));
  });

  it('49 documentos (Todos los paquetes, etiqueta de la UI): 5 tandas de 10/10/10/10/9', () => {
    const tandas = chunkIntoTandas(idsOfLength(49));
    expect(tandas).toHaveLength(5);
    expect(tandas.map((t) => t.length)).toEqual([10, 10, 10, 10, 9]);
    expect(tandas.flat()).toEqual(idsOfLength(49));
  });

  it('65 documentos (ALL_TEMPLATES real, ver templates-config.ts): 7 tandas, la última de 5', () => {
    const tandas = chunkIntoTandas(idsOfLength(65));
    expect(tandas).toHaveLength(7);
    expect(tandas.map((t) => t.length)).toEqual([10, 10, 10, 10, 10, 10, 5]);
  });

  it('exactamente un múltiplo del tamaño de tanda: ninguna tanda vacía de sobra', () => {
    const tandas = chunkIntoTandas(idsOfLength(20));
    expect(tandas).toHaveLength(2);
    expect(tandas.every((t) => t.length === 10)).toBe(true);
  });

  it('lista vacía: cero tandas, no un error (nada que generar es válido)', () => {
    expect(chunkIntoTandas([])).toEqual([]);
  });

  it('tamaño de tanda personalizado, para quien quiera trocear más fino', () => {
    const tandas = chunkIntoTandas(idsOfLength(5), 2);
    expect(tandas.map((t) => t.length)).toEqual([2, 2, 1]);
  });

  it('rechaza un tamaño de tanda cero o negativo', () => {
    expect(() => chunkIntoTandas(idsOfLength(3), 0)).toThrow();
    expect(() => chunkIntoTandas(idsOfLength(3), -1)).toThrow();
  });
});
