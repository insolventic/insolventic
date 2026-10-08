/**
 * El Check List nunca se podía generar: `mapCheckList` no producía NINGUNO de
 * los 6 placeholders de los Parágrafos (`SI`/`NO_PARAGRAFO_1/2/3`), y las dos
 * rutas de generación bloquean el documento ante cualquier placeholder sin
 * resolver. `check-list` tiene `generateOnCreate: true`, así que faltaba en el
 * Paquete 1 de todo expediente de insolvencia.
 *
 * Hallazgo §4.1 de docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md.
 * Pendiente documentado en docs/CHECKPOINT_2026-09-28.md §5.3 y
 * docs/PENDIENTES_DECISION_LEGAL.md (ítem 2).
 *
 * Este PR resuelve 2 de los 3 (Parágrafo 1 y 2) y deja el 3 a propósito sin
 * wirear — no hay campo limpio y no corresponde inventar una regla. El Check
 * List sigue bloqueado por SI_PARAGRAFO_3/NO_PARAGRAFO_3 hasta que la abogada
 * responda; eso es correcto, no un defecto de este PR.
 *
 * De paso, mismo mapper y mismo riesgo: SI_DOC_CONOCE_NORMA/NO_DOC_CONOCE_NORMA
 * estaban hardcodeados a "NO conoce la norma" sin importar lo que declarara el
 * deudor.
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Caso base del golden (insolvencia-completa), con overrides puntuales. */
function caso(overrides: Partial<CaseWithRelations> = {}): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return { ...base, ...overrides };
}

describe('Check List — Parágrafo 1 (declaracionNoOmisiones)', () => {
  it('declarado → SI_PARAGRAFO_1 marcado, NO_PARAGRAFO_1 vacío', () => {
    const map = mapCaseToPlaceholders(caso({ declaracionNoOmisiones: true }));
    expect(map.SI_PARAGRAFO_1).toBe('X');
    expect(map.NO_PARAGRAFO_1).toBe('');
  });

  it('no declarado → al revés', () => {
    const map = mapCaseToPlaceholders(caso({ declaracionNoOmisiones: false }));
    expect(map.SI_PARAGRAFO_1).toBe('');
    expect(map.NO_PARAGRAFO_1).toBe('X');
  });

  it('sin dato (undefined, expediente viejo) cuenta como no declarado', () => {
    const map = mapCaseToPlaceholders(
      caso({ declaracionNoOmisiones: undefined }),
    );
    expect(map.SI_PARAGRAFO_1).toBe('');
    expect(map.NO_PARAGRAFO_1).toBe('X');
  });
});

describe('Check List — Parágrafo 2 (siempre X, es texto fijo de la Solicitud)', () => {
  it('siempre SI, sin importar el caso', () => {
    const conDato = mapCaseToPlaceholders(
      caso({ declaracionNoOmisiones: true }),
    );
    const sinDato = mapCaseToPlaceholders(
      caso({ declaracionNoOmisiones: false }),
    );
    for (const map of [conDato, sinDato]) {
      expect(map.SI_PARAGRAFO_2).toBe('X');
      expect(map.NO_PARAGRAFO_2).toBe('');
    }
  });
});

describe('Check List — Parágrafo 3 (a propósito SIN wirear)', () => {
  it('sigue sin producirse: el Check List sigue bloqueado hasta que se resuelva', () => {
    const map = mapCaseToPlaceholders(caso());
    expect(map.SI_PARAGRAFO_3).toBeUndefined();
    expect(map.NO_PARAGRAFO_3).toBeUndefined();
  });
});

describe('Check List — "Manifiesta que conoce la norma" (declaracionConocimientoNorma)', () => {
  it('declarado → SI_DOC_CONOCE_NORMA marcado', () => {
    const map = mapCaseToPlaceholders(
      caso({ declaracionConocimientoNorma: true }),
    );
    expect(map.SI_DOC_CONOCE_NORMA).toBe('X');
    expect(map.NO_DOC_CONOCE_NORMA).toBe('');
  });

  it('no declarado → al revés (antes salía "NO" siempre, aunque esto diera true)', () => {
    const map = mapCaseToPlaceholders(
      caso({ declaracionConocimientoNorma: false }),
    );
    expect(map.SI_DOC_CONOCE_NORMA).toBe('');
    expect(map.NO_DOC_CONOCE_NORMA).toBe('X');
  });
});
