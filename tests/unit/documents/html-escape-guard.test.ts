/**
 * Guardián del escape HTML de los placeholders.
 *
 * `mapCaseToPlaceholders` termina con `escapeAllUnlessHtml`: escapa TODO valor
 * salvo las 16 claves de `HTML_PLACEHOLDERS_ALLOWLIST`, que son HTML que arma el
 * propio sistema. Ese diseño falla en silencio en dos direcciones:
 *
 *  A. Una clave HTML NUEVA que se le olvida a la allowlist sale escapada
 *     (`&lt;table&gt;…`) y rompe el documento.
 *  B. Una clave que SÍ está en la allowlist se salta el escape: si el builder que
 *     la arma interpola un dato del usuario sin escaparlo, es una inyección HTML/XSS
 *     en un documento legal.
 *
 * Nota de contexto: 14 de las 16 claves las produce una sola función
 * (`mapDynamicTables`) y el resto, `buildIncomeNarrative` y el orquestador.
 *
 * Este archivo cierra las dos:
 *
 *  1. Inventario: la allowlist del código fuente debe ser EXACTAMENTE el registro
 *     de abajo; agregar o quitar una clave obliga a tocar este test y a nombrar
 *     quién la produce.
 *  2. Cada clave del registro produce HTML SIN escapar en al menos un escenario.
 *  3. Detector de (A): en escenarios cuyos datos no llevan `<` ni `>`, ninguna
 *     salida puede contener `&lt;`/`&gt;`. Una clave HTML que falte en la
 *     allowlist aparece aquí.
 *  4. Detector de (B): con una carga `<b onmouseover=XSSMARK>` en TODO texto libre
 *     (deudor, acreedores, activos, dependientes, procesos, apoderado, arreglos JSON
 *     de conciliación…), ninguna salida —tampoco las claves HTML del sistema— ni
 *     ninguna plantilla renderizada la contiene sin escapar.
 *  5. Inventario del código: las funciones que contienen literales HTML son
 *     exactamente estas 10. Una función nueva que genere HTML hace fallar el test
 *     hasta que su clave se registre y se cubra.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import {
  buildConciliationContext,
  buildInsolvencyContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

import {
  SCENARIOS,
  SCENARIO_NAMES,
  XSS_MARK,
  XSS_PAYLOAD,
} from '../../helpers/mapper-scenarios';

const MAPPER_FILE = path.join(
  process.cwd(),
  'src/features/document/placeholder-mapper.ts',
);

/**
 * Registro: cada clave de la allowlist y la función que la produce.
 * Al agregar una clave HTML nueva a la allowlist, registrala aquí.
 */
const HTML_KEYS: Record<string, string> = {
  LISTA_ANEXOS: 'mapCaseToPlaceholders',
  NARRATIVA_INGRESOS: 'buildIncomeNarrative (vía mapIncomeDeclaration)',
  LISTA_ACREEDORES: 'mapDynamicTables',
  CUADRO_TOTAL_ACREEDORES: 'mapDynamicTables',
  CUADRO_CALIFICACION_GRADUACION:
    'mapDynamicTables → generateCalificacionGraduacionTable',
  CUADRO_CALIFICACION_FIRMADO:
    'mapDynamicTables → generateCalificacionGraduacionTable',
  CUADRO_ACUERDO_BILATERAL: 'mapDynamicTables',
  CUADRO_FRACASO_NEGOCIACION: 'mapDynamicTables',
  PROYECTO_CALIFICACION_GRADUACION:
    'mapDynamicTables → generateCalificacionGraduacionTable',
  PROPUESTA_PAGO: 'mapDynamicTables → generatePropuestaPagoHtml',
  PROPUESTA_REFORMA_PAGO: 'mapDynamicTables → generatePropuestaPagoHtml',
  DETALLE_BIENES: 'mapDynamicTables → generateDetalleBienes',
  INVENTARIO_BIENES: 'mapDynamicTables → generateInventarioBienes',
  DETALLE_PAGO_CAPITAL: 'mapDynamicTables → generateDetallePagoCapital',
  FORMA_PAGO_ACREEDORES: 'mapDynamicTables → generateFormaPagoAcreedores',
  PROYECCION_PAGOS: 'mapDynamicTables → generateProyeccionPagos',
};

