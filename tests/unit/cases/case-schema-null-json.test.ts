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
 *
 * SON 7, NO 6. `a54d92e` arregló solo los 6 con prefijo `conc*` y dejó fuera
 * `apoyoClausulas` (bloque ACUERDO DE APOYO), así que tras aquel despliegue el
 * síntoma persistió idéntico. La lección: el fixture parte ahora de la fila
 * completa que devuelve Prisma —derivada de CAMPOS_JSON_NULLABLE— y no de los
 * campos que se tocaron, que fue justo el error que dejó pasar el 7º.
 */

import {
  caseSchema,
  getAllCasesSchema,
  caseSummarySchema,
} from '@/features/case/schemas';
import { CASE_DATA, DEBTOR, ADMIN_USER } from '../../helpers/fixtures';

/**
 * Los 7 campos `Json?` de `caseSchema`, con su columna real en Postgres.
 *
 * Son TODOS los que el escaneo Prisma↔Zod encontró: se comparan los 216 campos
 * nullable del modelo `Case` contra las 270 declaraciones de `caseSchema`, y
 * estos son los únicos de tipo array. Si se añade otro `Json?` al modelo, debe
 * entrar aquí Y llevar `.nullable()`.
 */
const CAMPOS_JSON_NULLABLE = [
  ['concMenoresAlimentos', 'conc_menores_alimentos'],
  ['concMenoresUnion', 'conc_menores_union'],
  ['concClausulasAdicionalesAlimentos', 'conc_clausulas_adicionales_alimentos'],
  ['concClausulasAdicionalesUnion', 'conc_clausulas_adicionales_union'],
  [
    'concClausulasAdicionalesDisolucion',
    'conc_clausulas_adicionales_disolucion',
  ],
  ['concClausulasAcuerdo', 'conc_clausulas_acuerdo'],
  // 7º campo — bloque ACUERDO DE APOYO. a54d92e lo dejó fuera y por eso el
  // síntoma persistió idéntico tras aquel deploy.
  ['apoyoClausulas', 'apoyo_clausulas'],
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
    // Los 7 se derivan de CAMPOS_JSON_NULLABLE en vez de listarse a mano: así
    // la fila la define el DATO (lo que Prisma devuelve), no el fix. Añadir un
    // campo a la lista lo mete automáticamente en todos los casos de prueba.
    ...Object.fromEntries(CAMPOS_JSON_NULLABLE.map(([c]) => [c, null])),
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

describe('caseSchema — los 7 campos Json? en NULL (regresión de /cases)', () => {
  it('parsea un caso de insolvencia con los 7 campos Json? en null', () => {
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

  it.each(CAMPOS_JSON_NULLABLE)('acepta null en %s (columna %s)', (campo) => {
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma({ [campo]: null });
    expect(caseSchema.safeParse(fila).success).toBe(true);
  });

  it('sigue aceptando undefined (campo ausente del objeto)', () => {
    const fila = casoDeInsolvenciaComoLoDevuelvePrisma();
    for (const [campo] of CAMPOS_JSON_NULLABLE) {
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
