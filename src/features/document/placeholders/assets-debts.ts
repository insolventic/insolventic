/**
 * Sub-mappers de patrimonio: acreencias y bienes (Paso 5 de la división de
 * `placeholder-mapper.ts`; ver el plan en `docs/PLAN_DIVISION_MAPPER.md`).
 *
 * Se mueven aquí, SIN cambiar su código, `mapDebts` y `mapAssets`. Cumplen las
 * dos condiciones de "menor riesgo" del plan: no dependen de ningún otro
 * sub-mapper (solo del tipo `PlaceholderMap` y de `formatCurrency`/
 * `boolToSiNo`, ya extraídos en el Paso 1) y no participan en ninguna de las
 * 16 colisiones del contrato de orden de fusión (`mapper-merge-order.test.ts`).
 * Se llaman desde un solo lugar, `mapCaseToPlaceholders`.
 *
 * A diferencia del Paso 4, ninguna de las dos llama a `escapePlaceholder`: no
 * interpolan texto libre del usuario en HTML, solo formatean números y
 * concatenan campos planos (`PlaceholderMap` los escapa como string normal en
 * el punto de fusión). No hace falta la dependencia circular de ese paso.
 *
 * Este paso estuvo bloqueado hasta que #79 (retirar los 264 slots numerados de
 * acreedor) se mergeó: movía `mapDebts` justo cuando ese PR lo reescribía
 * (117 → 17 líneas), y hacerlo antes garantizaba un conflicto add/add contra
 * una rama ya en vuelo. Con #79 en `dev`, `mapDebts` ya está en su forma
 * final de tres totales agregados.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { formatCurrency, boolToSiNo } from './format';

// Map debts (creditors) to placeholders
/**
 * Totales de las acreencias.
 *
 * Los slots numerados que esta funcion producia -AC{n}_* para las fichas y
 * ACREEDOR_{n}/VALOR_{n}/LIBRANZA_{n}/CLASE_{n}/PORCENTAJE_{n}/DIAS_{n} para el
 * cuadro resumen- se retiraron en el Paso 5 de
 * docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md: topaban la lista en 11 y las dos
 * plantillas que los consumian (Solicitud de Insolvencia y CYG Tramite) ahora
 * iteran `ACREEDORES` con {{#each}}, sin tope.
 *
 * Quedan los tres totales, que son agregados y no por acreedor.
 */
export function mapDebts(debts: CaseWithRelations['debts']): PlaceholderMap {
  const totalDebt = debts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalCapital = debts.reduce(
    (sum, d) => sum + (Number(d.capitalAmount) || Number(d.amount) || 0),
    0,
  );
  const totalIntereses = debts.reduce(
    (sum, d) => sum + (Number(d.interestAmount) || 0),
    0,
  );

  return {
    TOTAL_ACREENCIAS: formatCurrency(totalDebt),
    TOTAL_CAPITAL: formatCurrency(totalCapital),
    TOTAL_INTERESES: formatCurrency(totalIntereses),
  };
}

