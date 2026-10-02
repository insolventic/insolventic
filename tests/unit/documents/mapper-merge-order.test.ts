/**
 * Contrato del ORDEN DE FUSIÓN del mapper de placeholders.
 *
 * `mapCaseToPlaceholders` junta el literal `basePlaceholders` con ~22 sub-mappers
 * usando `...spread`: cuando dos emiten la misma clave, GANA EL ÚLTIMO. Hay 16
 * claves así. Cualquier refactor que reordene los spreads, o que mueva un mapper
 * a otro módulo y cambie cuándo se aplica, cambiaría el documento final sin que
 * ningún tipo ni ningún test de una sola clave lo note.
 *
 * Este archivo hace dos cosas distintas:
 *
 *  1. ESTÁTICO (AST del código fuente): el orden exacto de fusión y la lista
 *     completa de colisiones están escritos aquí. Si alguien agrega una clave a
 *     dos mappers, o cambia el orden, el test falla hasta que se documente.
 *  2. DE COMPORTAMIENTO: para cada colisión visible, qué valor gana y por qué,
 *     con un caso donde las dos fuentes emiten valores DISTINTOS.
 *
 * Varias colisiones son "cosméticas" (las dos fuentes dan lo mismo) y otras son
 * comportamientos raros que hoy están así (marcados "CONOCIDO"): se fijan tal
 * cual para que un refactor no los cambie sin querer. Arreglarlos es una
 * decisión aparte.
 *
 * Al dividir placeholder-mapper.ts en módulos, la parte estática (que hoy lee un
 * solo archivo) hay que actualizarla para seguir a los mappers; el golden master
 * (mapper-golden.test.ts) es la red que no depende de dónde viva el código.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

// ---------------------------------------------------------------------------
// 1) Estático: orden de fusión y colisiones, leídos del código fuente
// ---------------------------------------------------------------------------

const MAPPER_FILE = path.join(
  process.cwd(),
  'src/features/document/placeholder-mapper.ts',
);

/** Orden EXACTO en que se fusionan (el último gana). */
const EXPECTED_MERGE_ORDER = [
  'basePlaceholders',
  'mapApplicantScope',
  'mapCauses',
  'mapDebts',
  'mapAssets',
  'mapLegalProcesses',
  'mapLibranzas',
  'mapSuspendedServices',
  'mapDependents',
  'mapPaymentProposal',
  'mapCheckList',
  'mapIncomeDeclaration',
  'mapExtendedDates',
  'mapExternalEntities',
  'mapAgreementResult',
  'mapDynamicTables',
  'mapFracasoVariables',
  'mapSentidoVotoVariables',
  'mapAcreedoresDefinitivo',
  'mapBienesDefinitivo',
  'mapProcesosJudicialesDefinitivo',
  'mapFormularioDefinitivoFields',
  'mapConciliationFields', // solo CONCILIATION
  'mapApoyoFields', // solo SUPPORT_AGREEMENT
];

/** clave → fuentes, de la primera a la última (gana la última). */
const EXPECTED_COLLISIONS: Record<string, string[]> = {
  // Bloque base vs sub-mapper
  ANO_FIRMA: ['basePlaceholders', 'mapAgreementResult'],
  CUADRO_CALIFICACION_GRADUACION: ['basePlaceholders', 'mapDynamicTables'],
  DETALLE_BIENES: ['basePlaceholders', 'mapDynamicTables'],
  DETALLE_PAGO_CAPITAL: ['basePlaceholders', 'mapDynamicTables'],
  FORMA_PAGO_ACREEDORES: ['basePlaceholders', 'mapDynamicTables'],
  PROYECCION_PAGOS: ['basePlaceholders', 'mapDynamicTables'],
  NOMBRE_CONVOCANTE: ['basePlaceholders', 'mapConciliationFields'],
  // Entre sub-mappers
  TIPO_SOLICITANTE: ['mapApplicantScope', 'mapAgreementResult'],
  ANO_CONSTANCIA: [
    'mapExtendedDates',
    'mapFracasoVariables',
    'mapConciliationFields',
  ],
  ANO_BILATERAL: ['mapExtendedDates', 'mapFracasoVariables'],
  NUMERO_CONSTANCIA: ['mapExtendedDates', 'mapFracasoVariables'],
  ANO_DESISTIMIENTO: ['mapExtendedDates', 'mapConciliationFields'],
  DIA_DESISTIMIENTO: ['mapExtendedDates', 'mapConciliationFields'],
  MES_DESISTIMIENTO: ['mapExtendedDates', 'mapConciliationFields'],
  NUMERO_JUZGADO: ['mapExternalEntities', 'mapFracasoVariables'],
  RADICADO_BILATERAL: ['mapExternalEntities', 'mapFracasoVariables'],
};

