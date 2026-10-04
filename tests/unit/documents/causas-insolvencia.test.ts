/**
 * Las 12 filas de la Sección 2 de la Solicitud salían "NO" siempre.
 *
 * Hallazgo T2 de `docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md`: el wizard
 * guardaba ETIQUETAS (`'Pérdida de empleo'`) y `mapCauses` comparaba VALORES de
 * enum (`'PERDIDA_EMPLEO'`), así que el deudor declaraba bajo juramento que
 * ninguna de las 12 causas era la suya. Y como `CAUSA_12_DETALLE` caía a "la
 * primera causa no reconocida", la causa que sí marcó aparecía escrita dentro de
 * "OTROS ¿CUÁL?".
 */

import {
  CAUSAS_INSOLVENCIA,
  CAUSA_OTROS,
  causaLabel,
  normalizeCausa,
  normalizeCausas,
  requiresOtherCauseDetail,
  unknownCausas,
} from '@/features/case/causas-insolvencia';
import { mapCauses } from '@/features/document/placeholders/case-lists';

describe('causas-insolvencia — fuente única', () => {
  it('tiene las 12 causas, en el orden de las 12 filas de la plantilla', () => {
    expect(CAUSAS_INSOLVENCIA).toHaveLength(12);
    expect(CAUSAS_INSOLVENCIA.map((c) => c.value)).toEqual([
      'SOBREENDEUDAMIENTO',
      'PERDIDA_EMPLEO',
      'DIVORCIO',
      'ENFERMEDAD',
      'ACCIDENTE',
      'ESTAFA',
      'DISMINUCION_INGRESOS',
      'MALA_EDUCACION_FINANCIERA',
      'MUERTE_CONYUGE',
      'NUEVOS_CREDITOS',
      'MALA_INVERSION',
      'OTROS',
    ]);
  });

  it('normaliza el valor canónico', () => {
    expect(normalizeCausa('PERDIDA_EMPLEO')).toBe('PERDIDA_EMPLEO');
  });

  it('normaliza la etiqueta que guardaba el wizard', () => {
    expect(normalizeCausa('Pérdida de empleo')).toBe('PERDIDA_EMPLEO');
  });

  it('normaliza sin tildes, sin mayúsculas y con espacios de más', () => {
    expect(normalizeCausa('  perdida  de EMPLEO ')).toBe('PERDIDA_EMPLEO');
  });

  it.each([
    // las dos redacciones que convivían para la misma causa
    ['Falta de educación financiera', 'MALA_EDUCACION_FINANCIERA'],
    [
      'Falta de educación financiera y malos hábitos',
      'MALA_EDUCACION_FINANCIERA',
    ],
    [
      'Falta de educación financiera y malos hábitos financieros',
      'MALA_EDUCACION_FINANCIERA',
    ],
    ['Nuevos créditos para cubrir otros', 'NUEVOS_CREDITOS'],
    ['Acudí a nuevos créditos para cubrir otros', 'NUEVOS_CREDITOS'],
    ['Sobreendeudamiento por falta de recursos', 'SOBREENDEUDAMIENTO'],
    ['Otros', 'OTROS'],
  ])('etiqueta histórica %s → %s', (etiqueta, valor) => {
    expect(normalizeCausa(etiqueta)).toBe(valor);
  });

  it('no reconoce un texto libre', () => {
    expect(normalizeCausa('Cierre del local por obras')).toBeNull();
    expect(unknownCausas(['PERDIDA_EMPLEO', 'Cierre del local'])).toEqual([
      'Cierre del local',
    ]);
  });

  it('normalizeCausas quita duplicados aunque vengan en formas distintas', () => {
    expect(
      normalizeCausas(['PERDIDA_EMPLEO', 'Pérdida de empleo', 'Divorcio']),
    ).toEqual(['PERDIDA_EMPLEO', 'DIVORCIO']);
  });

  it('causaLabel muestra la etiqueta, venga valor o etiqueta vieja', () => {
    expect(causaLabel('PERDIDA_EMPLEO')).toBe('Pérdida de empleo');
    expect(causaLabel('Falta de educación financiera')).toBe(
      'Falta de educación financiera y malos hábitos financieros',
    );
    expect(causaLabel('Algo escrito a mano')).toBe('Algo escrito a mano');
  });

  it('requiresOtherCauseDetail detecta "Otros" en las dos formas', () => {
    expect(requiresOtherCauseDetail(['OTROS'])).toBe(true);
    expect(requiresOtherCauseDetail(['Otros'])).toBe(true);
    expect(requiresOtherCauseDetail(['PERDIDA_EMPLEO'])).toBe(false);
  });
});

