/**
 * Constantes compartidas por el seed y el script de capturas del manual.
 */

import path from 'node:path';

/** Raíz del repositorio (este archivo vive en scripts/manual-capturas/). */
export const RAIZ_REPO = path.resolve(__dirname, '..', '..');

/** Carpeta de imágenes del manual: docs/manual-usuario/img/<seccion>/. */
export const CARPETA_IMG = path.join(
  RAIZ_REPO,
  'docs',
  'manual-usuario',
  'img',
);

/**
 * Fecha ancla del manual. El navegador queda congelado en este instante y
 * todas las fechas del seed se calculan a partir de ella, así las figuras no
 * cambian entre corridas. Lo que el SERVIDOR calcula con su propio reloj
 * ("Casos este Mes", "Audiencias Próximas", la fecha de alta de un caso
 * creado desde la UI) sigue la fecha real: ver README.
 */
export const FECHA_ANCLA = new Date('2026-11-16T10:00:00-05:00');

/** Centro con el que se capturan las figuras (decisión P1). */
export const CENTRO = {
  slug: 'constructores-paz',
  nombre: 'Constructores de Paz',
} as const;

/** Puerto propio para no chocar con un `npm run dev` en el 3000. */
export const PUERTO = 3100;
export const URL_BASE = `http://localhost:${PUERTO}`;

export const VIEWPORT = { width: 1440, height: 900 } as const;
export const ESCALA = 2;
export const LOCALE = 'es-CO';
export const ZONA_HORARIA = 'America/Bogota';

/**
 * Estilo único de las anotaciones: verde azulado del logo de INSOLVENTIC.
 * Contrasta con el azul de la interfaz y con el rojo de los errores, así un
 * resaltado nunca se confunde con un mensaje de la aplicación.
 */
export const COLOR_ANOTACION = '#0B8577';