/**
 * Junta las `FunctionDeclaration` de un archivo con las de cualquier módulo
 * relativo bajo `placeholders/` que importe, RECURSIVO: sigue tanto
 * `./placeholders/*` (desde `placeholder-mapper.ts`) como los imports entre
 * sub-mappers (`./otro-sub-mapper`, desde dentro de `placeholders/`), acotado
 * a esa carpeta para no seguir también vecinos de `document/` como
 * `handlebars-lite`. Así el contrato sigue viendo los sub-mappers sin
 * importar cuántos pasos de división los muevan.
 *
 * Hasta el Paso 8 alcanzaba con una sola pasada. El Paso 9 introdujo el
 * primer import entre sub-mappers (`tablas-dinamicas-pagos.ts` importa de
 * `html-builders.ts`, dos niveles desde `placeholder-mapper.ts`) — no afecta
 * a este contrato porque ninguna clave de `EXPECTED_COLLISIONS` involucra a
 * los `generate*`, pero se hace recursivo igual, por consistencia con
 * `html-escape-guard.test.ts` (que sí lo necesitó) y para no dejar la misma
 * limitación sin corregir en los dos archivos.
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

function analyzeMapperSource() {
  const text = fs.readFileSync(MAPPER_FILE, 'utf8');
  const functions = collectFunctions(MAPPER_FILE, text);
  const orchestrator = functions.get('mapCaseToPlaceholders')!;

  const staticKeys = (obj: ts.ObjectLiteralExpression) =>
    obj.properties
      .filter((p) => p.name && !ts.isSpreadAssignment(p))
      .map((p) => p.name!.getText().replace(/['"]/g, ''));

  // Claves del literal `basePlaceholders`.
  let base: string[] = [];
  const findBase = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      n.name.getText() === 'basePlaceholders' &&
      n.initializer &&
      ts.isObjectLiteralExpression(n.initializer)
    ) {
      base = staticKeys(n.initializer);
    }
    ts.forEachChild(n, findBase);
  };
  findBase(orchestrator);

  // Orden de los spreads dentro de `escapeAllUnlessHtml({ ... })`.
  const order: string[] = ['basePlaceholders'];
  const findMerge = (n: ts.Node) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText() === 'escapeAllUnlessHtml' &&
      n.arguments[0] &&
      ts.isObjectLiteralExpression(n.arguments[0])
    ) {
      for (const p of n.arguments[0].properties) {
        if (!ts.isSpreadAssignment(p)) continue;
        const names: string[] = [];
        const collect = (x: ts.Node) => {
          if (ts.isCallExpression(x) && functions.has(x.expression.getText())) {
            names.push(x.expression.getText());
          }
          ts.forEachChild(x, collect);
        };
        collect(p.expression);
        for (const name of names) if (!order.includes(name)) order.push(name);
      }
    }
    ts.forEachChild(n, findMerge);
  };
  findMerge(orchestrator);

  // Claves estáticas que devuelve cada sub-mapper (sus `return { ... }`).
  const returned = (fn: ts.FunctionDeclaration) => {
    const keys = new Set<string>();
    const visit = (n: ts.Node) => {
      if (n !== fn && ts.isFunctionLike(n)) return;
      if (
        ts.isReturnStatement(n) &&
        n.expression &&
        ts.isObjectLiteralExpression(n.expression)
      ) {
        staticKeys(n.expression).forEach((k) => keys.add(k));
      }
      ts.forEachChild(n, visit);
    };
    if (fn.body) visit(fn.body);
    return keys;
  };

  const owners = new Map<string, string[]>();
  for (const source of order) {
    const keys =
      source === 'basePlaceholders'
        ? new Set(base)
        : returned(functions.get(source)!);
    for (const key of keys)
      owners.set(key, [...(owners.get(key) ?? []), source]);
  }
  const collisions: Record<string, string[]> = {};
  for (const [key, sources] of owners)
    if (sources.length > 1) collisions[key] = sources;

  return { order, collisions };
}

describe('orden de fusión — lectura estática del código fuente', () => {
  const { order, collisions } = analyzeMapperSource();

  it('los sub-mappers se fusionan en este orden exacto (el último gana)', () => {
    expect(order).toEqual(EXPECTED_MERGE_ORDER);
  });

  it('las colisiones de claves entre fuentes son exactamente estas 16', () => {
    // Si falla porque APARECIÓ una colisión nueva: alguien agregó una clave que otro
    // mapper ya emite. Decidí quién debe ganar, documentala arriba y agregá un caso
    // de comportamiento abajo. Si DESAPARECIÓ una: quitala de la lista.
    //
    // 21 → 19: ANO_INICIO_PAGO/ANO_VIGENCIA dejaron de colisionar al sacar los
    // stubs vacíos de mapExtendedDates (Hallazgo 2, ver "bloque base < mapExtendedDates"
    // más abajo) — ya no hay dos fuentes emitiendo esas claves, solo el bloque base.
    //
    // 19 → 16: ANO_FRACASO/DIA_FRACASO/MES_FRACASO dejaron de colisionar al sacar
    // sus stubs de mapExtendedDates (issue #18 / PR #24) — eran código muerto:
    // mapFracasoVariables se fusiona después y siempre ganaba, así que el
    // documento nunca mostró el stub. Ver "mapFracasoVariables: DIA/MES/ANO_FRACASO"
    // más abajo.
    expect(Object.keys(collisions).sort()).toEqual(
      Object.keys(EXPECTED_COLLISIONS).sort(),
    );
    for (const [key, sources] of Object.entries(EXPECTED_COLLISIONS)) {
      expect({ key, sources: collisions[key] }).toEqual({ key, sources });
    }
    expect(Object.keys(collisions)).toHaveLength(16);
  });
});

// ---------------------------------------------------------------------------
// 2) Comportamiento: quién gana en cada colisión
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-15T17:00:00Z'); // 12:00 en Bogotá
const run = (scenario: string) =>
  mapCaseToPlaceholders(SCENARIOS[scenario].build() as never);

beforeAll(() => {
  jest.useFakeTimers({ now: NOW });
});
afterAll(() => {
  jest.useRealTimers();
});

describe('TIPO_SOLICITANTE: mapApplicantScope < mapAgreementResult', () => {
  it('con el código del alcance, las dos fuentes coinciden', () => {
    const p = run('insolvencia-alcance-codigo');
    expect(p.TIPO_SOLICITANTE).toBe('Persona Natural Pequeño Comerciante');
    expect(p.APLICACION_PEQUENA_COMERCIANTE).toBe('SI');
  });

  it('CONOCIDO: con el alcance en texto libre, gana mapAgreementResult (solo entiende el código) y contradice a APLICACION_PEQUENA_COMERCIANTE', () => {
    const p = run('insolvencia-alcance-texto');
    // mapApplicantScope diría "Pequeño Comerciante"; mapAgreementResult lo pisa.
    expect(p.TIPO_SOLICITANTE).toBe('Persona Natural No Comerciante');
    expect(p.APLICACION_PEQUENA_COMERCIANTE).toBe('SI');
  });
});

describe('mapFracasoVariables: DIA/MES/ANO_FRACASO (issue #18 / PR #24, ya no colisiona)', () => {
  // Hasta el PR #24, mapExtendedDates también definía estas 3 claves (con la
  // fecha de hoy, o '' si faltaba) — código muerto, porque mapFracasoVariables
  // se fusiona después y siempre ganaba. El issue #18 lo había diagnosticado
  // como bug (el stub nunca llegaba al documento); PR #24 sacó el stub. Estos
  // tests fijan el valor real (el que siempre llegó al documento), ahora sin
  // una segunda fuente detrás.
  it('con fecha de fracaso, salen el día/mes/año DE ESA FECHA', () => {
    const p = run('insolvencia-fracaso-con-datos');
    expect(p.DIA_FRACASO).toBe('30');
    expect(p.MES_FRACASO).toBe('diciembre');
    expect(p.ANO_FRACASO).toBe('2025');
  });

  it('sin fecha de fracaso, salen las rayas (marcador para completar a mano)', () => {
    const p = run('insolvencia-fracaso-sin-datos');
    expect(p.DIA_FRACASO).toBe('____');
    expect(p.MES_FRACASO).toBe('____________');
    expect(p.ANO_FRACASO).toBe('______');
  });
});

describe('fracaso: mapExtendedDates < mapFracasoVariables (gana el segundo)', () => {
  it('NUMERO_CONSTANCIA sale con solo los dígitos del caso (mapExtendedDates daría el número completo)', () => {
    expect(run('insolvencia-fracaso-con-datos').NUMERO_CONSTANCIA).toBe(
      '2025117',
    );
    expect(run('insolvencia-fracaso-sin-datos').NUMERO_CONSTANCIA).toBe(
      '2025118',
    );
  });

  it('ANO_BILATERAL y ANO_CONSTANCIA: las dos fuentes dan el año de hoy', () => {
    const p = run('insolvencia-fracaso-con-datos');
    expect(p.ANO_BILATERAL).toBe('2026');
    expect(p.ANO_CONSTANCIA).toBe('2026');
  });
});

describe('mapExternalEntities < mapFracasoVariables (gana el segundo)', () => {
  it('con proceso judicial y acuerdo bilateral', () => {
    const p = run('insolvencia-fracaso-con-datos');
    expect(p.NUMERO_JUZGADO).toBe('11001-40-03-010-2025-00100');
    expect(p.RADICADO_BILATERAL).toBe('ACU-BIL-2025-09');
  });

  it('sin ellos salen las rayas del segundo (mapExternalEntities daría vacío)', () => {
    const p = run('insolvencia-fracaso-sin-datos');
    expect(p.NUMERO_JUZGADO).toBe('____');
    expect(p.RADICADO_BILATERAL).toBe('________________');
  });
});

describe('bloque base: ANO_INICIO_PAGO/ANO_VIGENCIA (Hallazgo 2, arreglado)', () => {
  it('ya NO salen vacíos — mapExtendedDates dejó de pisarlos (antes: FIX)', () => {
    const p = run('insolvencia-acuerdo-aprobado');
    // El bloque base los calcula desde paymentStartDate (2026) y agreementValidityDate
    // (2029); antes mapExtendedDates los pisaba con '' incondicionalmente (dos stubs
    // "Manual" que sobraban desde el commit inicial, 4 días antes de que se agregara
    // el cálculo real). Al sacar los stubs, ya no hay colisión: gana el único valor.
    expect(p.ANO_INICIO_PAGO).toBe('2026');
    expect(p.ANO_VIGENCIA).toBe('2029');
    // Los hermanos DIA_/MES_/FECHA_ (que nadie pisaba) seguían con valor y no cambian.
    expect(p.DIA_INICIO_PAGO).toBe('1');
    expect(p.MES_INICIO_PAGO).toBe('mayo');
    expect(p.FECHA_INICIO_PAGO).not.toBe('________________');
    expect(p.MES_VIGENCIA).toBe('mayo');
  });
});

describe('bloque base < mapAgreementResult', () => {
  it('ANO_FIRMA: las dos fuentes dan el año de hoy', () => {
    expect(run('insolvencia-completa').ANO_FIRMA).toBe('2026');
  });
});

describe('bloque base < mapDynamicTables (las tablas HTML reemplazan a los vacíos del base)', () => {
  it.each([
    'CUADRO_CALIFICACION_GRADUACION',
    'DETALLE_BIENES',
    'DETALLE_PAGO_CAPITAL',
    'FORMA_PAGO_ACREEDORES',
    'PROYECCION_PAGOS',
  ])('%s trae la tabla generada, no el vacío del bloque base', (key) => {
    const value = run('insolvencia-completa')[key];
    expect(value).not.toBe('');
    expect(value).toContain('<');
  });
});

describe('conciliación: mapConciliationFields va el último', () => {
  it('NOMBRE_CONVOCANTE: gana el convocante de la conciliación sobre el nombre del deudor del bloque base', () => {
    const p = run('conciliacion-basica');
    expect(p.NOMBRE_CONVOCANTE).toBe('Laura Patricia Gómez Díaz');
    expect(p.NOMBRE_DEUDOR).toBe('Carlos Andrés Rojas Peña');
  });

  it('desistimiento y constancia con fechas escritas: salen esas fechas', () => {
    const p = run('conciliacion-con-fechas');
    expect(p.DIA_DESISTIMIENTO).toBe('15');
    expect(p.MES_DESISTIMIENTO).toBe('febrero');
    expect(p.ANO_DESISTIMIENTO).toBe('2025');
    expect(p.ANO_CONSTANCIA).toBe('2026');
  });

  it('sin fechas escritas: caen a la fecha de hoy (gana mapConciliationFields, no importa qué calcule mapExtendedDates)', () => {
    const p = run('conciliacion-sin-fechas');
    expect(p.DIA_DESISTIMIENTO).toBe('15');
    expect(p.MES_DESISTIMIENTO).toBe('marzo');
    expect(p.ANO_DESISTIMIENTO).toBe('2026');
  });

  // PR #40: mapExtendedDates ahora deriva DIA/MES/ANO_DESISTIMIENTO de
  // resultDate (con fallback a hoy), igual que ANO_RADICADO con filingDate.
  // Antes quedaban vacíos ('' / '') salvo ANO, que caía a getYear(now). Solo
  // importa en insolvencia/apoyo: en conciliación siempre gana
  // mapConciliationFields (test de arriba).
  it('en insolvencia (sin mapConciliationFields) DIA/MES/ANO_DESISTIMIENTO salen de resultDate', () => {
    const p = run('insolvencia-desistimiento');
    expect(p.DIA_DESISTIMIENTO).toBe('1');
    expect(p.MES_DESISTIMIENTO).toBe('marzo');
    expect(p.ANO_DESISTIMIENTO).toBe('2026');
  });
});
