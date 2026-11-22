/**
 * Las plantillas viajan en el bundle serverless.
 *
 * Las plantillas se leen del disco con rutas armadas en runtime
 * (`path.join(process.cwd(), getTemplatePath(t))`), que @vercel/nft no puede
 * seguir. Sin `outputFileTracingIncludes`, `templates/` no entraba en ninguna
 * función de Vercel y cada generación fallaba con ENOENT en producción,
 * mientras en local (y en `template-files-exist.test.ts`, que lee del repo)
 * todo pasaba.
 *
 * Este test fija la config con la misma lógica de matching que usa Next en
 * `collect-build-traces.js`: picomatch con `{ dot: true, contains: true }`
 * sobre la ruta normalizada, y glob relativo a la raíz del proyecto. No
 * reemplaza mirar los `.nft.json` de un build real, pero impide que la
 * inclusión se pierda o se acote a una ruta sin que nada avise.
 */

import fs from 'fs';
import path from 'path';

import nextConfig from '../../../next.config';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

const picomatch: (
  glob: string | string[],
  opts?: Record<string, unknown>,
) => (s: string) => boolean = require('next/dist/compiled/picomatch');

const RAIZ = path.resolve(__dirname, '../../..');

/** Globs de archivos que Next agregaría a la traza de `route`. */
function incluidosPara(route: string): string[] {
  const includes = nextConfig.outputFileTracingIncludes ?? {};
  return Object.entries(includes)
    .filter(([clave]) => picomatch(clave, { dot: true, contains: true })(route))
    .flatMap(([, globs]) => globs.map((g) => g.replace(/\\/g, '/')));
}

/** ¿Algún glob de `route` cubre el archivo (relativo a la raíz)? */
function cubre(route: string, archivo: string): boolean {
  const globs = incluidosPara(route).map((g) => g.replace(/^\.\//, ''));
  return globs.length > 0 && picomatch(globs, { dot: true })(archivo);
}

function archivosDe(dir: string): string[] {
  return fs
    .readdirSync(path.join(RAIZ, dir), { withFileTypes: true })
    .flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      return e.isDirectory() ? archivosDe(rel) : [rel];
    });
}

describe('outputFileTracingIncludes — templates/ en el bundle serverless', () => {
  it.each(['/documents', '/cases'])(
    'la ruta %s incluye templates/',
    (route) => {
      expect(incluidosPara(route)).toContain('./templates/**/*');
    },
  );

  it('toda plantilla del catálogo queda cubierta', () => {
    const fuera = ALL_TEMPLATES.map(getTemplatePath).filter(
      (p) => !cubre('/documents', p),
    );
    expect(fuera).toEqual([]);
  });

  it('también los assets: CSS, imágenes y membretes por centro', () => {
    const archivos = archivosDe('templates');
    const assets = archivos.filter((a) =>
      /\/(CSS|img|branding)\//.test(`/${a}`),
    );
    // Sanidad: si no hubiera assets, el test no estaría probando nada.
    expect(assets.some((a) => a.includes('/CSS/'))).toBe(true);
    expect(assets.some((a) => a.startsWith('templates/branding/'))).toBe(true);

    const fuera = archivos.filter((a) => !cubre('/cases', a));
    expect(fuera).toEqual([]);
  });
});