/** Funciones del mapper que contienen literales HTML (etiquetas de tabla, lista, párrafo…). */
const EXPECTED_HTML_PRODUCERS = [
  'buildIncomeNarrative',
  'generateCalificacionGraduacionTable',
  'generateDetalleBienes',
  'generateDetallePagoCapital',
  'generateFormaPagoAcreedores',
  'generateInventarioBienes',
  'generateProyeccionPagos',
  'generatePropuestaPagoHtml',
  'mapCaseToPlaceholders',
  'mapDynamicTables',
];

/** De ellas, las que reciben datos de texto del usuario y por eso llaman a escapePlaceholder. */
const EXPECTED_ESCAPING_PRODUCERS = [
  'buildIncomeNarrative',
  'generateCalificacionGraduacionTable',
  'generateDetalleBienes',
  'generateDetallePagoCapital',
  'generateFormaPagoAcreedores',
  'generateInventarioBienes',
  'mapCaseToPlaceholders',
  'mapDynamicTables',
];

const NOW = new Date('2026-03-15T17:00:00Z');
const isXss = (name: string) => /xss/.test(name);
const build = (name: string) => SCENARIOS[name].build();
const run = (name: string) => mapCaseToPlaceholders(build(name) as never);

beforeAll(() => {
  jest.useFakeTimers({ now: NOW });
});
afterAll(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Lectura estática del código fuente
// ---------------------------------------------------------------------------

/**
 * Busca la declaración de `HTML_PLACEHOLDERS_ALLOWLIST` en un archivo. Vive en
 * `placeholder-mapper.ts` o en alguno de sus `./placeholders/*` (mismo criterio
 * de un-solo-pase que `collectFunctions`, más abajo): el corte de seguridad se
 * extrajo a `placeholders/escape.ts` sin tocar dónde se LLAMA (`mapCaseToPlaceholders`
 * lo sigue usando como última operación, ver parte 5 de este archivo), solo
 * dónde vive su código fuente.
 */
function findAllowlistIn(filePath: string, text: string): string[] | null {
  let found: string[] | null = null;
  const visit = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      n.name.getText() === 'HTML_PLACEHOLDERS_ALLOWLIST' &&
      n.initializer &&
      ts.isNewExpression(n.initializer)
    ) {
      const arg = n.initializer.arguments?.[0];
      if (arg && ts.isArrayLiteralExpression(arg)) {
        found = arg.elements.map((e) => (e as ts.StringLiteral).text);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true));
  return found;
}

function readAllowlist(): string[] {
  const text = fs.readFileSync(MAPPER_FILE, 'utf8');
  let found = findAllowlistIn(MAPPER_FILE, text);
  if (!found) {
    const sf = ts.createSourceFile(
      MAPPER_FILE,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    for (const st of sf.statements) {
      if (
        ts.isImportDeclaration(st) &&
        ts.isStringLiteral(st.moduleSpecifier) &&
        st.moduleSpecifier.text.startsWith('./placeholders/')
      ) {
        const importedPath =
          path.join(path.dirname(MAPPER_FILE), st.moduleSpecifier.text) + '.ts';
        if (fs.existsSync(importedPath)) {
          found = findAllowlistIn(
            importedPath,
            fs.readFileSync(importedPath, 'utf8'),
          );
          if (found) break;
        }
      }
    }
  }
  if (!found)
    throw new Error(
      'No se encontró HTML_PLACEHOLDERS_ALLOWLIST en el mapper ni en sus placeholders/*',
    );
  return found;
}

const HTML_TAG =
  /<\/?(table|thead|tbody|tr|td|th|ul|ol|li|p|br|div|span|strong|b|em|i|h[1-6]|colgroup|col)\b/i;

/**
 * Junta las `FunctionDeclaration` de un archivo con las de cualquier módulo
 * relativo bajo `placeholders/` que importe, RECURSIVO: sigue tanto
 * `./placeholders/*` (desde `placeholder-mapper.ts`) como los imports entre
 * sub-mappers (`./otro-sub-mapper`, desde dentro de `placeholders/`), acotado
 * a esa carpeta para no seguir también vecinos de `document/` como
 * `handlebars-lite`. Así el inventario de productores de HTML sigue viendo
 * las funciones sin importar cuántos pasos de división las muevan.
 *
 * Hasta el Paso 8 alcanzaba con una sola pasada (descubierto en el Paso 4,
 * cuando `buildIncomeNarrative` se movió a `placeholders/income.ts` y este
 * test dejó de verla). El Paso 9 lo hizo falta de verdad: `mapDynamicTables`
 * se movió a `placeholders/tablas-dinamicas-pagos.ts`, que a su vez importa
 * los 7 `generate*` de `placeholders/html-builders.ts` —dos niveles desde
 * `placeholder-mapper.ts`—, y una sola pasada ya no alcanzaba.
 */
const PLACEHOLDERS_DIR = path.join(
  process.cwd(),
  'src/features/document/placeholders',
);

function collectFunctions(
  filePath: string,
  text: string,
): Map<string, ts.FunctionDeclaration> {
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const functions = new Map<string, ts.FunctionDeclaration>();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name)
      functions.set(st.name.text, st);
    if (
      ts.isImportDeclaration(st) &&
      ts.isStringLiteral(st.moduleSpecifier) &&
      st.moduleSpecifier.text.startsWith('.')
    ) {
      const importedPath =
        path.join(path.dirname(filePath), st.moduleSpecifier.text) + '.ts';
      if (
        importedPath.startsWith(PLACEHOLDERS_DIR) &&
        fs.existsSync(importedPath)
      ) {
        const importedText = fs.readFileSync(importedPath, 'utf8');
        for (const [name, fn] of collectFunctions(importedPath, importedText))
          functions.set(name, fn);
      }
    }
  }
  return functions;
}

