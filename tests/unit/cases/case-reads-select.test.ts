/**
 * Guardián de código fuente: las lecturas de `Case` piden columnas explícitas.
 *
 * `Case` tiene 269 columnas. Una lectura sin `select` trae todas (y, si además
 * se valida con `caseSchema`, una columna ausente o un `null` inesperado en
 * cualquiera de ellas la rompe: así se cayó /cases con las columnas `apoyo_*`).
 *
 * Fase 0 del plan de revisión del modelo Case: las lecturas que solo comprueban
 * existencia o usan el `id` pasaron a `select`; el listado lee solo
 * `CASE_LIST_COLUMNS`. Las 3 lecturas de abajo SIGUEN trayendo la fila entera a
 * propósito, porque necesitan casi todas las columnas:
 *
 *  - generación de documentos (fetchCaseForGeneration, batchGenerateDocuments):
 *    el mapper de placeholders referencia 234 de las 269 columnas; un `select`
 *    de 234 nombres se desincroniza en silencio cuando el mapper lee un campo
 *    nuevo y el documento legal saldría con ese campo en blanco.
 *  - getCaseById: alimenta el detalle y la edición, que juntos referencian 146
 *    columnas (54 %) y se validan con caseWithRelationsSchema.
 *
 * `updateCasePhase` (PR #40) ya NO está en esta lista: solo lee
 * `{ id, phase, caseNumber, debtorName }` para validar la transición y
 * armar el audit log/notificación. Cuando una fase necesita generar
 * documentos, delega la fila completa en `fetchCaseForGeneration` (arriba),
 * que ya trae la excepción justificada.
 *
 * Una lectura nueva sin `select` hace fallar este test: o se acota, o se agrega
 * aquí con su justificación.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.join(process.cwd(), 'src');

const READS = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'findUniqueOrThrow',
  'findFirstOrThrow',
]);

const WHOLE_ROW_ALLOWED = [
  'src/features/case/actions.ts::getCaseById',
  'src/features/document/actions.ts::batchGenerateDocuments',
  'src/features/document/persistence.ts::fetchCaseForGeneration',
];

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

function enclosingFunctionName(node: ts.Node): string {
  let fn: ts.Node | undefined = node.parent;
  while (fn) {
    if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) {
      return fn.name ? fn.name.getText() : '(anónima)';
    }
    if (
      (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) &&
      ts.isVariableDeclaration(fn.parent)
    ) {
      return fn.parent.name.getText();
    }
    fn = fn.parent;
  }
  return '(nivel superior)';
}

interface CaseRead {
  where: string;
  op: string;
  hasSelect: boolean;
}

function findCaseReads(): CaseRead[] {
  const reads: CaseRead[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('.case.')) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const rel = path.relative(process.cwd(), file).split(path.sep).join('/');

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        READS.has(node.expression.name.text)
      ) {
        const target = node.expression.expression;
        if (
          ts.isPropertyAccessExpression(target) &&
          target.name.text === 'case'
        ) {
          const arg = node.arguments[0];
          const keys =
            arg && ts.isObjectLiteralExpression(arg)
              ? arg.properties.map((p) => p.name?.getText())
              : [];
          reads.push({
            where: `${rel}::${enclosingFunctionName(node)}`,
            op: node.expression.name.text,
            // `select` de NIVEL SUPERIOR: uno anidado dentro de `include` no cuenta.
            hasSelect: keys.includes('select'),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return reads;
}

describe('guardián: las lecturas de Case piden columnas explícitas (select)', () => {
  const reads = findCaseReads();

  it('encuentra las lecturas de Case (el escáner no está vacío)', () => {
    // 38 al escribir este test; si baja mucho, el escáner dejó de ver algo.
    expect(reads.length).toBeGreaterThan(30);
    expect(reads.filter((r) => r.hasSelect).length).toBeGreaterThan(25);
  });

  it('solo las 3 lecturas justificadas traen la fila entera', () => {
    const whole = reads
      .filter((r) => !r.hasSelect)
      .map((r) => r.where)
      .sort();

    expect(whole).toEqual([...WHOLE_ROW_ALLOWED].sort());
  });

  it('el listado (getAllCases) usa select, no include', () => {
    const src = fs.readFileSync(
      path.join(SRC, 'features/case/actions.ts'),
      'utf8',
    );
    const start = src.indexOf('export async function getAllCases');
    const end = src.indexOf('export async function getCaseById');
    const body = src.slice(start, end);

    expect(body).toMatch(/\.\.\.CASE_LIST_COLUMNS/);
    expect(body).not.toMatch(/include:\s*\{/);
  });
});
