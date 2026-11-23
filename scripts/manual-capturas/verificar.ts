/**
 * Verificaciones de las figuras del manual. Solo lee: no cambia nada.
 *
 * - Numeración consecutiva dentro de cada sección, en orden de lectura.
 * - Cada figura tiene ancla, está referenciada en el texto (fuera del índice)
 *   y aparece en el índice; el índice está al día.
 * - Ninguna referencia `](#figura-…)` apunta a un ancla inexistente.
 * - Toda `<img>` tiene un `alt` descriptivo, su PNG existe y su `width` es la
 *   mitad de los píxeles del PNG.
 * - Ningún PNG de `docs/manual-usuario/img/` queda sin usar.
 * - Ninguna leyenda (`- ①…`) se fusiona con la lista que la sigue.
 *
 * Uso (sale con código 1 si encuentra algo):
 *   npx tsx scripts/manual-capturas/verificar.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { CARPETA_IMG, RAIZ_REPO } from './config';
import {
  anchoPng,
  anclaDeFigura,
  manualRegenerado,
  partirManual,
  piesDeFigura,
  RUTA_MANUAL,
} from './indice';

const LEYENDA = /^- [①-⑳]/;
const ITEM_SIN_NUMERO = /^- (?![①-⑳])/;

/** Corre todas las verificaciones, imprime el resumen y devuelve los errores. */
export function verificarManual(): string[] {
  const md = readFileSync(RUTA_MANUAL, 'utf8').replace(/\r\n/g, '\n');
  const { cuerpo, resto: indice } = partirManual(md);
  const errores: string[] = [];

  const pies = piesDeFigura(cuerpo);
  const porSeccion = new Map<string, number[]>();
  for (const { numero } of pies) {
    const [seccion, n] = numero.split(/-(?=\d+$)/);
    porSeccion.set(seccion, [...(porSeccion.get(seccion) ?? []), Number(n)]);
  }
  for (const [seccion, numeros] of porSeccion) {
    if (numeros.some((n, i) => n !== i + 1))
      errores.push(
        `numeración: la sección ${seccion} tiene ${numeros.join(', ')}`,
      );
  }

  const anclas = new Set(
    [...md.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]),
  );
  for (const { numero } of pies) {
    const id = anclaDeFigura(numero);
    if (!anclas.has(id)) errores.push(`sin ancla: Figura ${numero}`);
    if (!cuerpo.includes(`](#${id})`))
      errores.push(`sin referencia en el texto: Figura ${numero}`);
    if (!indice.includes(`](#${id})`))
      errores.push(`no está en el índice: Figura ${numero}`);
  }
  for (const m of md.matchAll(/\]\(#(figura-[^)]+)\)/g)) {
    if (!anclas.has(m[1])) errores.push(`referencia rota: #${m[1]}`);
  }

  const imgs = [...cuerpo.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  const usadas = new Set<string>();
  for (const img of imgs) {
    const src = img.match(/src="([^"]+)"/)?.[1];
    if (!/alt="[^"]{20,}"/.test(img))
      errores.push(`alt ausente o corto: ${img.slice(0, 80)}`);
    if (!src) {
      errores.push(`img sin src: ${img.slice(0, 80)}`);
      continue;
    }
    usadas.add(src);
    if (!existsSync(path.join(RAIZ_REPO, 'docs', src))) {
      errores.push(`no existe el PNG: ${src}`);
      continue;
    }
    const ancho = Number(img.match(/width="(\d+)"/)?.[1]);
    const esperado = Math.round(anchoPng(src) / 2);
    if (ancho !== esperado)
      errores.push(`width ${ancho} en ${src}; debería ser ${esperado}`);
  }
  for (const carpeta of readdirSync(CARPETA_IMG)) {
    for (const archivo of readdirSync(path.join(CARPETA_IMG, carpeta))) {
      const src = `manual-usuario/img/${carpeta}/${archivo}`;
      if (!usadas.has(src)) errores.push(`PNG sin usar: ${carpeta}/${archivo}`);
    }
  }

  // Solo se fusionan listas al mismo nivel de sangría: una leyenda anidada en
  // un ítem (4.3.1) seguida de otro ítem de primer nivel es lo esperado.
  const lineas = cuerpo.split('\n');
  const sangria = (l: string) => l.length - l.trimStart().length;
  const mismoNivel = (a: string, b: string) => sangria(a) === sangria(b);
  lineas.forEach((linea, i) => {
    const previa = lineas[i - 1] ?? '';
    const anterior = lineas[i - 2] ?? '';
    if (
      i > 0 &&
      LEYENDA.test(previa.trim()) &&
      ITEM_SIN_NUMERO.test(linea.trim()) &&
      mismoNivel(previa, linea)
    )
      errores.push(`leyenda fusionada con otra lista en la línea ${i + 1}`);
    if (
      i > 1 &&
      previa.trim() === '' &&
      LEYENDA.test(anterior.trim()) &&
      ITEM_SIN_NUMERO.test(linea.trim()) &&
      mismoNivel(anterior, linea)
    )
      errores.push(
        `leyenda fusionada (tras línea en blanco) en la línea ${i + 1}`,
      );
  });

  if (manualRegenerado(md) !== md)
    errores.push('el índice o los anchos no están al día: correr indice.ts');

  console.log(
    `figuras ${pies.length} | secciones ${porSeccion.size} | imágenes ${imgs.length} | errores ${errores.length}`,
  );
  for (const e of errores) console.log(`  - ${e}`);
  return errores;
}

if (require.main === module) {
  if (verificarManual().length) process.exitCode = 1;
}
