/**
 * Red de seguridad ("golden master") del mapper de placeholders.
 *
 * Fija, para un conjunto amplio de casos realistas (ver
 * tests/helpers/mapper-scenarios.ts), la salida COMPLETA de
 * `mapCaseToPlaceholders` (~885 claves), la de `buildConciliationContext` y el
 * HTML resultante de renderizar CADA plantilla del sistema. Es el criterio de
 * aceptación de cualquier refactor del mapper: mover código no debe cambiar ni
 * un byte de lo que sale.
 *
 * Qué hacer cuando falla:
 *  - Cambió una salida y NO lo esperabas → es una regresión: revertí o arreglá.
 *  - Cambió a propósito (arreglo de un bug, campo nuevo, plantilla editada) →
 *    revisá el diff que imprime este test y regenerá con
 *        npm run test:golden:update
 *    El diff de los archivos en tests/unit/documents/golden/ es lo que se revisa
 *    en el PR: una clave por línea.
 *
 * Los valores de más de 200 caracteres (tablas HTML) se guardan como hash + largo.
 */

// La zona horaria del proceso es UTC (como Vercel y CI): la fija tests/global-setup.js.
// El mapper depende de la zona del servidor (ver el test "BUG CONOCIDO" al final).

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  buildConciliationContext,
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
  type ScenarioKind,
} from '../../helpers/mapper-scenarios';

const UPDATE = process.env.UPDATE_GOLDEN === '1';
const GOLDEN_DIR = path.join(__dirname, 'golden');
const MAPPER_DIR = path.join(GOLDEN_DIR, 'mapper');
const RENDER_FILE = path.join(GOLDEN_DIR, 'render-hashes.json');

/** "Hoy" congelado: 2026-03-15 12:00 en Bogotá. El mapper usa la fecha actual. */
const NOW = new Date('2026-03-15T17:00:00Z');

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const short = (text: string) => sha(text).slice(0, 12);

const LONG = 200;
function compactValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > LONG ? `sha256:${short(text)}+${text.length}` : text;
}

function compactMap(map: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(map).sort()) out[key] = compactValue(map[key]);
  return out;
}

const serialize = (data: unknown) => JSON.stringify(data, null, 1) + '\n';

interface ScenarioGolden {
  placeholders: Record<string, string>;
  conciliationContext?: Record<string, string>;
}

function computeScenario(name: string): ScenarioGolden {
  const scenario = SCENARIOS[name];
  const caseData = scenario.build();
  const golden: ScenarioGolden = {
    placeholders: compactMap(mapCaseToPlaceholders(caseData as never)),
  };
  if (scenario.kind === 'CONCILIATION') {
    golden.conciliationContext = compactMap(
      buildConciliationContext(caseData as never),
    );
  }
  return golden;
}

/** Diferencias legibles entre lo guardado y lo actual (una línea por clave). */
function diffMaps(
  expected: Record<string, string>,
  actual: Record<string, string>,
): string[] {
  const lines: string[] = [];
  for (const key of new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ])) {
    if (!(key in actual))
      lines.push(`- ${key}  (ya no se emite)  era: ${expected[key]}`);
    else if (!(key in expected))
      lines.push(`+ ${key}  (clave nueva)  ahora: ${actual[key]}`);
    else if (expected[key] !== actual[key])
      lines.push(
        `~ ${key}\n      era:   ${expected[key]}\n      ahora: ${actual[key]}`,
      );
  }
  return lines;
}

const HINT =
  '\n\nSi el cambio es intencional: npm run test:golden:update  y revisá el diff de tests/unit/documents/golden/.';

function expectNoDiff(label: string, lines: string[]) {
  if (lines.length === 0) return;
  const shown = lines.slice(0, 40).join('\n');
  const more =
    lines.length > 40 ? `\n… y ${lines.length - 40} diferencias más` : '';
  throw new Error(
    `${label}: ${lines.length} diferencia(s) contra el golden master\n${shown}${more}${HINT}`,
  );
}

beforeAll(() => {
  jest.useFakeTimers({ now: NOW });
  if (UPDATE) fs.mkdirSync(MAPPER_DIR, { recursive: true });
});
afterAll(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1) Salida completa del mapper por escenario
// ---------------------------------------------------------------------------

