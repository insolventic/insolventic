/**
 * Guardián: ninguna relación hacia `User` se lee con `campo: true`.
 *
 * `User` tiene `password` (hash bcrypt). Un `include`/`select` que trae la
 * relación completa con `true` en vez de un `select` acotado carga ese hash a
 * memoria aunque nadie lo use después — así estaba `operator: true` en
 * `batchGenerateDocuments` (features/document/actions.ts), que solo necesita
 * `name`/`email` para el documento.
 *
 * Los nombres de relación se derivan del propio schema.prisma (no están
 * hardcodeados): cualquier campo nuevo de tipo `User`/`User?` que alguien
 * agregue a otro modelo queda cubierto sin tocar este test.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.join(process.cwd(), 'src');
const SCHEMA = path.join(process.cwd(), 'src', 'prisma', 'schema.prisma');

function userRelationFieldNames(): string[] {
  const schema = fs.readFileSync(SCHEMA, 'utf8');
  const names = new Set<string>();
  for (const line of schema.split('\n')) {
    const m = line.match(/^\s*(\w+)\s+User(\?)?\s/);
    // Excluye la propia declaración `model User {`.
    if (m && m[1] !== 'model') names.add(m[1]);
  }
  return [...names];
}

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

interface Offense {
  where: string;
  field: string;
}

// Zod `.omit({ operator: true })` / `.pick({ operator: true })` seleccionan
// claves de un SCHEMA, no columnas de una query de Prisma — mismo shape
// sintáctico (`campo: true`), otro significado. Se excluyen buscando el
// CallExpression más cercano.
function isZodOmitOrPick(node: ts.Node): boolean {
  let n: ts.Node | undefined = node.parent;
  while (n) {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      (n.expression.name.text === 'omit' || n.expression.name.text === 'pick')
    ) {
      return true;
    }
    if (ts.isCallExpression(n)) return false; // otro call antes: no es esto
    n = n.parent;
  }
  return false;
}

function findOffenses(fieldNames: string[]): Offense[] {
  const offenses: Offense[] = [];
  const fields = new Set(fieldNames);

  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    if (!fieldNames.some((f) => text.includes(f))) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const rel = path.relative(process.cwd(), file).split(path.sep).join('/');

    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name &&
        ts.isIdentifier(node.name) &&
        fields.has(node.name.text) &&
        node.initializer.kind === ts.SyntaxKind.TrueKeyword &&
        !isZodOmitOrPick(node)
      ) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        offenses.push({ where: `${rel}:${line + 1}`, field: node.name.text });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return offenses;
}

describe('guardián: las relaciones hacia User nunca se leen con `campo: true`', () => {
  const fieldNames = userRelationFieldNames();

  it('encuentra al menos las relaciones conocidas (operator, user, registeredBy)', () => {
    expect(fieldNames).toEqual(
      expect.arrayContaining(['operator', 'user', 'registeredBy']),
    );
  });

  it('ninguna lectura trae la relación completa (sin select)', () => {
    const offenses = findOffenses(fieldNames);
    expect(offenses).toEqual([]);
  });
});
