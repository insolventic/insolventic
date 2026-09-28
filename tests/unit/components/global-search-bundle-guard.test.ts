/**
 * Guardián de código fuente: `cmdk` no entra al JS inicial de las pantallas
 * que muestran el header.
 *
 * `GlobalSearch` está en el header (`DashboardHeader`) que renderizan casi todas
 * las rutas. Importaba de forma estática `@/components/ui/command` (→ `cmdk`),
 * de modo que esa librería viajaba en el bundle compartido de todas ellas. Ahora
 * el shell (`global-search.tsx`) solo carga el diálogo con `import()` dinámico.
 * Este test evita que un import "inocente" lo vuelva a meter en el camino
 * inicial sin que ningún otro test lo note. El comportamiento del shell está en
 * global-search-lazy.test.tsx.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const norm = (p: string) => p.replace(/\\/g, '/');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

const importersOf = (pattern: RegExp) =>
  sourceFiles(SRC)
    .filter((file) => pattern.test(fs.readFileSync(file, 'utf8')))
    .map((file) => norm(path.relative(SRC, file)))
    .sort();

describe('guardián: cmdk no entra al JS inicial vía el header', () => {
  it('global-search.tsx (el shell) no importa cmdk, ui/command ni el diálogo de forma estática', () => {
    const shell = read('components/global-search.tsx');

    expect(shell).not.toMatch(/from\s+['"]cmdk['"]/);
    expect(shell).not.toMatch(/from\s+['"][^'"]*ui\/command['"]/);
    expect(shell).not.toMatch(/from\s+['"][^'"]*global-search-dialog['"]/);
    // Sí lo carga, pero con import() dinámico.
    expect(shell).toMatch(/import\(\s*['"]\.\/global-search-dialog['"]\s*\)/);
    expect(shell).toMatch(/from\s+['"]next\/dynamic['"]/);
  });

  it('solo el diálogo y la pantalla de documentos importan ui/command de forma estática', () => {
    expect(importersOf(/from\s+['"][^'"]*ui\/command['"]/)).toEqual([
      'app/documents/components/document-generation.tsx',
      'components/global-search-dialog.tsx',
    ]);
  });

  it('nadie importa el diálogo de forma estática (solo el import() del shell)', () => {
    expect(importersOf(/from\s+['"][^'"]*global-search-dialog['"]/)).toEqual(
      [],
    );
  });

  it('el header importa GlobalSearch (el shell), no el diálogo', () => {
    const header = read('app/dashboard/components/dashboard-header-client.tsx');

    expect(header).toMatch(/from\s+['"]@\/components\/global-search['"]/);
    expect(header).not.toMatch(/global-search-dialog/);
  });
});
