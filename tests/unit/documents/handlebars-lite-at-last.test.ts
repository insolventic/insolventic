/**
 * `{{#unless @last}}` en "Acta Union Marital.html" (hallazgo anotado al margen del
 * Bug B, PR #50; confirmado y arreglado acá).
 *
 * El motor (`handlebars-lite.ts`) solo reconocía nombres `[A-Za-z0-9_]+` como clave
 * de bloque — `@last` (con `@`) nunca matcheaba `UNLESS_BLOCK_RE`, así que ese
 * `{{#unless @last}}` no se resolvía ni como bloque independiente. Eso NO es solo
 * "el separador queda literal": como `resolveBlocks` solo puede pelar un bloque
 * cuando su cuerpo no contiene NINGÚN `{{#if/each/unless` sin resolver, el
 * `{{#each MENORES_UNION}}` que lo envuelve tampoco lograba resolverse jamás (en
 * ninguna de las 32 pasadas) — con 2+ menores, el HTML final queda con la sintaxis
 * de bloque literal y {{NOMBRE_MENOR_UNION}} sale UNA sola vez (el valor de
 * respaldo de la raíz, no iterado), no la lista completa.
 *
 * Con 0 o 1 menor el bug es invisible: {{#unless @last}} nunca se ejecuta (0 items)
 * o su resultado da igual (no hay a quién separar), así que el `{{#each}}` sigue
 * atascado pero el único {{NOMBRE_MENOR_UNION}} de respaldo "tapa" el problema.
 *
 * Fix: los tags de bloque if/unless ahora aceptan `@` en el nombre de la clave, y
 * el handler de {{#each}} resuelve los `{{#if @X}}`/`{{#unless @X}}` anidados
 * usando el índice REAL del ítem (así el separador falta solo en el último, no en
 * todos por igual) antes de sustituir el resto de las variables del ítem.
 * @first/@index NO se agregan: no los usa ninguna de las 65 plantillas ni los
 * soporta el motor en ningún otro lado (grep confirmado).
 */
import fs from 'fs';
import path from 'path';

import { renderTemplate } from '@/features/document/handlebars-lite';
import {
  buildConciliationContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

const TEMPLATE = `{{#each MENORES_UNION}}<strong>{{NOMBRE_MENOR_UNION}}</strong>{{#unless @last}}, {{/unless}}{{/each}}`;

describe('{{#unless @last}} dentro de {{#each}} (handlebars-lite)', () => {
  it('0 menores: no renderiza nada, sin sintaxis literal', () => {
    const out = renderTemplate(TEMPLATE, { MENORES_UNION: [] });
    expect(out).toBe('');
  });

  it('1 menor: sale solo, sin separador y sin sintaxis literal', () => {
    const out = renderTemplate(TEMPLATE, {
      MENORES_UNION: [{ NOMBRE_MENOR_UNION: 'Mateo' }],
    });
    expect(out).toBe('<strong>Mateo</strong>');
    expect(out).not.toContain('{{');
  });

  it('2 menores: los dos listados, separador solo entre ellos (no al final)', () => {
    const out = renderTemplate(TEMPLATE, {
      MENORES_UNION: [
        { NOMBRE_MENOR_UNION: 'Mateo' },
        { NOMBRE_MENOR_UNION: 'Valentina' },
      ],
    });
    expect(out).toBe('<strong>Mateo</strong>, <strong>Valentina</strong>');
    expect(out).not.toContain('{{');
  });

  it('3 menores: los tres listados, separador entre cada par, no después del último', () => {
    const out = renderTemplate(TEMPLATE, {
      MENORES_UNION: [
        { NOMBRE_MENOR_UNION: 'Mateo' },
        { NOMBRE_MENOR_UNION: 'Valentina' },
        { NOMBRE_MENOR_UNION: 'Samuel' },
      ],
    });
    expect(out).toBe(
      '<strong>Mateo</strong>, <strong>Valentina</strong>, <strong>Samuel</strong>',
    );
    expect(out).not.toContain('{{');
    // Regresión directa del bug: no debe quedar el marcador de bloque crudo.
    expect(out).not.toContain('@last');
  });

  it('@first/@index no están soportados a propósito (fuera de alcance: no los usa ninguna plantilla)', () => {
    const out = renderTemplate(
      `{{#each L}}{{#if @first}}PRIMERO {{/if}}{{V}}{{/each}}`,
      { L: [{ V: 'a' }, { V: 'b' }] },
    );
    // @first no se computa: el bloque queda igual que un {{#if}} con clave
    // ausente en el contexto (isTruthy(undefined) = false → se omite el cuerpo).
    expect(out).toBe('ab');
  });
});

describe('la plantilla real ("Acta Union Marital.html") ya lista los 3 menores', () => {
  it('sin sintaxis literal y con el separador correcto entre cada par', () => {
    const html = fs.readFileSync(
      path.join(
        process.cwd(),
        'templates/conciliation/Actas de Conciliacion/Acta Union Marital.html',
      ),
      'utf8',
    );
    const caseData = SCENARIOS['conciliacion-varios-menores'].build() as never;
    const p = mapCaseToPlaceholders(caseData);
    const extraCtx = buildConciliationContext(caseData);
    const { html: out, unresolved } = renderDocumentHtml(html, p, extraCtx);
    expect(unresolved).toEqual([]);
    expect(out).not.toContain('{{');
    expect(out).not.toContain('@last');
    // Los 3 nombres aparecen, en orden, cada uno separado del siguiente por ",".
    const section = out.slice(
      out.indexOf('menor(es)'),
      out.indexOf('menor(es)') + 400,
    );
    const nombres = [...section.matchAll(/<strong>([^<]+)<\/strong>/g)].map(
      (m) => m[1],
    );
    expect(nombres).toEqual([
      'Mateo Rojas Peña',
      'Valentina Rojas Peña',
      'Samuel Rojas Peña',
    ]);
    // Coma después del 1° y 2°, ninguna después del 3° (el último).
    expect(section).toMatch(/Mateo Rojas Peña<\/strong>,/);
    expect(section).toMatch(/Valentina Rojas Peña<\/strong>,/);
    expect(section).not.toMatch(/Samuel Rojas Peña<\/strong>\s*,/);
    // NOTA (hallazgo aparte, no arreglado acá): la plantilla envuelve
    // "{{#each MENORES_UNION}}" en un comentario con texto explicativo
    // ("<!-- ITERABLE: {{#each ...}} -->", una sola línea) en vez del patrón
    // limpio que usa en sus otros bloques ("<!-- {{#each ...}} -->", sin texto
    // adentro). Como el motor no entiende HTML, el "-->' final de ESE comentario
    // queda dentro del cuerpo del each y se repite en cada ítem — con 2+ menores
    // sale un "-->" suelto entre cada nombre. Antes de este fix era invisible
    // porque el bloque nunca llegaba a ejecutar. Es un problema de autoría de la
    // plantilla, no del motor; no se toca en este PR.
    expect(section).toContain('-->');
  });
});
