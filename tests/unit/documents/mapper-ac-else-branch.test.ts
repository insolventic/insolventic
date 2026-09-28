/**
 * Hallazgo C (investigación en el chat de esta sesión, no en PR #43).
 *
 * `mapDebts` llena AC1..AC11 (detalle de acreedor para la plantilla "Solicitud de
 * Insolvencia.html", que usa AC1-AC3) en un bucle `for (let i = 0; i < 11; i++)`.
 * Cuando el acreedor en esa posición existe, la rama `if (debt)` llena 18 claves.
 * Cuando NO existe (el caso tiene menos deudas que el índice), la rama `else` solo
 * llenaba 8 de esas 18 — se olvidaba 10: AC{n}_DOMICILIO, _DIRECCION, _EMAIL,
 * _POSTERGADO, _TASA, _FECHA_OTORGAMIENTO, _FECHA_VENCIMIENTO, _CODEUDOR_NOMBRE,
 * _CODEUDOR_DOMICILIO, _CODEUDOR_DIRECCION. Como la plantilla no tiene ningún
 * `{{#if}}`/`{{#each}}` (no es el Bug B), esas 10 claves × 3 posiciones (AC1-AC3)
 * quedaban genuinamente sin resolver en cualquier caso con menos de 3 deudas —
 * el caso más común, no el raro.
 */
import fs from 'fs';
import path from 'path';

import {
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates/insolvency/Solicitud de Insolvencia.html',
);

const MISSING_SUFFIXES = [
  'DOMICILIO',
  'DIRECCION',
  'EMAIL',
  'POSTERGADO',
  'TASA',
  'FECHA_OTORGAMIENTO',
  'FECHA_VENCIMIENTO',
  'CODEUDOR_NOMBRE',
  'CODEUDOR_DOMICILIO',
  'CODEUDOR_DIRECCION',
];

const ALL_MISSING_KEYS = ['AC1', 'AC2', 'AC3'].flatMap((prefix) =>
  MISSING_SUFFIXES.map((suffix) => `${prefix}_${suffix}`),
);

describe('mapDebts: AC{n}_* cuando el acreedor no existe en esa posición (Hallazgo C)', () => {
  it('con 0 deudas (insolvencia-minima), las 30 claves ya salen resueltas (antes: sin resolver)', () => {
    const p = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-minima'].build() as never,
    );
    for (const key of ALL_MISSING_KEYS) {
      expect(p).toHaveProperty(key);
      expect(p[key]).toBe('');
    }
  });

  it('con 1 deuda, AC1 sale lleno (rama "if") y AC2/AC3 ya no quedan sin resolver', () => {
    const caseData = SCENARIOS['insolvencia-minima'].build() as {
      debts: unknown[];
    };
    caseData.debts = [
      {
        creditor: { name: 'Banco Único S.A.' },
        creditorCity: 'Medellín',
        creditorAddress: 'Cra 1 # 2-3',
        creditorEmail: 'unico@example.com',
        amount: 1000,
        capitalAmount: 900,
        interestAmount: 100,
        interestRate: 2,
        isDeferred: false,
        documentType: 'Pagaré',
        grantDate: '2020-01-01T00:00:00Z',
        dueDate: '2021-01-01T00:00:00Z',
        creditClassification: 'Quirografario',
        coDebtorName: '',
        coDebtorCity: '',
        coDebtorAddress: '',
      },
    ];
    const p = mapCaseToPlaceholders(caseData as never);
    expect(p.AC1_NOMBRE).toBe('Banco Único S.A.');
    expect(p.AC1_DOMICILIO).toBe('Medellín');
    for (const key of ['AC2', 'AC3'].flatMap((prefix) =>
      MISSING_SUFFIXES.map((s) => `${prefix}_${s}`),
    )) {
      expect(p[key]).toBe('');
    }
  });

  it('la plantilla real ya no queda con placeholders sin resolver con 0 deudas', () => {
    const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const p = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-minima'].build() as never,
    );
    const { unresolved } = renderDocumentHtml(html, p);
    expect(unresolved).toEqual([]);
  });
});
