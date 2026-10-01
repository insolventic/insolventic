/**
 * El bloque de firma de la conciliadora en los documentos de conciliación.
 *
 * Hallazgo A6 de la auditoría del formulario de conciliación (2026-10-01):
 * once de las doce plantillas imprimen `{{NOMBRE_CONCILIADORA}}`,
 * `{{CC_CONCILIADORA}}` y `{{TP_CONCILIADORA}}` en el bloque de firma, pero las
 * columnas que los alimentan —`concConciliadoraName/CC/TP`— **no tienen ningún
 * campo en el formulario**, ni en el de alta ni en el de edición. El nombre se
 * salvaba porque cae al operador asignado; la cédula y la tarjeta profesional
 * caían a cadena vacía, así que salían en blanco en todos los documentos.
 *
 * `User.professionalCard` es exactamente la tarjeta profesional, y la relación
 * `operator` ya viaja con el caso en la generación — solo que su `select` no la
 * traía.
 *
 * LIMITACIÓN, fijada abajo a propósito: para la **cédula** no hay respaldo.
 * `User` no tiene ningún campo de identificación; el único número que guarda es
 * la tarjeta profesional. Usarla también como cédula imprimiría el mismo número
 * en dos renglones que dicen cosas distintas, en un documento legal. Se deja en
 * blanco hasta que exista el dato.
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { CASE_GENERATION_INCLUDE } from '@/features/document/persistence';

const OPERADOR = {
  id: 'u-1',
  name: 'Beatriz Elena Restrepo',
  email: 'beatriz@example.com',
  professionalCard: 'TP-123456',
};

const makeCase = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'CONCILIATION',
    caseNumber: 'CON-2026-040',
    debtor: {
      name: 'Ana Torres',
      idNumber: '987654321',
      address: 'Calle 8 # 3-20',
      city: 'Bogotá',
      email: 'ana@example.com',
      phone: '3001112222',
      occupation: 'Comerciante',
    },
    operator: OPERADOR,
    debts: [],
    assets: [],
    documents: [],
    legalProcesses: [],
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    causes: [],
    applicantScope: [],
    ...overrides,
  }) as never;

describe('TP_CONCILIADORA — cae a la tarjeta profesional del operador', () => {
  it('sin dato propio usa la tarjeta profesional del operador asignado', () => {
    const p = mapCaseToPlaceholders(makeCase());

    expect(p.TP_CONCILIADORA).toBe('TP-123456');
  });

  it('el dato propio del caso gana sobre el del operador', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ concConciliadoraTP: 'TP-999999' }),
    );

    expect(p.TP_CONCILIADORA).toBe('TP-999999');
  });

  it('sin operador asignado queda vacío, no "undefined"', () => {
    const p = mapCaseToPlaceholders(makeCase({ operator: null }));

    expect(p.TP_CONCILIADORA).toBe('');
  });

  it('un operador sin tarjeta cargada queda vacío, no "undefined"', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ operator: { ...OPERADOR, professionalCard: '' } }),
    );

    expect(p.TP_CONCILIADORA).toBe('');
  });
});

describe('NOMBRE_CONCILIADORA — el fallback que ya existía sigue igual', () => {
  it('cae al nombre del operador asignado', () => {
    expect(mapCaseToPlaceholders(makeCase()).NOMBRE_CONCILIADORA).toBe(
      'Beatriz Elena Restrepo',
    );
  });

  it('el dato propio del caso gana', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ concConciliadoraName: 'Dra. Marta Gómez' }),
    );

    expect(p.NOMBRE_CONCILIADORA).toBe('Dra. Marta Gómez');
  });
});

describe('CC_CONCILIADORA — limitación documentada', () => {
  it('sin dato propio queda vacía: User no guarda ninguna identificación', () => {
    // Fijado a propósito. El día que `User` tenga un campo de identificación,
    // este test falla y es la señal de que hay que enchufar el fallback.
    expect(mapCaseToPlaceholders(makeCase()).CC_CONCILIADORA).toBe('');
  });

  it('NO cae a la tarjeta profesional: son dos números distintos', () => {
    const p = mapCaseToPlaceholders(makeCase());

    expect(p.CC_CONCILIADORA).not.toBe(OPERADOR.professionalCard);
  });

  it('el dato propio del caso sí se usa cuando existe', () => {
    const p = mapCaseToPlaceholders(
      makeCase({ concConciliadoraCC: '52.123.456' }),
    );

    expect(p.CC_CONCILIADORA).toBe('52.123.456');
  });
});

describe('la relación operator viaja con la tarjeta profesional', () => {
  it('el include de generación la pide: sin esto el fallback sería undefined en producción', () => {
    const operator = CASE_GENERATION_INCLUDE.operator as {
      select: Record<string, boolean>;
    };

    expect(operator.select.professionalCard).toBe(true);
  });
});