describe('mapCauses — las filas SI/NO de la Solicitud', () => {
  const si = (map: Record<string, string>) =>
    Object.entries(map)
      .filter(([k, v]) => /^CAUSA_\d+$/.test(k) && v === 'SI')
      .map(([k]) => k)
      .sort();

  it('marca SI las causas guardadas como VALOR', () => {
    const map = mapCauses(['PERDIDA_EMPLEO', 'ENFERMEDAD']);
    expect(map.CAUSA_2).toBe('SI');
    expect(map.CAUSA_4).toBe('SI');
    expect(si(map)).toEqual(['CAUSA_2', 'CAUSA_4']);
  });

  it('marca SI las causas guardadas como ETIQUETA (expedientes anteriores)', () => {
    // Exactamente lo que hay hoy en producción y en el caso I1 de la verificación.
    const map = mapCauses(
      ['Pérdida de empleo', 'Enfermedad', 'Otros'],
      'Cierre del local comercial arrendado por obras del Metro de Bogotá',
    );
    expect(map.CAUSA_2).toBe('SI');
    expect(map.CAUSA_4).toBe('SI');
    expect(map.CAUSA_12).toBe('SI');
    expect(map.CAUSA_12_DETALLE).toBe(
      'Cierre del local comercial arrendado por obras del Metro de Bogotá',
    );
  });

  it('las no marcadas quedan en NO', () => {
    const map = mapCauses(['PERDIDA_EMPLEO']);
    expect(map.CAUSA_1).toBe('NO');
    expect(map.CAUSA_3).toBe('NO');
    expect(map.CAUSA_12).toBe('NO');
  });

  it('la causa marcada NO se filtra al cuadro de "OTROS ¿CUÁL?"', () => {
    // El caso I2 de la verificación: una sola causa, sin texto libre. Antes
    // salía CAUSA_1='NO' y CAUSA_12_DETALLE='Sobreendeudamiento…'.
    const map = mapCauses(['Sobreendeudamiento por falta de recursos']);
    expect(map.CAUSA_1).toBe('SI');
    expect(map.CAUSA_12).toBe('NO');
    expect(map.CAUSA_12_DETALLE).toBe('');
  });

  it('una causa escrita a mano cuenta como "Otros" y se imprime ahí', () => {
    const map = mapCauses(['PERDIDA_EMPLEO', 'Cierre del local por obras']);
    expect(map.CAUSA_2).toBe('SI');
    expect(map.CAUSA_12).toBe('SI');
    expect(map.CAUSA_12_DETALLE).toBe('Cierre del local por obras');
  });

  it('el texto explícito gana sobre el inferido', () => {
    const map = mapCauses(['Algo a mano'], 'Texto que escribió el operador');
    expect(map.CAUSA_12_DETALLE).toBe('Texto que escribió el operador');
  });

  it('sin causas, las 12 filas van en NO y el detalle vacío', () => {
    const map = mapCauses([]);
    expect(si(map)).toEqual([]);
    expect(map.CAUSA_12_DETALLE).toBe('');
  });

  it('emite exactamente CAUSA_1..CAUSA_12 + CAUSA_12_DETALLE', () => {
    expect(Object.keys(mapCauses([])).sort()).toEqual(
      [
        ...Array.from({ length: 12 }, (_, i) => `CAUSA_${i + 1}`),
        'CAUSA_12_DETALLE',
      ].sort(),
    );
  });
});
