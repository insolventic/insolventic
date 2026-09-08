/**
 * Regresión: `/cases` mostraba la lista vacía en producción.
 *
 * Las 6 columnas de arrays de conciliación son `Json?` en Prisma, que devuelve
 * `null` (no `undefined`) cuando están vacías. `caseSchema` las declaraba solo
 * `.optional()`, que acepta `undefined` y RECHAZA `null`.
 *
 * Como `getAllCasesSchema` es `z.array(caseSchema)`, bastaba un caso con esos
 * campos en NULL para invalidar el parse del array completo → `getAllCases`
 * devolvía `success: false` → `page.tsx` lo enmascaraba con `data || []` → la
 * tabla salía vacía sin ningún mensaje de error.
 *
 * Y ese NULL es el estado NORMAL, no un dato corrupto: `sanitizeJsonFields`
 * (case/actions.ts) borra esos campos del payload a propósito para todo caso
 * que no sea de conciliación. Verificado en producción: 28/28 casos de los dos
 * tenants (18 constructores-paz, 10 armonia) tienen al menos uno en NULL.
 */

import {
  caseSchema,
  getAllCasesSchema,
  caseSummarySchema,
} from '@/features/case/schemas';
import { CASE_DATA, DEBTOR, ADMIN_USER } from '../../helpers/fixtures';

/** Los 6 campos afectados, con su columna real en Postgres. */
const CAMPOS_JSON_CONCILIACION = [
  ['concMenoresAlimentos', 'conc_menores_alimentos'],
  ['concMenoresUnion', 'conc_menores_union'],
  ['concClausulasAdicionalesAlimentos', 'conc_clausulas_adicionales_alimentos'],
  ['concClausulasAdicionalesUnion', 'conc_clausulas_adicionales_union'],
  [
    'concClausulasAdicionalesDisolucion',
    'conc_clausulas_adicionales_disolucion',
  ],
  ['concClausulasAcuerdo', 'conc_clausulas_acuerdo'],
] as const;

/**
 * Fila tal como la devuelve `prisma.case.findMany({ include: {...} })` para un
 * caso de INSOLVENCIA real: los 6 campos de conciliación en `null`.
 *
 * Se apoya en los fixtures compartidos para los ~280 campos restantes; lo que
 * este test ejerce son los 6 nulls, no la forma completa del caso.
 */
function casoDeInsolvenciaComoLoDevuelvePrisma(
  overrides: Record<string, unknown> = {},
) {
  return {
    ...CASE_DATA,
    type: 'INSOLVENCY',
    // Así llega de Prisma cuando la columna Json? está en NULL.
    concMenoresAlimentos: null,
    concMenoresUnion: null,
    concClausulasAdicionalesAlimentos: null,
    concClausulasAdicionalesUnion: null,
    concClausulasAdicionalesDisolucion: null,
    concClausulasAcuerdo: null,
    // Relaciones que `caseSchema` exige (vienen del `include`).
    debtor: DEBTOR,
    operator: {
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
    },
    _count: { documents: 0 },
    ...overrides,
  };
}

describe('caseSchema — columnas Json? en NULL (regresión de /cases)', () => {
  it('parsea un caso de insolvencia con los 6 campos en null', () => {
    const result = caseSchema.safeParse(
      casoDeInsolvenciaComoLoDevuelvePrisma(),
    );

    if (!result.success) {
      throw new Error(
        `No parseó. Campos rechazados: ${result.error.issues
          .map((i) => i.path.join('.'))
          .join(', ')}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it.each(CAMPOS_JSON_CONCILIACION)(
    'acepta null en %s (columna %s)',
    (campo) => {
      const fila = casoDeInsolvenciaComoLoDevuelvePrisma({ [campo]: null });
      expect(caseSchema.safeParse(fila).success).toBe(true);
    },
  );

  it('sigue aceptando undefined (campo ausente del objeto)', () => {
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma();
    for (const [campo] of CAMPOS_JSON_CONCILIACION) {
      delete (fila as Record<string, unknown>)[campo];
    }
    expect(caseSchema.safeParse(fila).success).toBe(true);
  });

  it('sigue aceptando arrays poblados (caso de conciliación real)', () => {
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma({
      type: 'CONCILIATION',
      concMenoresAlimentos: [{ NOMBRE_MENOR: 'Ana Pérez' }],
    });
    const result = caseSchema.safeParse(fila);
    expect(result.success).toBe(true);
  });

  it('sigue RECHAZANDO un array con elementos inválidos', () => {
    // El fix afloja null, no la validación del contenido.
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma({
      concMenoresAlimentos: [{ NOMBRE_MENOR: '' }], // min(1) en el sub-schema
    });
    expect(caseSchema.safeParse(fila).success).toBe(false);
  });
});

describe('getAllCasesSchema — el parse del array completo', () => {
  it('REGRESIÓN: un solo caso de insolvencia ya no invalida toda la lista', () => {
    // Esta es exactamente la forma del fallo en producción: la lista mezcla
    // casos, y el de insolvencia (con NULLs) tumbaba el array entero.
    const lista = [
      casoDeInsolvenciaComoLoDevuelvePrisma({ id: 'c1' }),
      casoDeInsolvenciaComoLoDevuelvePrisma({
        id: 'c2',
        type: 'CONCILIATION',
        concMenoresAlimentos: [{ NOMBRE_MENOR: 'Ana Pérez' }],
      }),
      casoDeInsolvenciaComoLoDevuelvePrisma({ id: 'c3' }),
    ];

    const result = getAllCasesSchema.safeParse(lista);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toHaveLength(3);
  });

  it('28 casos con NULLs parsean (la carga real de los dos tenants)', () => {
    const lista = Array.from({ length: 28 }, (_, i) =>
      casoDeInsolvenciaComoLoDevuelvePrisma({ id: `c${i}` }),
    );
    expect(getAllCasesSchema.safeParse(lista).success).toBe(true);
  });
});

describe('schemas derivados de caseSchema', () => {
  it('caseSummarySchema hereda el fix', () => {
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma();
    expect(caseSummarySchema.safeParse(fila).success).toBe(true);
  });
});
