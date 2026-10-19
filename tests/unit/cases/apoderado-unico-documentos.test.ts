/**
 * Apoderado único — documentos exigidos (src/features/case/validation-rules.ts).
 *
 * Decisión del inventario A: con la Sección XI como única fuente de carga, un
 * apoderado puede estar identificado (nombre, cédula, tarjeta) sin que el
 * PODER ya esté otorgado — son dos hechos distintos. `getRequiredDocuments`
 * exige "cedula_apoderado"/"tarjeta_profesional_apoderado" con solo tener un
 * apoderado nombrado, pero exige "poder" únicamente cuando alguno de los
 * apoderados declarados tiene `existePoderOtorgado === true`.
 */

import {
  caseHasAttorney,
  casePoderOtorgado,
  getRequiredDocuments,
} from '@/features/case/validation-rules';
import type { CreateCaseFormInput } from '@/features/case/schemas';

const baseCase: Partial<CreateCaseFormInput> = {
  type: 'INSOLVENCY',
  applicantScope: [],
  assets: [],
};

describe('caseHasAttorney / casePoderOtorgado', () => {
  it('sin apoderados ni attorney: ninguno de los dos', () => {
    expect(caseHasAttorney(baseCase)).toBe(false);
    expect(casePoderOtorgado(baseCase)).toBe(false);
  });

  it('apoderado nombrado SIN poder otorgado: hay apoderado, no hay poder', () => {
    const data = {
      ...baseCase,
      apoderados: [
        { nombreCompleto: 'Dra. Pérez', existePoderOtorgado: false },
      ],
    };
    expect(caseHasAttorney(data)).toBe(true);
    expect(casePoderOtorgado(data)).toBe(false);
  });

  it('apoderado nombrado CON poder otorgado: hay apoderado y hay poder', () => {
    const data = {
      ...baseCase,
      apoderados: [{ nombreCompleto: 'Dra. Pérez', existePoderOtorgado: true }],
    };
    expect(caseHasAttorney(data)).toBe(true);
    expect(casePoderOtorgado(data)).toBe(true);
  });

  it('con 2+ apoderados, el poder de CUALQUIERA basta', () => {
    const data = {
      ...baseCase,
      apoderados: [
        { nombreCompleto: 'Sin poder', existePoderOtorgado: false },
        { nombreCompleto: 'Con poder', existePoderOtorgado: true },
      ],
    };
    expect(casePoderOtorgado(data)).toBe(true);
  });

  it('espejo legado (apoderadoNombreCompleto + existePoderOtorgado de nivel caso): también cuenta', () => {
    const data = {
      ...baseCase,
      apoderadoNombreCompleto: 'Dr. Legado',
      existePoderOtorgado: true,
    };
    expect(caseHasAttorney(data)).toBe(true);
    expect(casePoderOtorgado(data)).toBe(true);
  });

  it('attorney de texto libre: cuenta para caseHasAttorney, nunca para el poder', () => {
    const data = { ...baseCase, attorney: 'Dr. Texto Libre' };
    expect(caseHasAttorney(data)).toBe(true);
    expect(casePoderOtorgado(data)).toBe(false);
  });
});

describe('getRequiredDocuments — el documento "poder"', () => {
  it('sin apoderado: ni cédula/tarjeta del apoderado ni poder son obligatorios', () => {
    const required = getRequiredDocuments(baseCase);
    expect(required).not.toContain('poder');
    expect(required).not.toContain('cedula_apoderado');
    expect(required).not.toContain('tarjeta_profesional_apoderado');
  });

  it('apoderado nombrado sin poder otorgado: exige cédula y tarjeta, NO el poder', () => {
    const required = getRequiredDocuments({
      ...baseCase,
      apoderados: [
        { nombreCompleto: 'Dra. Pérez', existePoderOtorgado: false },
      ],
    });
    expect(required).toContain('cedula_apoderado');
    expect(required).toContain('tarjeta_profesional_apoderado');
    expect(required).not.toContain('poder');
  });

  it('apoderado con poder otorgado: exige los tres', () => {
    const required = getRequiredDocuments({
      ...baseCase,
      apoderados: [{ nombreCompleto: 'Dra. Pérez', existePoderOtorgado: true }],
    });
    expect(required).toContain('cedula_apoderado');
    expect(required).toContain('tarjeta_profesional_apoderado');
    expect(required).toContain('poder');
  });

  it('REGRESIÓN: desmarcar "poder otorgado" quita el poder de los obligatorios sin tocar los demás', () => {
    const conPoder = getRequiredDocuments({
      ...baseCase,
      apoderados: [{ nombreCompleto: 'Dra. Pérez', existePoderOtorgado: true }],
    });
    const sinPoder = getRequiredDocuments({
      ...baseCase,
      apoderados: [
        { nombreCompleto: 'Dra. Pérez', existePoderOtorgado: false },
      ],
    });

    expect(conPoder).toContain('poder');
    expect(sinPoder).not.toContain('poder');
    expect(sinPoder).toContain('cedula_apoderado');
    expect(sinPoder).toContain('tarjeta_profesional_apoderado');
  });
});
