/**
 * Bug de EQUIPO en `mapAssets` (src/features/document/placeholders/assets-debts.ts).
 *
 * `filterAssetsByType` reparte los bienes muebles en 7 categorías por
 * sub-cadena de `type` — electrónicos, muebles, vehículos, joyas, efectivo,
 * acciones, cuentas por cobrar. Un bien con `type: 'EQUIPO'` (el valor que
 * usaba el selector de un solo nivel para "Equipo Eléctrico/Electrónico")
 * no calzaba con ninguna de las sub-cadenas de electrónicos
 * ('electronico', 'electronic', 'electrodomestico') — "equipo" no las
 * contiene. El bien quedaba fuera de las 7 filas descriptivas de la
 * Solicitud de Insolvencia (MUEBLE_*_DESC), aunque SÍ se contaba en
 * TOTAL_MUEBLES/TOTAL_BIENES/CANTIDAD_MUEBLES (que usan la lista completa
 * de `personalProperty`, no los baldes filtrados): el valor entraba en el
 * total pero el bien en sí desaparecía de la tabla.
 *
 * Este es el fix mínimo autorizado en `assets-debts.ts`: agregar 'equipo'
 * a las sub-cadenas de electrónicos. Sin migración de datos — un bien ya
 * guardado con `type: 'EQUIPO'` (de antes del selector de dos niveles)
 * vuelve a aparecer en la Solicitud sin que nadie lo reedite.
 */

import { mapAssets } from '@/features/document/placeholders/assets-debts';
import { formatCurrency } from '@/features/document/placeholders/format';
import type { CaseWithRelations } from '@/features/case/schemas';

type Asset = CaseWithRelations['assets'][number];

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: 'asset-1',
    name: 'Bien de prueba',
    type: 'OTRO',
    value: 1_000_000,
    caseId: 'case-1',
    debtorId: null,
    description: null,
    propertyType: null,
    address: null,
    registrationNumber: null,
    encumbrance: null,
    affectation: null,
    precautionaryMeasure: null,
    proofDocument: null,
    isFamilyHome: null,
    isInalienablePatrimony: null,
    hasPendingFinesOrTaxes: null,
    brand: null,
    model: null,
    condition: null,
    licensePlate: null,
    transitAuthority: null,
    guaranteeInFavorOf: null,
    guaranteeAmount: null,
    material: null,
    ...overrides,
  } as Asset;
}

describe('mapAssets — un bien EQUIPO ya no desaparece de la Solicitud', () => {
  it('REGRESIÓN: un bien type=EQUIPO aparece en MUEBLE_ELECTRONICO_DESC, no en "No declara"', () => {
    const assets = [
      asset({ id: 'a1', type: 'EQUIPO', name: 'Televisor LG', value: 2_000_000 }),
    ];

    const result = mapAssets(assets);

    expect(result.MUEBLE_ELECTRONICO_DESC).toBe('Televisor LG');
    expect(result.MUEBLE_ELECTRONICO_DESC).not.toBe('No declara');
    expect(result.MUEBLE_ELECTRONICO_VALOR).toBe(formatCurrency(2_000_000));
  });

  it('el valor del bien EQUIPO sigue contando en el total (eso nunca estuvo roto)', () => {
    const assets = [
      asset({ id: 'a1', type: 'EQUIPO', name: 'Televisor LG', value: 2_000_000 }),
    ];

    const result = mapAssets(assets);

    expect(result.TOTAL_MUEBLES).toBe(formatCurrency(2_000_000));
    expect(result.TOTAL_BIENES).toBe(formatCurrency(2_000_000));
    expect(result.CANTIDAD_MUEBLES).toBe('1');
  });

  it('ELECTRONICO (el valor nuevo, normalizado) sigue funcionando igual que antes', () => {
    const assets = [
      asset({ id: 'a1', type: 'ELECTRONICO', name: 'Nevera', value: 1_500_000 }),
    ];

    const result = mapAssets(assets);

    expect(result.MUEBLE_ELECTRONICO_DESC).toBe('Nevera');
    expect(result.MUEBLE_ELECTRONICO_VALOR).toBe(formatCurrency(1_500_000));
  });

  it('EQUIPO y ELECTRONICO conviven en la misma fila (misma categoría del mapper)', () => {
    const assets = [
      asset({ id: 'a1', type: 'EQUIPO', name: 'Televisor LG', value: 2_000_000 }),
      asset({ id: 'a2', type: 'ELECTRONICO', name: 'Nevera', value: 1_500_000 }),
    ];

    const result = mapAssets(assets);

    expect(result.MUEBLE_ELECTRONICO_DESC).toBe('Televisor LG; Nevera');
    expect(result.MUEBLE_ELECTRONICO_VALOR).toBe(formatCurrency(3_500_000));
  });

  it('un bien que de verdad no es ninguna de las 7 categorías (OTRO) sigue sin fila propia', () => {
    // No es el bug de EQUIPO — es el comportamiento documentado y DEJADO
    // así a propósito para OTRO (decisión pendiente, no se tocan plantillas).
    const assets = [
      asset({ id: 'a1', type: 'OTRO', name: 'Colección de monedas', value: 500_000 }),
    ];

    const result = mapAssets(assets);

    expect(result.MUEBLE_ELECTRONICO_DESC).toBe('No declara');
    expect(result.MUEBLE_ENSERES_DESC).toBe('No declara');
    expect(result.MUEBLE_VEHICULO_DESC).toBe('No declara');
    expect(result.MUEBLE_JOYAS_DESC).toBe('No declara');
    expect(result.MUEBLE_EFECTIVO_DESC).toBe('No declara');
    expect(result.MUEBLE_ACCIONES_DESC).toBe('No declara');
    expect(result.MUEBLE_CUENTAS_DESC).toBe('No declara');
    // Pero sigue contando en el total, igual que antes.
    expect(result.TOTAL_MUEBLES).toBe(formatCurrency(500_000));
  });
});
