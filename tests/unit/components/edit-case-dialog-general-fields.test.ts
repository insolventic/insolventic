/**
 * Contrato: toda columna de `updateCaseSchema` tiene que llegar al diálogo
 * de edición por alguna vía conocida.
 *
 * Antes, el `reset()` y el `submitData` de `edit-case-dialog.tsx` enumeraban
 * a mano ~230 columnas escalares. Enumerar a mano es exactamente cómo 19
 * campos de Sección III (información laboral), 10 de cónyuge, 6 de cesación
 * de pagos, 8 de declaraciones, 8 del apoderado legacy y
 * `notificationCity`/`otherCauseDetail` quedaron afuera sin que nada avisara
 * (auditoría transversal, 2026-10-02): el diálogo abría esos campos en
 * blanco aunque el caso tuviera datos, y lo que el operador escribiera ahí
 * se descartaba en silencio al guardar.
 *
 * `GENERAL_SCALAR_FIELDS` reemplaza la enumeración por una derivación de
 * `Object.keys(updateCaseSchema.shape)`, así que una columna nueva entra
 * sola. Este archivo fija dos cosas:
 *
 *  1. Toda clave de `updateCaseSchema` cae en EXACTAMENTE una categoría
 *     conocida: general (el derivado), `conc*`/`apoyo*` (prefijo, ver
 *     `type-specific-fields.ts`), o `HANDLED_ELSEWHERE` (manejo propio,
 *     documentado campo por campo en `general-fields.ts`). Si alguien agrega
 *     una columna a `updateCaseSchema` sin acomodarla en ninguna, este test
 *     la señala.
 *  2. El diálogo de verdad usa el derivado (no es una función que existe
 *     pero nadie llama).
 */

import { updateCaseSchema } from '@/features/case/schemas';
import { isTypeSpecificField } from '@/app/cases/components/edit-case-dialog/type-specific-fields';
import {
  GENERAL_SCALAR_FIELDS,
  HANDLED_ELSEWHERE,
  pickGeneralFields,
  pickGeneralValues,
} from '@/app/cases/components/edit-case-dialog/general-fields';

import fs from 'fs';
import path from 'path';

const ALL_KEYS = Object.keys(updateCaseSchema.shape);

describe('cobertura total de updateCaseSchema en el diálogo de edición', () => {
  it('no hay cero columnas (guardia de que el schema no se vació)', () => {
    expect(ALL_KEYS.length).toBeGreaterThan(200);
  });

  it('toda clave de updateCaseSchema cae en una categoría conocida', () => {
    const sinCategoria = ALL_KEYS.filter(
      (key) =>
        !GENERAL_SCALAR_FIELDS.includes(key) &&
        !isTypeSpecificField(key) &&
        !HANDLED_ELSEWHERE.has(key),
    );

    expect(sinCategoria).toEqual([]);
  });

  it('las 3 categorías no se superponen entre sí', () => {
    const general = new Set(GENERAL_SCALAR_FIELDS);
    const conc = ALL_KEYS.filter((k) => isTypeSpecificField(k));

    for (const key of conc) {
      expect(general.has(key)).toBe(false);
      expect(HANDLED_ELSEWHERE.has(key)).toBe(false);
    }
    for (const key of HANDLED_ELSEWHERE) {
      expect(general.has(key)).toBe(false);
    }
  });

  it('HANDLED_ELSEWHERE son excepciones puntuales, no la mayoría del schema', () => {
    // Si esto crece mucho, alguien está usando la excepción como atajo en vez
    // de resolver por qué el campo necesita manejo propio.
    expect(HANDLED_ELSEWHERE.size).toBeLessThan(20);
  });

  it('el diálogo real usa pickGeneralFields en el reset y pickGeneralValues en el submit', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/cases/components/edit-case-dialog.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /import\s*\{[^}]*pickGeneralFields[^}]*pickGeneralValues[^}]*\}\s*from\s*['"]\.\/edit-case-dialog\/general-fields['"]/s,
    );
    expect(source).toContain('...pickGeneralFields(');
    expect(source).toContain('...pickGeneralValues(');
  });
});

describe('pickGeneralFields / pickGeneralValues — el mecanismo real', () => {
  it('un campo con dato real viaja tal cual al reset', () => {
    const out = pickGeneralFields({
      notificationCity: 'Medellín',
      conyugeNombreCompleto: 'Laura Gómez',
      cesacionPagos: true,
      declaracionVeracidadInformacion: true,
      apoderadoNombreCompleto: 'Dr. Pérez',
      otherCauseDetail: 'Enfermedad catastrófica',
    });

    expect(out.notificationCity).toBe('Medellín');
    expect(out.conyugeNombreCompleto).toBe('Laura Gómez');
    expect(out.cesacionPagos).toBe(true);
    expect(out.declaracionVeracidadInformacion).toBe(true);
    expect(out.apoderadoNombreCompleto).toBe('Dr. Pérez');
    expect(out.otherCauseDetail).toBe('Enfermedad catastrófica');
  });

  it('null/undefined se normaliza al blanco de su propio tipo, no a un string vacío genérico', () => {
    const out = pickGeneralFields({
      notificationCity: null, // string -> ''
      cesacionPagos: null, // boolean -> false
      causes: null, // array -> []
      paymentOrder: null, // object -> {}
      gracePeriodMonths: null, // number -> undefined
    });

    expect(out.notificationCity).toBe('');
    expect(out.cesacionPagos).toBe(false);
    expect(out.causes).toEqual([]);
    expect(out.paymentOrder).toEqual({});
    expect(out.gracePeriodMonths).toBeUndefined();
  });

  it('un Date se formatea como YYYY-MM-DD, igual que el resto de las fechas del diálogo', () => {
    const out = pickGeneralFields({
      filingDate: new Date(Date.UTC(2026, 2, 15)),
    });

    expect(out.filingDate).toBe('2026-03-15');
  });

  it('un monto Decimal-como-number (lo que trae caseSchema) se convierte a string', () => {
    const out = pickGeneralFields({
      owedCapital: 15000000,
      gracePeriodMonths: 6, // este sí es numérico de verdad: no se convierte
    });

    expect(out.owedCapital).toBe('15000000');
    expect(out.gracePeriodMonths).toBe(6);
  });

  it('source vacío no explota: devuelve {}', () => {
    expect(pickGeneralFields(null)).toEqual({});
    expect(pickGeneralFields(undefined)).toEqual({});
  });

  it('pickGeneralValues no normaliza: lo que el formulario tenga es lo que se manda', () => {
    const out = pickGeneralValues({
      notificationCity: 'Cali',
      cesacionPagos: false,
      apoderadoNombreCompleto: undefined, // campo no tocado por el usuario
    });

    expect(out.notificationCity).toBe('Cali');
    expect(out.cesacionPagos).toBe(false);
    expect(out.apoderadoNombreCompleto).toBeUndefined();
  });

  it('reproduce el hallazgo original: los 6 campos conocidos están en GENERAL_SCALAR_FIELDS', () => {
    const conocidos = [
      'notificationCity',
      'otherCauseDetail',
      'conyugeNombreCompleto',
      'cesacionPagos',
      'declaracionVeracidadInformacion',
      'apoderadoNombreCompleto',
    ];
    for (const campo of conocidos) {
      expect(GENERAL_SCALAR_FIELDS).toContain(campo);
    }
  });
});
