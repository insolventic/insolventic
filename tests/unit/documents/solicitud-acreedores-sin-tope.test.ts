/**
 * La Solicitud de Insolvencia lista TODOS los acreedores del caso.
 *
 * Paso 3 de `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`. Antes la plantilla
 * tenía tres fichas de acreedor escritas a mano (`Acreedor No. 1/2/3`) y un
 * cuadro resumen de 10 renglones, contra un tope legal de 150 acreedores: un
 * caso con 4 radicaba un documento donde el cuarto no tenía ficha, sin aviso.
 *
 * El golden master cubre el hash del render, pero un hash no dice CUÁNTAS fichas
 * salieron. Este test lo cuenta, y por eso es el que demuestra que el tope se
 * fue.
 */

import fs from 'fs';

import {
  mapCaseToPlaceholders,
  renderDocumentHtml,
  buildTemplateContext,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

const template = ALL_TEMPLATES.find((t) => t.id === 'solicitud-insolvencia')!;
const HTML = fs.readFileSync(getTemplatePath(template), 'utf-8');

/** Renderiza la Solicitud como lo hace el pipeline: placeholders + contexto. */
function render(scenario: string) {
  const caseData = SCENARIOS[scenario].build() as never;
  const placeholders = mapCaseToPlaceholders(caseData);
  const rendered = renderDocumentHtml(
    HTML,
    placeholders,
    buildTemplateContext(caseData),
  );
  return {
    html: rendered.html,
    unresolved: rendered.unresolved,
    fichas: (rendered.html.match(/acreedor-title/g) ?? []).length,
    deudas: (caseData as { debts: unknown[] }).debts.length,
  };
}

describe('Solicitud de Insolvencia — todos los acreedores', () => {
  it('con 13 deudas salen 13 fichas, no 3', () => {
    // `insolvencia-muchos` existe justamente para exceder los slots: 13 deudas
    // contra los 11 que producía el mapper y las 3 fichas de la plantilla.
    const r = render('insolvencia-muchos');

    expect(r.deudas).toBe(13);
    expect(r.fichas).toBe(13);
  });

  it('el número de fichas sigue a la cantidad de deudas en cada escenario', () => {
    for (const scenario of [
      'insolvencia-completa',
      'insolvencia-minima',
      'insolvencia-muchos',
    ]) {
      const r = render(scenario);
      expect({ scenario, fichas: r.fichas }).toEqual({
        scenario,
        fichas: r.deudas,
      });
    }
  });

  it('el cuadro resumen tampoco topa en 10 renglones', () => {
    const r = render('insolvencia-muchos');

    // Se acota a la tabla de acreencias: contar `<tr><td>N</td>` sobre todo el
    // documento arrastraba las 12 filas de la tabla de causas.
    const tabla = r.html.slice(
      r.html.indexOf('table-acreencias'),
      r.html.indexOf('</table>', r.html.indexOf('table-acreencias')),
    );
    const filas = (tabla.match(/<tr><td>\d+<\/td><td>/g) ?? []).length;

    expect(filas).toBe(13);
  });

  it('los 13 nombres aparecen, no solo los primeros', () => {
    const r = render('insolvencia-muchos');
    const caseData = SCENARIOS['insolvencia-muchos'].build() as {
      debts: Array<{ creditor: { name: string } }>;
    };

    const faltantes = caseData.debts
      .map((d) => d.creditor.name)
      .filter((nombre) => !r.html.includes(nombre));

    expect(faltantes).toEqual([]);
  });

  it('no quedan slots numerados en la plantilla', () => {
    // Si alguien reintroduce un AC4_NOMBRE o un ACREEDOR_11, vuelve el tope.
    expect(HTML).not.toMatch(/\{\{AC\d+_/);
    expect(HTML).not.toMatch(
      /\{\{(ACREEDOR|VALOR|LIBRANZA|CLASE|DIAS)_\d+\}\}/,
    );
  });

  it('el gate de placeholders sin resolver sigue limpio', () => {
    // Es lo que bloquea la generación: un {{VAR}} que el mapper no produce.
    for (const scenario of ['insolvencia-completa', 'insolvencia-muchos']) {
      expect({ scenario, u: render(scenario).unresolved }).toEqual({
        scenario,
        u: [],
      });
    }
  });

  it('un caso sin acreedores no deja fichas huérfanas ni rompe el render', () => {
    const caseData = SCENARIOS['insolvencia-completa'].build() as never;
    const sinDeudas = { ...(caseData as object), debts: [] } as never;

    const rendered = renderDocumentHtml(
      HTML,
      mapCaseToPlaceholders(sinDeudas),
      buildTemplateContext(sinDeudas),
    );

    expect((rendered.html.match(/acreedor-title/g) ?? []).length).toBe(0);
    expect(rendered.unresolved).toEqual([]);
    // El encabezado de la sección sigue, con la tabla vacía.
    expect(rendered.html).toContain('3. LOS ACREEDORES');
  });
});

/**
 * CYG Trámite — misma migración, otra plantilla.
 *
 * Es la tabla de Calificación y Graduación que se firma en la audiencia: una
 * fila por acreedor, con columna de firma. Tenía 11 filas impresas, así que un
 * caso con 12 acreedores llegaba a la audiencia con dos sin renglón donde
 * firmar.
 */
describe('CYG Trámite — todos los acreedores', () => {
  const cyg = ALL_TEMPLATES.find((t) => t.id === 'cyg-tramite')!;
  const CYG_HTML = fs.readFileSync(getTemplatePath(cyg), 'utf-8');

  function renderCyg(scenario: string) {
    const caseData = SCENARIOS[scenario].build() as never;
    const rendered = renderDocumentHtml(
      CYG_HTML,
      mapCaseToPlaceholders(caseData),
      buildTemplateContext(caseData),
    );
    return {
      html: rendered.html,
      unresolved: rendered.unresolved,
      filas: (rendered.html.match(/class="fila-acreedor"/g) ?? []).length,
      deudas: (caseData as { debts: unknown[] }).debts.length,
    };
  }

  it('con 13 deudas salen 13 filas, no 11', () => {
    const r = renderCyg('insolvencia-muchos');
    expect(r.deudas).toBe(13);
    expect(r.filas).toBe(13);
  });

  it('el número de filas sigue a la cantidad de deudas', () => {
    for (const scenario of ['insolvencia-completa', 'insolvencia-muchos']) {
      const r = renderCyg(scenario);
      expect({ scenario, filas: r.filas }).toEqual({
        scenario,
        filas: r.deudas,
      });
    }
  });

  it('no quedan slots numerados', () => {
    expect(CYG_HTML).not.toMatch(/\{\{AC\d+_/);
    expect(CYG_HTML).not.toMatch(/\{\{(ACREEDOR|PORCENTAJE)_\d+\}\}/);
  });

  it('el gate de no-resueltos sigue limpio', () => {
    expect(renderCyg('insolvencia-muchos').unresolved).toEqual([]);
  });
});
