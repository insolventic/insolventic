/**
 * `CASE_GENERATION_INCLUDE` (src/features/document/persistence.ts) tiene que
 * ser la ÚNICA definición del `include` de Prisma para la generación de
 * documentos.
 *
 * `batchGenerateDocuments` (document/actions.ts) tenía su propia copia de
 * este mismo `include`, en vez de usar `fetchCaseForGeneration` como ya
 * hacían `actions-generation.ts` y `case/actions.ts`. Dos problemas reales,
 * no solo duplicación:
 *
 *  - Le faltaba `professionalCard` en el `select` de `operator` — el mismo
 *    hallazgo A6 (`conciliadora-firma.test.ts`) que ya estaba arreglado en
 *    `CASE_GENERATION_INCLUDE`, pero esta copia paralela no lo había
 *    heredado: `TP_CONCILIADORA` salía vacío en los documentos de
 *    conciliación generados por esta ruta específica (manual, `/documents`),
 *    aunque la ruta automática ya lo tenía bien.
 *  - Traía `creditor: true` completo en vez del `select` acotado — no rompía
 *    nada porque el mapper solo lee `creditor.name`, pero es más superficie
 *    de la necesaria.
 *  - Tenía además los 3 campos del Formulario Definitivo muerto
 *    (`acreedores`/`bienes`/`procesosJudiciales`), que mi primer barrido de
 *    ese borrado no encontró porque buscaba `caseData\.acreedores`, no
 *    `include: { acreedores: true }` — lo encontró recién CI, al compilar
 *    con el schema real.
 *
 * Que exista una segunda copia es exactamente lo que permitió que estas tres
 * cosas se desalinearan sin que nadie lo notara. Este test fija que no vuelva
 * a pasar.
 */

import fs from 'fs';
import path from 'path';

const DOCUMENT_DIR = path.join(process.cwd(), 'src/features/document');
const PERSISTENCE_FILE = path.join(DOCUMENT_DIR, 'persistence.ts');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(entry.name) && !entry.name.endsWith('.test.ts')
      ? [full]
      : [];
  });

/**
 * Las claves que, juntas, identifican el `include` de generación: ninguna
 * sola es sospechosa (`dependents`, `libranzas`, etc. aparecen sueltas en
 * otros lados del proyecto), pero las 4 juntas en un mismo archivo solo
 * tienen sentido si alguien volvió a escribir esta misma lista a mano.
 */
const FINGERPRINT = [
  /suspendedServices\s*:/,
  /legalProcesses\s*:/,
  /apoderados\s*:/,
  /dependents\s*:/,
];

describe('include de generación de documentos: una sola fuente', () => {
  it('CASE_GENERATION_INCLUDE existe y declara las relaciones esperadas', () => {
    const {
      CASE_GENERATION_INCLUDE,
    } = require('@/features/document/persistence');

    expect(Object.keys(CASE_GENERATION_INCLUDE).sort()).toEqual(
      [
        '_count',
        'apoderados',
        'assets',
        'debtor',
        'debts',
        'dependents',
        'documents',
        'legalProcesses',
        'libranzas',
        'operator',
        'suspendedServices',
        // `tenant` trae SOLO el slug, que es la clave de los mapas por centro
        // (branding, membrete). Sin él los mapas reciben el `Tenant.id` —un
        // cuid— y caen siempre al valor por defecto. Ver
        // `src/features/document/placeholders/tenant-slug.ts`.
        'tenant',
      ].sort(),
    );
  });

  it('ningún otro archivo de src/features/document reescribe esta misma lista de relaciones', () => {
    const offenders = sourceFiles(DOCUMENT_DIR)
      .filter((file) => file !== PERSISTENCE_FILE)
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8');
        return FINGERPRINT.every((pattern) => pattern.test(text));
      })
      .map((file) => path.relative(process.cwd(), file).replace(/\\/g, '/'));

    // Si esto falla, el archivo listado volvió a declarar su propio
    // `include` en vez de usar `fetchCaseForGeneration`/`CASE_GENERATION_INCLUDE`.
    expect(offenders).toEqual([]);
  });

  it('batchGenerateDocuments (document/actions.ts) usa fetchCaseForGeneration, no su propio include', () => {
    const source = fs.readFileSync(
      path.join(DOCUMENT_DIR, 'actions.ts'),
      'utf8',
    );

    expect(source).toMatch(
      /import\s*\{[^}]*fetchCaseForGeneration[^}]*\}\s*from\s*['"]\.\/persistence['"]/,
    );
    expect(source).toContain('fetchCaseForGeneration(caseId, tenantId)');
  });
});