// Map assets to placeholders
export function mapAssets(assets: CaseWithRelations['assets']): PlaceholderMap {
  const result: PlaceholderMap = {};

  // Separate real estate from personal property
  const realEstate = assets.filter(
    (a) => a.type === 'INMUEBLE' || a.type === 'REAL_ESTATE',
  );
  const personalProperty = assets.filter(
    (a) => a.type !== 'INMUEBLE' && a.type !== 'REAL_ESTATE',
  );

  // Map ALL real estate properties (up to 5)
  for (let i = 0; i < 5; i++) {
    const immueble = realEstate[i];
    const idx = i + 1;

    if (immueble) {
      result[`INMUEBLE_${idx}_TIPO`] =
        immueble.propertyType || immueble.name || '';
      result[`INMUEBLE_${idx}_DIRECCION`] = immueble.address || '';
      result[`INMUEBLE_${idx}_MATRICULA`] = immueble.registrationNumber || '';
      result[`INMUEBLE_${idx}_VALOR`] = formatCurrency(immueble.value);
      result[`INMUEBLE_${idx}_GRAVAMEN`] = immueble.encumbrance || '';
      result[`INMUEBLE_${idx}_AFECTACION`] = immueble.affectation || '';
      result[`INMUEBLE_${idx}_MEDIDA`] = immueble.precautionaryMeasure || '';
      result[`INMUEBLE_${idx}_VIVIENDA_FAMILIAR`] = boolToSiNo(
        immueble.isFamilyHome,
      );
      result[`INMUEBLE_${idx}_PATRIMONIO_FAMILIA`] = boolToSiNo(
        immueble.isInalienablePatrimony,
      );
      result[`INMUEBLE_${idx}_DOCUMENTO`] =
        immueble.proofDocument || 'Certificado de tradición y libertad';
    }
  }

  // Keep backward compatibility with single INMUEBLE_ variables
  const firstImmueble = realEstate[0];
  if (firstImmueble) {
    result['INMUEBLE_TIPO'] =
      firstImmueble.propertyType || firstImmueble.name || '';
    result['INMUEBLE_DIRECCION'] = firstImmueble.address || '';
    result['INMUEBLE_MATRICULA'] = firstImmueble.registrationNumber || '';
    result['INMUEBLE_VALOR'] = formatCurrency(firstImmueble.value);
    result['INMUEBLE_GRAVAMEN'] = firstImmueble.encumbrance || '';
    result['INMUEBLE_AFECTACION'] = firstImmueble.affectation || '';
    result['INMUEBLE_MEDIDA'] = firstImmueble.precautionaryMeasure || '';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = boolToSiNo(
      firstImmueble.isFamilyHome,
    );
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = boolToSiNo(
      firstImmueble.isInalienablePatrimony,
    );
    result['INMUEBLE_DOCUMENTO'] =
      firstImmueble.proofDocument || 'Certificado de tradición y libertad';
  } else {
    result['INMUEBLE_TIPO'] = 'No declara bienes inmuebles';
    result['INMUEBLE_DIRECCION'] = '';
    result['INMUEBLE_MATRICULA'] = '';
    result['INMUEBLE_VALOR'] = '';
    result['INMUEBLE_GRAVAMEN'] = '';
    result['INMUEBLE_AFECTACION'] = '';
    result['INMUEBLE_MEDIDA'] = '';
    result['INMUEBLE_VIVIENDA_FAMILIAR'] = '';
    result['INMUEBLE_PATRIMONIO_FAMILIA'] = '';
    result['INMUEBLE_DOCUMENTO'] = '';
  }

  // Personal property by category - get ALL items, not just first
  const filterAssetsByType = (types: string[]) =>
    personalProperty.filter((a) =>
      types.some((t) => a.type?.toLowerCase().includes(t.toLowerCase())),
    );

  const allElectronics = filterAssetsByType([
    'electronico',
    'electronic',
    'electrodomestico',
    // 'EQUIPO' era el valor del selector de un solo nivel para "Equipo
    // Eléctrico/Electrónico" (ahora normalizado a 'ELECTRONICO' en el
    // formulario, ver asset-category-types.ts) — sin esto, un bien ya
    // guardado con ese valor no calzaba con ninguna sub-cadena de arriba y
    // desaparecía de esta fila (seguía contando en TOTAL_MUEBLES, pero
    // nunca se listaba).
    'equipo',
  ]);
  const allFurniture = filterAssetsByType(['mueble', 'enseres', 'furniture']);
  const allVehicles = filterAssetsByType([
    'vehiculo',
    'vehicle',
    'carro',
    'moto',
  ]);
  const allJewelry = filterAssetsByType(['joya', 'jewelry']);
  const allCash = filterAssetsByType(['efectivo', 'cash', 'dinero']);
  const allStocks = filterAssetsByType(['accion', 'stock', 'inversion']);
  const allReceivables = filterAssetsByType(['cuenta', 'receivable', 'cobrar']);

  // Generate consolidated descriptions for each category
  const formatAssetList = (items: typeof personalProperty) => {
    if (items.length === 0) return 'No declara';
    return items.map((a) => a.description || a.name || a.type).join('; ');
  };

  // `value` llega como `Prisma.Decimal` por la ruta automática (ver
  // asCaseWithRelations) y `Decimal.valueOf()` devuelve un STRING: con
  // `sum + a.value` el `+` concatena en vez de sumar (1 inmueble de $100M sale
  // como $1.000M; con 2 activos, cifras de 15 dígitos). `Number()` en cada
  // sumando lo evita, igual que en el resto de las sumas de este archivo.
  const sumValues = (items: typeof assets) =>
    items.reduce((sum, a) => sum + (Number(a.value) || 0), 0);

  // Format vehicles with full details
  const formatVehicleList = (vehicles: typeof personalProperty) => {
    if (vehicles.length === 0) return 'No declara';
    return vehicles
      .map((v) =>
        `${v.brand || ''} ${v.model || ''} - Placa: ${v.licensePlate || 'N/A'}`.trim(),
      )
      .join('; ');
  };

  result['MUEBLE_ELECTRONICO_DESC'] = formatAssetList(allElectronics);
  result['MUEBLE_ELECTRONICO_VALOR'] =
    allElectronics.length > 0
      ? formatCurrency(sumValues(allElectronics))
      : 'N/A';
  result['MUEBLE_ENSERES_DESC'] = formatAssetList(allFurniture);
  result['MUEBLE_ENSERES_VALOR'] =
    allFurniture.length > 0 ? formatCurrency(sumValues(allFurniture)) : 'N/A';
  result['MUEBLE_VEHICULO_DESC'] = formatVehicleList(allVehicles);
  result['MUEBLE_VEHICULO_VALOR'] =
    allVehicles.length > 0 ? formatCurrency(sumValues(allVehicles)) : 'N/A';
  result['MUEBLE_JOYAS_DESC'] = formatAssetList(allJewelry);
  result['MUEBLE_JOYAS_VALOR'] =
    allJewelry.length > 0 ? formatCurrency(sumValues(allJewelry)) : 'N/A';
  result['MUEBLE_EFECTIVO_DESC'] = formatAssetList(allCash);
  result['MUEBLE_EFECTIVO_VALOR'] =
    allCash.length > 0 ? formatCurrency(sumValues(allCash)) : 'N/A';
  result['MUEBLE_ACCIONES_DESC'] = formatAssetList(allStocks);
  result['MUEBLE_ACCIONES_VALOR'] =
    allStocks.length > 0 ? formatCurrency(sumValues(allStocks)) : 'N/A';
  result['MUEBLE_CUENTAS_DESC'] = formatAssetList(allReceivables);
  result['MUEBLE_CUENTAS_VALOR'] =
    allReceivables.length > 0
      ? formatCurrency(sumValues(allReceivables))
      : 'N/A';

  // Totals
  const totalRealEstate = sumValues(realEstate);
  const totalPersonal = sumValues(personalProperty);
  result['TOTAL_INMUEBLES'] = formatCurrency(totalRealEstate);
  result['TOTAL_MUEBLES'] = formatCurrency(totalPersonal);
  result['TOTAL_BIENES'] = formatCurrency(totalRealEstate + totalPersonal);

  // Counts
  result['CANTIDAD_INMUEBLES'] = realEstate.length.toString();
  result['CANTIDAD_MUEBLES'] = personalProperty.length.toString();
  result['CANTIDAD_BIENES'] = assets.length.toString();

  return result;
}
