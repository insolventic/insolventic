/**
 * Quien puede programar audiencias tiene que poder abrir el calendario. La
 * regla vive en una sola función, y la usan el middleware, la página, el
 * dashboard y `getHearings`; estos tests fijan que no se separen.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  MODULES,
  P,
  canEnterModule,
  getVisibleModules,
  puedeVerCalendario,
} from '@/lib/permissions';

const fuente = (ruta: string) =>
  readFileSync(path.join(process.cwd(), ruta), 'utf-8');

describe('puedeVerCalendario', () => {
  it.each([
    ['Ver calendario', [P.VER_CALENDARIO], true],
    ['Editar casos', [P.EDITAR_CASOS], true],
    ['los dos', [P.VER_CALENDARIO, P.EDITAR_CASOS], true],
    ['Ver casos, sin más', [P.VER_CASOS], false],
    ['nada', [], false],
  ])('con %s: %s', (_nombre, permisos, esperado) => {
    expect(puedeVerCalendario(permisos as string[])).toBe(esperado);
  });
});

describe('canEnterModule', () => {
  it('el resto de los módulos sigue pidiendo solo su permiso', () => {
    expect(canEnterModule(MODULES.reports, [P.EDITAR_CASOS])).toBe(false);
    expect(canEnterModule(MODULES.reports, [P.VER_REPORTES])).toBe(true);
  });

  it('getVisibleModules muestra el calendario a quien edita casos', () => {
    const claves = getVisibleModules([P.EDITAR_CASOS]).map((m) => m.key);
    expect(claves).toContain('calendar');
  });
});

describe('las cuatro puertas usan la misma regla', () => {
  it('el servidor', () => {
    const acciones = fuente('src/features/calendar/actions.ts');
    expect(acciones).toContain('puedeVerCalendario(user.permissions)');
    expect(acciones).not.toContain('P.VER_CALENDARIO');
  });

  it('el middleware', () => {
    expect(fuente('src/middleware.ts')).toContain('canEnterModule(');
  });

  it('la página', () => {
    const pagina = fuente('src/app/calendar/page.tsx');
    expect(pagina).toContain('MODULES.calendar');
    expect(pagina).not.toContain('permission="Ver calendario"');
  });

  it('el dashboard', () => {
    const dashboard = fuente('src/app/dashboard/components/task-selector.tsx');
    expect(dashboard).not.toContain('permission: P.VER_CALENDARIO');
  });
});