describe('golden master — mapCaseToPlaceholders / buildConciliationContext', () => {
  it('hay escenarios de los tres tipos de caso', () => {
    const kinds = new Set<ScenarioKind>(
      SCENARIO_NAMES.map((n) => SCENARIOS[n].kind),
    );
    expect([...kinds].sort()).toEqual([
      'CONCILIATION',
      'INSOLVENCY',
      'SUPPORT_AGREEMENT',
    ]);
    expect(SCENARIO_NAMES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(SCENARIO_NAMES)('%s', (name) => {
    const actual = computeScenario(name);
    const file = path.join(MAPPER_DIR, `${name}.json`);

    // No vacuo: el mapper emite cientos de claves en cada escenario.
    expect(Object.keys(actual.placeholders).length).toBeGreaterThan(700);

    if (UPDATE) {
      fs.writeFileSync(file, serialize(actual));
      return;
    }
    if (!fs.existsSync(file)) {
      throw new Error(`Falta el golden de "${name}".${HINT}`);
    }
    const expected: ScenarioGolden = JSON.parse(fs.readFileSync(file, 'utf8'));

    expectNoDiff(
      `${name} · placeholders`,
      diffMaps(expected.placeholders, actual.placeholders),
    );
    expectNoDiff(
      `${name} · contexto de conciliación`,
      diffMaps(
        expected.conciliationContext ?? {},
        actual.conciliationContext ?? {},
      ),
    );
  });

  it('no quedan archivos golden de escenarios que ya no existen', () => {
    if (UPDATE) return;
    const files = fs
      .readdirSync(MAPPER_DIR)
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(files).toEqual([...SCENARIO_NAMES].sort());
  });
});

// ---------------------------------------------------------------------------
// 2) HTML renderizado de cada plantilla (mapper + motor de placeholders)
// ---------------------------------------------------------------------------

const RENDER_SCENARIOS: Record<ScenarioKind, string[]> = {
  INSOLVENCY: [
    'insolvencia-completa',
    'insolvencia-minima',
    'insolvencia-acuerdo-aprobado',
    'insolvencia-fracaso-con-datos',
    'insolvencia-desistimiento',
    'insolvencia-xss',
  ],
  CONCILIATION: [
    'conciliacion-basica',
    'conciliacion-con-fechas',
    'conciliacion-varios-menores',
    'conciliacion-xss',
  ],
  SUPPORT_AGREEMENT: ['apoyo-completo', 'apoyo-minimo'],
};

interface RenderEntry {
  /** Hash del HTML de la plantilla (para distinguir "cambió la plantilla" de "cambió el mapper"). */
  t: string;
  /** Hash del HTML renderizado. */
  h: string;
  /** Placeholders que la plantilla usa y el mapper no produce. */
  u: string[];
}

function computeRender(): Record<string, RenderEntry> {
  const out: Record<string, RenderEntry> = {};
  const built = new Map<
    string,
    { placeholders: Record<string, string>; extra?: Record<string, unknown> }
  >();

  for (const template of ALL_TEMPLATES) {
    const file = path.join(process.cwd(), getTemplatePath(template));
    if (!fs.existsSync(file)) {
      out[`${template.caseType}/${template.id}`] = {
        t: 'ARCHIVO-NO-ENCONTRADO',
        h: '',
        u: [],
      };
      continue;
    }
    // Finales de línea normalizados a LF: en Windows (autocrlf) las plantillas se
    // descargan con CRLF y en Linux/CI con LF; sin esto el hash cambiaría según el
    // sistema operativo aunque nadie tocara nada.
    const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    for (const name of RENDER_SCENARIOS[template.caseType]) {
      if (!built.has(name)) {
        const caseData = SCENARIOS[name].build();
        built.set(name, {
          placeholders: mapCaseToPlaceholders(caseData as never),
          extra:
            template.caseType === 'CONCILIATION'
              ? buildConciliationContext(caseData as never)
              : undefined,
        });
      }
      const { placeholders, extra } = built.get(name)!;
      const rendered = renderDocumentHtml(html, placeholders, extra);
      out[`${template.caseType}/${template.id}|${name}`] = {
        t: short(html),
        h: short(rendered.html),
        u: [...rendered.unresolved].sort(),
      };
    }
  }
  return out;
}

describe('golden master — render de cada plantilla', () => {
  it('cubre todas las plantillas registradas (INSOLVENCY, CONCILIATION, SUPPORT_AGREEMENT)', () => {
    const byType = (t: ScenarioKind) =>
      ALL_TEMPLATES.filter((x) => x.caseType === t).length;
    expect(byType('INSOLVENCY')).toBeGreaterThanOrEqual(50);
    expect(byType('CONCILIATION')).toBeGreaterThan(10);
    expect(byType('SUPPORT_AGREEMENT')).toBeGreaterThan(2);
  });

  it('el HTML renderizado de cada plantilla × escenario no cambia', () => {
    const actual = computeRender();

    if (UPDATE) {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.writeFileSync(RENDER_FILE, serialize(actual));
      return;
    }
    if (!fs.existsSync(RENDER_FILE))
      throw new Error(`Falta ${path.basename(RENDER_FILE)}.${HINT}`);
    const expected: Record<string, RenderEntry> = JSON.parse(
      fs.readFileSync(RENDER_FILE, 'utf8'),
    );

    const templateChanged: string[] = [];
    const renderChanged: string[] = [];
    for (const key of new Set([
      ...Object.keys(expected),
      ...Object.keys(actual),
    ])) {
      const e = expected[key];
      const a = actual[key];
      if (!e) renderChanged.push(`+ ${key}  (combinación nueva)`);
      else if (!a) renderChanged.push(`- ${key}  (ya no se renderiza)`);
      else if (e.t !== a.t) templateChanged.push(key.split('|')[0]);
      else if (e.h !== a.h)
        renderChanged.push(`~ ${key}  el HTML renderizado cambió`);
      else if (JSON.stringify(e.u) !== JSON.stringify(a.u))
        renderChanged.push(
          `~ ${key}  placeholders sin resolver: era [${e.u}] ahora [${a.u}]`,
        );
    }

    const templates = [...new Set(templateChanged)];
    if (templates.length) {
      renderChanged.unshift(
        `(la PLANTILLA cambió, no el mapper, en: ${templates.join(', ')})`,
      );
    }
    expectNoDiff('render de plantillas', renderChanged);
  });
});

// ---------------------------------------------------------------------------
// 3) Comportamiento conocido (documentado, NO aprobado)
// ---------------------------------------------------------------------------

describe('Zona horaria: el día ya no retrocede entre las 00:00 y las 05:00 (hora de Colombia)', () => {
  /**
   * Hallazgo 1 (PR #43). nowColombia() pre-convertía a hora de Colombia y LUEGO
   * los helpers (getDayNumber, formatDate…) volvían a convertir con
   * `timeZone: 'America/Bogota'` — doble conversión. En un servidor UTC, entre las
   * 00:00 y las 05:00 hora de Colombia, el día salía retrocedido un día.
   *
   * Fix: `nowColombia()` ahora devuelve el instante real (sin pre-conversión);
   * los helpers de `placeholders/format.ts` siguen haciendo su única conversión,
   * como ya hacían correctamente con cualquier fecha guardada en el caso
   * (`admissionDate`, `filingDate`, etc.) — esos ~50 usos no se tocaron.
   *
   * Este test antes fijaba el bug ("sale 15, debería ser 16"); ahora fija el
   * comportamiento correcto. Si vuelve a romperse, es una regresión real.
   */
  const build = () => SCENARIOS['insolvencia-completa'].build();

  afterEach(() => {
    jest.setSystemTime(NOW);
  });

  it('a las 12:00 en Bogotá (mediodía) el día es el correcto', () => {
    jest.setSystemTime(new Date('2026-03-16T17:00:00Z')); // 16-mar 12:00 COT
    const p = mapCaseToPlaceholders(build() as never);
    expect(p.DIA).toBe('16');
    expect(p.FECHA_COMPLETA).toBe('16 de marzo de 2026');
  });

  it('a las 03:00 en Bogotá, el día ya NO retrocede (antes salía 15)', () => {
    jest.setSystemTime(new Date('2026-03-16T08:00:00Z')); // 16-mar 03:00 COT
    const p = mapCaseToPlaceholders(build() as never);
    expect(p.DIA).toBe('16');
    expect(p.FECHA_COMPLETA).toBe('16 de marzo de 2026');
    expect(p.NUMERO_DIA_LETRAS).toBe('dieciseis');
  });

  it('año nuevo: a las 23:00 del 31-dic en Bogotá (04:00 UTC del 1-ene), el año sigue siendo el anterior', () => {
    // Cubre ANO_ACUERDO / ANO_FIRMA / ANO_ACTUAL, que antes leían .getFullYear()
    // crudo apoyados en la pre-conversión de nowColombia() — también había que
    // corregirlos al sacarla, o hubieran roto este caso (antes invisible: la fecha
    // congelada del golden, 15-mar, nunca cruza fin de año).
    jest.setSystemTime(new Date('2026-01-01T04:00:00Z')); // 31-dic 23:00 COT
    const p = mapCaseToPlaceholders(build() as never);
    expect(p.ANO_ACUERDO).toBe('2025');
    expect(p.ANO_FIRMA).toBe('2025');
    expect(p.ANO_ACTUAL).toBe('2025');
  });

  it('año nuevo en conciliación: ANO_ACTA sigue siendo el año anterior', () => {
    // ANO_ACTA sale de mapConciliationFields (spreadeado en mapCaseToPlaceholders
    // solo para type === 'CONCILIATION'), no de buildConciliationContext (que solo
    // arma el contexto de los bloques {{#each}}, sin fechas).
    jest.setSystemTime(new Date('2026-01-01T04:00:00Z')); // 31-dic 23:00 COT
    const p = mapCaseToPlaceholders(
      SCENARIOS['conciliacion-basica'].build() as never,
    );
    expect(p.ANO_ACTA).toBe('2025');
  });
});
