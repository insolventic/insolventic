/**
 * Preparación de página, anotaciones y recorte de las figuras del manual.
 *
 * Las anotaciones se generan por código, nunca a mano: un marco del color de
 * anotación alrededor del elemento y un badge numerado que coincide con la
 * leyenda del manual. Mismo estilo en todas las figuras.
 */

import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { CARPETA_IMG, COLOR_ANOTACION, VIEWPORT } from './config';

const ID_CAPA = 'manual-anotaciones';

/**
 * CSS que se inyecta en cada página antes de capturar:
 * - sin animaciones, transiciones ni cursor de texto parpadeante;
 * - sin la marca de versión (cambia con cada release y no aporta al lector);
 * - avisos (toasts) ocultos salvo que la figura los pida (`mostrarAvisos`).
 */
const CSS_CAPTURA = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  [aria-label^="INSOLVENTIC versión"] { display: none !important; }
  html:not([data-manual-avisos]) [data-sonner-toaster] { display: none !important; }
`;

export async function prepararPagina(page: Page): Promise<void> {
  await page.addStyleTag({ content: CSS_CAPTURA });
}

/** Espera fuentes cargadas, red en reposo y un cuadro de render estable. */
export async function esperarEstable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
}

export async function mostrarAvisos(
  page: Page,
  mostrar: boolean,
): Promise<void> {
  await page.evaluate((m) => {
    if (m) document.documentElement.setAttribute('data-manual-avisos', '');
    else document.documentElement.removeAttribute('data-manual-avisos');
  }, mostrar);
}

export interface Anotacion {
  objetivo: Locator;
  /** Número del badge; coincide con la leyenda del manual. */
  numero: number;
  /** Esquina del badge respecto del marco. Por defecto, arriba a la izquierda. */
  badge?: 'arriba-izq' | 'arriba-der' | 'izq' | 'der';
  /** Holgura del marco alrededor del elemento, en px CSS. */
  holgura?: number;
}

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
  numero: number;
  badge: NonNullable<Anotacion['badge']>;
}

/** Dibuja marcos y badges. Máximo 5 por figura (regla del manual). */
export async function anotar(
  page: Page,
  anotaciones: Anotacion[],
): Promise<void> {
  if (anotaciones.length > 5) {
    throw new Error(
      `Una figura lleva como máximo 5 anotaciones (se pidieron ${anotaciones.length}).`,
    );
  }
  // No se desplaza nada aquí: si cada anotación hiciera scroll hasta su
  // elemento, los marcos medidos antes quedarían corridos. Quien llama deja la
  // vista en su sitio (`desplazarAlInicio`) y aquí solo se verifica.
  const cajas: Caja[] = [];
  for (const a of anotaciones) {
    const box = await a.objetivo.boundingBox();
    if (!box)
      throw new Error(`Anotación ${a.numero}: el elemento no está visible.`);
    if (box.y < 0 || box.y + box.height > VIEWPORT.height) {
      const evidencia = path.join(tmpdir(), 'manual-capturas-error.png');
      await page.screenshot({ path: evidencia });
      throw new Error(
        `(captura del estado en ${evidencia}) ` +
          `Anotación ${a.numero}: el elemento queda fuera de la vista ` +
          `(y=${Math.round(box.y)}, alto=${Math.round(box.height)}, vista=${VIEWPORT.height}).`,
      );
    }
    const h = a.holgura ?? 4;
    cajas.push({
      x: box.x - h,
      y: box.y - h,
      w: box.width + 2 * h,
      h: box.height + 2 * h,
      numero: a.numero,
      badge: a.badge ?? 'arriba-izq',
    });
  }

  await page.evaluate(
    ({ cajas, color, id }) => {
      document.getElementById(id)?.remove();
      const capa = document.createElement('div');
      capa.id = id;
      capa.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
      const R = 13; // radio del badge
      for (const c of cajas) {
        const marco = document.createElement('div');
        marco.style.cssText = [
          'position:absolute',
          `left:${c.x}px`,
          `top:${c.y}px`,
          `width:${c.w}px`,
          `height:${c.h}px`,
          `border:3px solid ${color}`,
          'border-radius:8px',
          'box-sizing:border-box',
          'box-shadow:0 0 0 2px rgba(255,255,255,.9)',
        ].join(';');
        capa.appendChild(marco);

        const pos: Record<string, [number, number]> = {
          'arriba-izq': [c.x - R, c.y - R],
          'arriba-der': [c.x + c.w - R, c.y - R],
          izq: [c.x - 2 * R - 6, c.y + c.h / 2 - R],
          der: [c.x + c.w + 6, c.y + c.h / 2 - R],
        };
        const [bx, by] = pos[c.badge];
        const badge = document.createElement('div');
        badge.textContent = String(c.numero);
        badge.style.cssText = [
          'position:absolute',
          `left:${bx}px`,
          `top:${by}px`,
          `width:${2 * R}px`,
          `height:${2 * R}px`,
          'border-radius:50%',
          `background:${color}`,
          'color:#fff',
          'font:700 14px/26px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
          'text-align:center',
          'box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.35)',
        ].join(';');
        capa.appendChild(badge);
      }
      document.body.appendChild(capa);
    },
    { cajas, color: COLOR_ANOTACION, id: ID_CAPA },
  );
}

/**
 * Desplaza el contenedor con scroll (p. ej. un diálogo) hasta que el
 * elemento quede arriba, con `margen` px CSS de aire.
 */
export async function desplazarAlInicio(
  objetivo: Locator,
  margen = 16,
): Promise<void> {
  await objetivo.evaluate((el, m) => {
    el.scrollIntoView({ block: 'start' });
    let p: HTMLElement | null = el.parentElement;
    while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement;
    p?.scrollBy(0, -m);
  }, margen);
}

export async function quitarAnotaciones(page: Page): Promise<void> {
  await page.evaluate((id) => document.getElementById(id)?.remove(), ID_CAPA);
}

export interface OpcionesCaptura {
  /**
   * Región a recortar: un elemento o varios (se toma el rectángulo que los
   * abarca). Sin ella se captura el viewport completo.
   */
  recorte?: Locator | Locator[];
  /** Margen alrededor del recorte, en px CSS (deja ver los badges). */
  margen?: number;
  /**
   * Toma el ancho de este elemento en vez del de `recorte` (p. ej. el
   * diálogo completo, para que un recorte vertical no corte los marcos).
   */
  anchoDe?: Locator;
}

/**
 * Guarda `docs/manual-usuario/img/<carpeta>/<archivo>.png`. El nombre sigue la
 * convención `NN-seccion-descripcion` en kebab-case, sin tildes.
 */
export async function capturar(
  page: Page,
  carpeta: string,
  archivo: string,
  opciones: OpcionesCaptura = {},
): Promise<string> {
  if (!/^\d{2}-[a-z0-9-]+$/.test(archivo)) {
    throw new Error(`Nombre de figura fuera de convención: "${archivo}"`);
  }
  await esperarEstable(page);
  const destino = path.join(CARPETA_IMG, carpeta, `${archivo}.png`);
  mkdirSync(path.dirname(destino), { recursive: true });

  let clip: { x: number; y: number; width: number; height: number } | undefined;
  if (opciones.recorte) {
    const regiones = Array.isArray(opciones.recorte)
      ? opciones.recorte
      : [opciones.recorte];
    const cajas = [];
    for (const r of regiones) {
      const box = await r.boundingBox();
      if (!box)
        throw new Error(`${archivo}: la región a recortar no está visible.`);
      cajas.push(box);
    }
    let izq = Math.min(...cajas.map((b) => b.x));
    let der = Math.max(...cajas.map((b) => b.x + b.width));
    const m = opciones.margen ?? 24;
    let arr = Math.min(...cajas.map((b) => b.y)) - m;
    let aba = Math.max(...cajas.map((b) => b.y + b.height)) + m;
    let mx = m;
    if (opciones.anchoDe) {
      // Ancho del contenedor y, en vertical, sin salirse de él.
      const c = await opciones.anchoDe.boundingBox();
      if (!c)
        throw new Error(`${archivo}: el elemento de ancho no está visible.`);
      izq = c.x;
      der = c.x + c.width;
      mx = 0;
      arr = Math.max(arr, c.y);
      aba = Math.min(aba, c.y + c.height);
    }
    const x = Math.max(0, Math.floor(izq - mx));
    const y = Math.max(0, Math.floor(arr));
    clip = {
      x,
      y,
      width: Math.min(VIEWPORT.width, Math.ceil(der + mx)) - x,
      height: Math.min(VIEWPORT.height, Math.ceil(aba)) - y,
    };
  }

  await page.screenshot({
    path: destino,
    clip,
    animations: 'disabled',
    caret: 'hide',
    scale: 'device',
  });
  return destino;
}
