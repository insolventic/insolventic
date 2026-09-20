/**
 * Guardián de código fuente: recharts no entra a la carga inicial de /dashboard.
 *
 * Medido con las estadísticas de webpack del build: `recharts` era el 95 % del
 * JS exclusivo de /dashboard (126,8 de 133,7 kB gzip) y se descargaba siempre.
 * `page.tsx` importaba `DashboardCharts` de forma estática; ahora monta
 * `DashboardChartsLazy` (next/dynamic). Este test evita que alguien "arregle" el
 * import y devuelva ~127 kB a la carga inicial sin que ningún otro test lo note.
 * El comportamiento del wrapper está en dashboard-charts-lazy.test.tsx.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

describe('guardián: recharts no entra a la carga inicial de /dashboard', () => {
  it('page.tsx no importa DashboardCharts ni recharts de forma estática', () => {
    const page = read('app/dashboard/page.tsx');

    // El bug: `import { DashboardCharts } from './components/dashboard-charts'`.
    expect(page).not.toMatch(/from\s+['"][^'"]*dashboard-charts['"]/);
    expect(page).not.toMatch(/from\s+['"]recharts['"]/);
    // Monta la versión diferida.
    expect(page).toMatch(/DashboardChartsLazy/);
  });

  it('solo dashboard-charts.tsx importa recharts', () => {
    const importers = sourceFiles(SRC)
      .filter((file) =>
        /from\s+['"]recharts['"]/.test(fs.readFileSync(file, 'utf8')),
      )
      .map((file) => path.relative(SRC, file).replace(/\\/g, '/'));

    expect(importers).toEqual([
      'app/dashboard/components/dashboard-charts.tsx',
    ]);
  });

  it('nadie importa dashboard-charts de forma estática salvo su propio test/stub', () => {
    const staticImporters = sourceFiles(SRC)
      .filter((file) => !file.endsWith('dashboard-charts.tsx'))
      .filter((file) =>
        /from\s+['"][^'"]*\/dashboard-charts['"]/.test(
          fs.readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => path.relative(SRC, file).replace(/\\/g, '/'));

    // La única referencia legítima es el import() dinámico del wrapper, que no
    // usa la sintaxis `from '...'`.
    expect(staticImporters).toEqual([]);
  });
});
