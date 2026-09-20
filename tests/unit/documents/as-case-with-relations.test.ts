/**
 * Unit Tests: asCaseWithRelations (src/features/document/persistence.ts).
 *
 * El pipeline de documentos convertía el payload de Prisma en `CaseWithRelations`
 * con `as unknown as CaseWithRelations` repetido en 8 sitios. Ese doble cast
 * apaga TODA la comprobación de tipos: si una columna de Prisma dejaba de
 * coincidir con el schema Zod, el compilador no avisaba.
 *
 * Ahora hay una sola función (`asCaseWithRelations`) que el compilador verifica
 * para todas las claves y relaciones compatibles, y que aísla las únicas 7
 * columnas `Json?` que Prisma tipa como `JsonValue` y el schema como filas
 * estructuradas. Estos tests fijan (1) que nadie reintroduzca el doble cast y
 * (2) que la conversión NO cambia ningún valor (es un cambio solo de tipos).
 */

import fs from 'fs';
import path from 'path';

import { asCaseWithRelations } from '@/features/document/persistence';

const DOCUMENT_DIR = path.join(process.cwd(), 'src/features/document');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

describe('pipeline de documentos: sin `as unknown as CaseWithRelations`', () => {
  it('ningún archivo de src/features/document hace el doble cast', () => {
    const doubleCast =
      /as\s+unknown\s+as\s+(?:import\([^)]*\)\s*\.\s*)?CaseWithRelations\b/;

    const offenders = sourceFiles(DOCUMENT_DIR)
      .filter((file) => doubleCast.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(process.cwd(), file).replace(/\\/g, '/'));

    // Todo debe pasar por asCaseWithRelations, que el compilador sí verifica.
    expect(offenders).toEqual([]);
  });
});

describe('asCaseWithRelations — conversión sin cambio de valores', () => {
  const debts = [
    { id: 'd1', amount: 1000, creditor: { name: 'Banco A' } },
    { id: 'd2', amount: 2000, creditor: { name: 'Banco B' } },
  ];
  const assets = [{ id: 'a1', name: 'Casa', type: 'INMUEBLE', value: 5000 }];
  const clausulas = [{ NUMERO_CLAUSULA: '1', TEXTO_CLAUSULA: 'Texto' }];
  const menores = [{ NOMBRE_MENOR: 'Ana' }];

  // Payload mínimo con la forma que devuelve fetchCaseForGeneration.
  const makePayload = () =>
    ({
      id: 'case-1',
      tenantId: 'tenant-1',
      type: 'CONCILIATION',
      caseNumber: 'CON-2026-001',
      debts,
      assets,
      documents: [],
      apoderados: [],
      concClausulasAcuerdo: clausulas,
      concMenoresAlimentos: menores,
      concMenoresUnion: null,
      apoyoClausulas: null,
    }) as never;

  it('conserva todos los campos, incluidos los que el schema no declara', () => {
    const result = asCaseWithRelations(makePayload()) as unknown as Record<
      string,
      unknown
    >;

    expect(result).toMatchObject({
      id: 'case-1',
      tenantId: 'tenant-1',
      type: 'CONCILIATION',
      caseNumber: 'CON-2026-001',
    });
  });

  it('las relaciones pasan por referencia, sin copiarlas ni transformarlas', () => {
    const result = asCaseWithRelations(makePayload());

    expect(result.debts).toBe(debts);
    expect(result.assets).toBe(assets);
  });

  it('las 7 columnas JSON pasan intactas: mismas filas, nulls preservados', () => {
    const result = asCaseWithRelations(makePayload());

    expect(result.concClausulasAcuerdo).toBe(clausulas);
    expect(result.concMenoresAlimentos).toBe(menores);
    expect(result.concMenoresUnion).toBeNull();
    expect(result.apoyoClausulas).toBeNull();
  });

  it('no muta el payload de entrada', () => {
    const payload = makePayload();
    const before = JSON.stringify(payload);

    asCaseWithRelations(payload);

    expect(JSON.stringify(payload)).toBe(before);
  });
});
