/**
 * Unit Tests — el conteo de tests que declara la documentación.
 *
 * Tres documentos afirmaban cuántos tests tiene el proyecto, y los tres decían
 * una cifra distinta, ninguna correcta: README.md "20 suites / 405 tests",
 * docs/TESTS.md "27 suites / 447 tests", CLAUDE.md "1448 tests en 97 suites"
 * (esta última con fecha y commit, que es lo que la hacía creíble). El real
 * era 163 / 2176 — CLAUDE.md estaba 53% por debajo.
 *
 * La causa no fue descuido: nada comparaba esos números con la realidad, así
 * que envejecían en silencio. Este test es esa comparación.
 *
 * Qué exige:
 *   1. Los tres documentos declaran el conteo con el MISMO formato
 *      (`N suites / M tests`) y el MISMO par de números. Si uno se actualiza
 *      y los otros no, falla.
 *   2. N no se despega más de un 10% de las suites que hay en disco (mismo
 *      criterio que jest.config.ts: `*.test.ts(x)` bajo `tests/`, sin
 *      `tests/e2e/` ni `tests/db/`, que corren aparte). La tolerancia es a
 *      propósito: con igualdad exacta, cualquier PR que agregue un archivo de
 *      test tendría que editar los tres documentos o quedarse en rojo, y un
 *      check que estorba se termina desactivando. Un 10% deja crecer unas 16
 *      suites antes de pedir la actualización, y el desfase que motivó este
 *      test era del 40% en suites y del 53% en casos.
 *   3. M no puede ser menor que el recuento estático de llamadas `it(`/`test(`.
 *      El runtime siempre reporta igual o más (hay casos generados en loops:
 *      hoy 1655 estáticos contra 2176 ejecutados), así que un M por debajo de
 *      ese piso solo puede significar que la cifra quedó vieja. Es un piso, no
 *      una igualdad, justamente para no tener que tocar este test cada vez que
 *      se agrega un caso.
 *
 * Cuando falle: correr `npx jest --ci`, tomar la línea `Tests:` y
 * `Test Suites:`, y escribir ese par en los tres documentos.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_CON_CONTEO = ['README.md', 'docs/TESTS.md', 'CLAUDE.md'] as const;

/** `163 suites / 2176 tests`, con o sin separador de miles. */
const PATRON = /\b([\d.]+)\s+suites?\s*\/\s*([\d.]+)\s+tests\b/;

function aNumero(texto: string): number {
  return Number(texto.replace(/\./g, ''));
}

/** Mismo criterio que `testMatch` + `testPathIgnorePatterns` de jest.config.ts. */
function suitesEnDisco(dir = 'tests', acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const rutaPosix = ruta.split(/[\\/]/).join('/');
    if (statSync(ruta).isDirectory()) {
      if (rutaPosix === 'tests/e2e' || rutaPosix === 'tests/db') continue;
      suitesEnDisco(ruta, acc);
    } else if (/\.test\.tsx?$/.test(entrada)) {
      acc.push(rutaPosix);
    }
  }
  return acc;
}

/** Recuento estático de `it(` / `test(` — piso del total que reporta jest. */
function casosEstaticos(archivos: string[]): number {
  const llamada = /(?<![\w.])(?:it|test)(?:\.only|\.skip|\.each)?\s*[(`]/g;
  return archivos.reduce(
    (total, archivo) =>
      total + (readFileSync(archivo, 'utf8').match(llamada)?.length ?? 0),
    0,
  );
}

describe('conteo de tests declarado en la documentación', () => {
  const archivos = suitesEnDisco();
  const declarados = DOCS_CON_CONTEO.map((doc) => {
    const encontrado = PATRON.exec(readFileSync(doc, 'utf8'));
    return {
      doc,
      suites: encontrado ? aNumero(encontrado[1]) : null,
      tests: encontrado ? aNumero(encontrado[2]) : null,
    };
  });

  it.each([...DOCS_CON_CONTEO])(
    '%s declara el conteo en el formato "N suites / M tests"',
    (doc) => {
      const declarado = declarados.find((d) => d.doc === doc)!;
      expect(declarado.suites).not.toBeNull();
      expect(declarado.tests).not.toBeNull();
    },
  );

  it('los tres documentos declaran el mismo par de números', () => {
    const pares = declarados.map((d) => `${d.suites} / ${d.tests}`);
    expect(new Set(pares).size).toBe(1);
  });

  it.each([...DOCS_CON_CONTEO])(
    '%s declara un número de suites que no se despega del real',
    (doc) => {
      const declarado = declarados.find((d) => d.doc === doc)!;
      const desvio =
        Math.abs((declarado.suites ?? 0) - archivos.length) / archivos.length;

      // El objeto es para que el fallo imprima las dos cifras y no solo un
      // booleano. Si esto falla: correr `npx jest --ci` y copiar el par que
      // reporta a los tres documentos.
      expect({
        doc,
        declaradas: declarado.suites,
        enDisco: archivos.length,
        desvio: `${Math.round(desvio * 100)}%`,
        dentroDeLaTolerancia: desvio <= 0.1,
      }).toMatchObject({ dentroDeLaTolerancia: true });
    },
  );

  it('el total declarado no queda por debajo del recuento estático de casos', () => {
    const piso = casosEstaticos(archivos);
    const viejos = declarados
      .filter((d) => (d.tests ?? 0) < piso)
      .map(
        (d) =>
          `${d.doc} declara ${d.tests} tests y en disco hay al menos ${piso} llamadas it()/test()`,
      );

    // Si esto falla: correr `npx jest --ci` y copiar el par que reporta a los
    // tres documentos. No bajar el piso.
    expect(viejos).toEqual([]);
  });
});