function topLevelFunctions() {
  const text = fs.readFileSync(MAPPER_FILE, 'utf8');
  return [...collectFunctions(MAPPER_FILE, text).values()];
}

function containsHtmlLiteral(fn: ts.FunctionDeclaration): boolean {
  let has = false;
  const visit = (x: ts.Node) => {
    if (
      (ts.isStringLiteral(x) ||
        ts.isNoSubstitutionTemplateLiteral(x) ||
        ts.isTemplateHead(x) ||
        ts.isTemplateMiddle(x) ||
        ts.isTemplateTail(x)) &&
      HTML_TAG.test(x.text)
    ) {
      has = true;
    }
    ts.forEachChild(x, visit);
  };
  visit(fn);
  return has;
}

function callsEscape(fn: ts.FunctionDeclaration): boolean {
  let has = false;
  const visit = (x: ts.Node) => {
    if (
      ts.isCallExpression(x) &&
      x.expression.getText() === 'escapePlaceholder'
    )
      has = true;
    ts.forEachChild(x, visit);
  };
  visit(fn);
  return has;
}

// ---------------------------------------------------------------------------
// Detectores (puros: se prueban también con entradas sintéticas)
// ---------------------------------------------------------------------------

/** Claves cuyo valor lleva HTML del sistema escapado por error (`&lt;table&gt;`). */
export function findWronglyEscapedHtml(map: Record<string, string>): string[] {
  return Object.entries(map)
    .filter(
      ([, v]) => typeof v === 'string' && /&lt;|&gt;|&amp;lt;|&amp;gt;/.test(v),
    )
    .map(([k]) => k);
}

/** Claves cuyo valor lleva la carga XSS SIN escapar. */
export function findRawPayload(map: Record<string, unknown>): string[] {
  return Object.entries(map)
    .filter(([, v]) => JSON.stringify(v).includes(XSS_PAYLOAD))
    .map(([k]) => k);
}

describe('los detectores detectan (entradas sintéticas)', () => {
  it('findWronglyEscapedHtml marca una tabla HTML escapada por error y deja pasar el resto', () => {
    expect(
      findWronglyEscapedHtml({
        OK_HTML: '<table><tr><td>1</td></tr></table>',
        OK_TEXTO: 'José & Hijos',
        MAL: '&lt;table&gt;&lt;tr&gt;',
      }),
    ).toEqual(['MAL']);
  });

  it('findRawPayload marca la carga sin escapar y deja pasar la escapada', () => {
    expect(
      findRawPayload({
        MAL: `<td>${XSS_PAYLOAD}Ana</td>`,
        OK: '<td>&lt;b onmouseover=XSSMARK&gt;Ana</td>',
      }),
    ).toEqual(['MAL']);
  });
});

// ---------------------------------------------------------------------------
// 1) Inventario de la allowlist
// ---------------------------------------------------------------------------

