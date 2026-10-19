/**
 * `src/features/case/asset-category-types.ts` — normalización de valores
 * viejos de `Asset.type` y derivación de categoría (nivel 1 del selector).
 */

import {
  ASSET_CATEGORIES,
  MOVABLE_ASSET_TYPES,
  PROPERTY_TYPE_OPTIONS,
  normalizeAssetType,
  categoryForAssetType,
} from '@/features/case/asset-category-types';

describe('ASSET_CATEGORIES / MOVABLE_ASSET_TYPES / PROPERTY_TYPE_OPTIONS', () => {
  it('dos categorías: Inmueble y Mueble', () => {
    expect(ASSET_CATEGORIES.map((c) => c.value)).toEqual([
      'INMUEBLE',
      'MUEBLE',
    ]);
  });

  it('8 tipos de bien mueble, incluido OTRO, sin duplicados', () => {
    const values = MOVABLE_ASSET_TYPES.map((t) => t.value);
    expect(values).toHaveLength(8);
    expect(new Set(values).size).toBe(8);
    expect(values).toContain('OTRO');
  });

  it('las dos etiquetas corregidas por decisión de producto', () => {
    const electronico = MOVABLE_ASSET_TYPES.find(
      (t) => t.value === 'ELECTRONICO',
    );
    const joyas = MOVABLE_ASSET_TYPES.find((t) => t.value === 'JOYAS');
    expect(electronico?.label).toBe('Equipos eléctricos y electrónicos');
    // No repite "electrónico"/"electrónicos" dos veces.
    expect(
      (electronico?.label.match(/electr[oó]nic/gi) ?? []).length,
    ).toBe(1);
    expect(joyas?.label).toBe('Joyas');
  });

  it('PROPERTY_TYPE_OPTIONS trae los 8 tipos de inmueble, con OTRO', () => {
    const values = PROPERTY_TYPE_OPTIONS.map((t) => t.value);
    expect(values).toEqual([
      'CASA',
      'APARTAMENTO',
      'LOTE',
      'LOCAL',
      'BODEGA',
      'OFICINA',
      'FINCA',
      'OTRO',
    ]);
  });
});

describe('normalizeAssetType', () => {
  it.each([
    ['EQUIPO', 'ELECTRONICO'],
    ['MUEBLE', 'ENSERES'],
    ['JOYA', 'JOYAS'],
    ['DINERO', 'EFECTIVO'],
    ['ACCION', 'ACCIONES'],
    ['CUENTA_COBRAR', 'CUENTAS'],
  ])('normaliza el valor viejo %s -> %s', (old, nuevo) => {
    expect(normalizeAssetType(old)).toBe(nuevo);
  });

  it.each(['INMUEBLE', 'VEHICULO', 'OTRO', 'ELECTRONICO', 'ENSERES'])(
    'deja %s sin cambios (ya era el valor correcto, o no cambió)',
    (value) => {
      expect(normalizeAssetType(value)).toBe(value);
    },
  );

  it('vacío / null / undefined -> cadena vacía', () => {
    expect(normalizeAssetType('')).toBe('');
    expect(normalizeAssetType(null)).toBe('');
    expect(normalizeAssetType(undefined)).toBe('');
  });

  it('un valor desconocido pasa tal cual (no inventa una categoría)', () => {
    expect(normalizeAssetType('ALGO_RARO')).toBe('ALGO_RARO');
  });
});

describe('categoryForAssetType', () => {
  it('INMUEBLE -> categoría Inmueble', () => {
    expect(categoryForAssetType('INMUEBLE')).toBe('INMUEBLE');
  });

  it.each(MOVABLE_ASSET_TYPES.map((t) => t.value))(
    '%s (tipo de mueble ya normalizado) -> categoría Mueble',
    (value) => {
      expect(categoryForAssetType(value)).toBe('MUEBLE');
    },
  );

  it.each([
    ['EQUIPO', 'MUEBLE'],
    ['MUEBLE', 'MUEBLE'],
    ['JOYA', 'MUEBLE'],
    ['DINERO', 'MUEBLE'],
    ['ACCION', 'MUEBLE'],
    ['CUENTA_COBRAR', 'MUEBLE'],
  ])(
    'un bien guardado con el valor viejo %s también resuelve a categoría %s',
    (old, categoria) => {
      expect(categoryForAssetType(old)).toBe(categoria);
    },
  );

  it('vacío -> sin categoría (undefined), no adivina', () => {
    expect(categoryForAssetType('')).toBeUndefined();
    expect(categoryForAssetType(null)).toBeUndefined();
    expect(categoryForAssetType(undefined)).toBeUndefined();
  });

  it('un valor totalmente desconocido -> sin categoría', () => {
    expect(categoryForAssetType('ALGO_RARO')).toBeUndefined();
  });
});