describe('1. inventario de HTML_PLACEHOLDERS_ALLOWLIST', () => {
  it('la allowlist del código son exactamente estas 16 claves registradas', () => {
    // Si falla: agregaste o quitaste una clave HTML. Registrala en HTML_KEYS (con la
    // función que la produce), escapá con escapePlaceholder los datos de usuario
    // dentro del builder y asegurate de que algún escenario la active.
    expect([...readAllowlist()].sort()).toEqual(Object.keys(HTML_KEYS).sort());
    expect(readAllowlist()).toHaveLength(16);
  });

  it('no hay claves repetidas en la allowlist', () => {
    const list = readAllowlist();
    expect(new Set(list).size).toBe(list.length);
  });
});

// ---------------------------------------------------------------------------
// 2) Cada clave de la allowlist produce HTML sin escapar
// ---------------------------------------------------------------------------

describe('2. cada clave de la allowlist sale como HTML, sin escapar', () => {
  const benign = SCENARIO_NAMES.filter((n) => !isXss(n));

  it.each(Object.keys(HTML_KEYS))('%s', (key) => {
    const witnesses = benign.filter((name) => {
      const value = run(name)[key];
      return (
        typeof value === 'string' &&
        value.includes('<') &&
        !/&lt;|&gt;/.test(value)
      );
    });

    // Si ningún escenario la activa, el test no puede garantizar nada sobre ella:
    // agregá un escenario que la produzca (o quitá la clave si ya no se usa).
    expect(witnesses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3) Detector de A: una clave HTML fuera de la allowlist sale escapada
// ---------------------------------------------------------------------------

describe('3. ningún dato "normal" sale con HTML escapado por error', () => {
  const benign = SCENARIO_NAMES.filter((n) => !isXss(n));

  it('hay escenarios sin HTML en sus datos (incluido uno con & y comillas)', () => {
    expect(benign.length).toBeGreaterThanOrEqual(12);
    expect(benign).toContain('insolvencia-caracteres-especiales');
  });

  it.each(benign)('%s: ninguna salida contiene &lt; ni &gt;', (name) => {
    // Los datos de estos escenarios no llevan `<` ni `>`: si una salida trae `&lt;`,
    // es HTML del sistema que se escapó. Casi siempre, una clave nueva que falta en
    // HTML_PLACEHOLDERS_ALLOWLIST.
    expect(findWronglyEscapedHtml(run(name))).toEqual([]);
  });

  it('el contexto de conciliación (arreglos de los bloques {{#each}}) tampoco escapa de más', () => {
    const context = buildConciliationContext(
      build('conciliacion-basica') as never,
    );
    expect(findWronglyEscapedHtml(context as Record<string, string>)).toEqual(
      [],
    );
    expect(JSON.stringify(context)).not.toMatch(/&lt;|&gt;/);
  });
});

// ---------------------------------------------------------------------------
// 4) Detector de B: los datos del usuario no se cuelan como HTML
// ---------------------------------------------------------------------------

describe('4. una carga HTML en los datos del usuario nunca sale sin escapar', () => {
  const xssScenarios = SCENARIO_NAMES.filter(isXss);

  it('hay escenarios XSS de insolvencia y de conciliación', () => {
    expect(xssScenarios).toEqual(['insolvencia-xss', 'conciliacion-xss']);
  });

  it.each(xssScenarios)(
    '%s: ninguna salida del mapper contiene la carga sin escapar',
    (name) => {
      const output = run(name);

      expect(findRawPayload(output)).toEqual([]);

      // No vacuo: la carga SÍ llega a la salida, escapada, en muchísimas claves.
      const escaped = XSS_PAYLOAD.replace('<', '&lt;').replace('>', '&gt;');
      const carrying = Object.values(output).filter((v) =>
        v.includes(escaped),
      ).length;
      expect(carrying).toBeGreaterThan(80);
    },
  );

  it('las claves HTML del sistema que arman texto del usuario lo escapan', () => {
    const output = run('insolvencia-xss');
    const escaped = XSS_PAYLOAD.replace('<', '&lt;').replace('>', '&gt;');

    // Lo que más interpola datos de usuario dentro de HTML del sistema.
    for (const key of [
      'LISTA_ANEXOS',
      'LISTA_ACREEDORES',
      'DETALLE_BIENES',
      'INVENTARIO_BIENES',
      'CUADRO_CALIFICACION_GRADUACION',
    ]) {
      expect(output[key]).toContain('<'); // sigue siendo HTML del sistema…
      expect(output[key]).toContain(escaped); // …con el texto del usuario escapado
      expect(output[key]).not.toContain(XSS_PAYLOAD);
    }
  });

  it('el contexto de conciliación (menores, cláusulas…) escapa los textos de los arreglos', () => {
    const context = buildConciliationContext(
      build('conciliacion-xss') as never,
    );
    const json = JSON.stringify(context);

    expect(json).not.toContain(XSS_PAYLOAD);
    expect(json).toContain(XSS_MARK); // la carga llegó, escapada
  });

  it('el contexto de insolvencia (acreedores) escapa los textos de los arreglos', () => {
    // Mismo riesgo que el de conciliación, y por el mismo motivo: `extraContext`
    // NO pasa por `escapeAllUnlessHtml`. `renderDocumentHtml` lo funde en el
    // contexto tal cual y `substituteVars` lo inserta en el HTML sin más, así
    // que si el builder no escapa lo suyo es una inyección en un documento
    // legal.
    const context = buildInsolvencyContext(build('insolvencia-xss') as never);
    const json = JSON.stringify(context);

    expect(json).not.toContain(XSS_PAYLOAD);
    expect(json).toContain(XSS_MARK); // la carga llegó, escapada
  });

  it('ninguna plantilla renderizada con datos hostiles contiene la carga (las 65 × insolvencia/conciliación)', () => {
    const kinds: Record<string, string> = {
      INSOLVENCY: 'insolvencia-xss',
      CONCILIATION: 'conciliacion-xss',
      SUPPORT_AGREEMENT: 'insolvencia-xss',
    };
    const cache = new Map<
      string,
      { placeholders: Record<string, string>; extra?: Record<string, unknown> }
    >();
    let rendered = 0;

    for (const template of ALL_TEMPLATES) {
      const file = path.join(process.cwd(), getTemplatePath(template));
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      const scenario = kinds[template.caseType];
      if (!cache.has(scenario)) {
        const caseData = build(scenario);
        cache.set(scenario, {
          placeholders: mapCaseToPlaceholders(caseData as never),
          extra:
            SCENARIOS[scenario].kind === 'CONCILIATION'
              ? buildConciliationContext(caseData as never)
              : undefined,
        });
      }
      const { placeholders, extra } = cache.get(scenario)!;
      const out = renderDocumentHtml(html, placeholders, extra).html;

      expect({
        template: template.id,
        leaked: out.includes(XSS_PAYLOAD),
      }).toEqual({
        template: template.id,
        leaked: false,
      });
      rendered++;
    }
    expect(rendered).toBeGreaterThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// 5) Inventario del código: qué funciones generan HTML
// ---------------------------------------------------------------------------

describe('5. las funciones que generan HTML están inventariadas', () => {
  it('las funciones con literales HTML son exactamente estas 10', () => {
    const producers = topLevelFunctions()
      .filter(containsHtmlLiteral)
      .map((f) => f.name!.text)
      .sort();

    // Si falla porque APARECIÓ una función: genera HTML nuevo. Registrá su clave en
    // HTML_PLACEHOLDERS_ALLOWLIST y en HTML_KEYS (arriba), escapá con escapePlaceholder
    // todo texto libre que interpole, y asegurate de que un escenario (incluido el XSS)
    // la active. Si DESAPARECIÓ una: quitala de EXPECTED_HTML_PRODUCERS.
    expect(producers).toEqual([...EXPECTED_HTML_PRODUCERS].sort());
  });

  it('las que interpolan texto del usuario llaman a escapePlaceholder (las otras solo formatean números)', () => {
    const escaping = topLevelFunctions()
      .filter((f) => containsHtmlLiteral(f) && callsEscape(f))
      .map((f) => f.name!.text)
      .sort();

    expect(escaping).toEqual([...EXPECTED_ESCAPING_PRODUCERS].sort());
  });

  it('la función que aplica el escape sigue siendo la última operación del orquestador', () => {
    const orchestrator = topLevelFunctions().find(
      (f) => f.name!.text === 'mapCaseToPlaceholders',
    )!;
    const statements = orchestrator.body!.statements;
    const last = statements[statements.length - 1];

    expect(ts.isReturnStatement(last)).toBe(true);
    expect(
      (last as ts.ReturnStatement)
        .expression!.getText()
        .startsWith('escapeAllUnlessHtml('),
    ).toBe(true);
  });
});
