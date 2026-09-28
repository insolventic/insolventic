/**
 * Bug B (investigación en el chat de esta sesión, no en PR #43).
 *
 * `renderDocumentHtml` escanea el HTML fuente para decidir qué `{{VARIABLE}}` la
 * plantilla referencia pero el mapper no produce ("unresolved" — bloquea la
 * generación, ver actions.ts). Para no reportar falsos faltantes en variables que
 * viven DENTRO de un bloque `{{#if}}`/`{{#each}}` (se resuelven contra el scope
 * del bloque, no contra el contexto raíz), el escaneo intentaba excluirlas — pero
 * el regex usado (`\{\{#\s*[A-Za-z0-9_]+\s*\}\}`) solo reconoce un token después
 * de `#` (`{{#NOMBRE}}`). La sintaxis real de `handlebars-lite.ts` siempre usa DOS
 * tokens (`{{#if FLAG}}`, `{{#each LISTA}}`), que ese regex nunca matchea — así
 * que el contenido de CUALQUIER bloque quedaba "visible" para el escaneo.
 *
 * En la práctica esto solo bloqueaba una plantilla real: "Acuerdo de Apoyo.html"
 * (NUMERO_CLAUSULA/TEXTO_CLAUSULA, solo existen dentro de {{#each CLAUSULAS_APOYO}},
 * nunca como clave plana). Las otras 10 plantillas con bloques nunca lo notaron
 * porque además de la clave de arreglo, sus mappers también dejan la misma clave
 * como valor plano en la raíz (redundancia deliberada) — el bug seguía ahí, pero
 * enmascarado.
 */
import fs from 'fs';
import path from 'path';

import { renderDocumentHtml } from '@/features/document/placeholder-mapper';

describe('detector de placeholders sin resolver: reconoce {{#if X}}/{{#each X}} de dos tokens', () => {
  it('if falso: la variable interna ya no se reporta (antes: sí)', () => {
    const html = `<p>{{#if FLAG}}<span>{{INNER}}</span>{{/if}}</p>`;
    const { unresolved, html: out } = renderDocumentHtml(html, {});
    expect(unresolved).not.toContain('INNER');
    expect(out).toBe('<p></p>');
  });

  it('each vacío: la variable del ítem ya no se reporta (antes: sí)', () => {
    const html = `<ul>{{#each LIST}}<li>{{INNER}}</li>{{/each}}</ul>`;
    const { unresolved, html: out } = renderDocumentHtml(html, {});
    expect(unresolved).not.toContain('INNER');
    expect(out).toBe('<ul></ul>');
  });

  it('each con datos: la variable del ítem se resuelve por el ítem, no queda sin resolver', () => {
    const html = `<ul>{{#each LIST}}<li>{{INNER}}</li>{{/each}}</ul>`;
    const { unresolved, html: out } = renderDocumentHtml(html, {
      LIST: [{ INNER: 'uno' }, { INNER: 'dos' }],
    });
    expect(unresolved).not.toContain('INNER');
    expect(out).toBe('<ul><li>uno</li><li>dos</li></ul>');
  });

  it('unless: igual que if, no reporta la variable interna', () => {
    const html = `<p>{{#unless FLAG}}<span>{{INNER}}</span>{{/unless}}</p>`;
    const { unresolved } = renderDocumentHtml(html, {});
    expect(unresolved).not.toContain('INNER');
  });

  it('cierre con identificador ({{/if NOMBRE}}), como en las plantillas reales', () => {
    const html = `<!-- {{#if FLAG}} --><span>{{INNER}}</span><!-- {{/if FLAG}} -->`;
    const { unresolved } = renderDocumentHtml(html, {});
    expect(unresolved).not.toContain('INNER');
  });

  it('bloques anidados: cada nivel se excluye, no solo el más externo', () => {
    const html = `{{#if OUTER}}{{#each LIST}}<li>{{INNER}}</li>{{/each}}{{/if}}`;
    const { unresolved } = renderDocumentHtml(html, {});
    expect(unresolved).not.toContain('INNER');
  });

  it('una variable de verdad sin resolver, FUERA de cualquier bloque, sigue reportándose', () => {
    const html = `<p>{{#if FLAG}}<span>{{INNER}}</span>{{/if}}</p><p>{{FALTANTE}}</p>`;
    const { unresolved } = renderDocumentHtml(html, {});
    expect(unresolved).toEqual(['FALTANTE']);
  });

  it('no confunde tipos de bloque (if que cierra con /each no se excluye entero)', () => {
    // Este caso es deliberadamente malformado (no ocurre en las plantillas reales);
    // solo fija que el stripper no cruza tipos de bloque distintos.
    const html = `{{#if FLAG}}{{INNER}}{{/each}}`;
    const { unresolved } = renderDocumentHtml(html, {});
    expect(unresolved).toContain('INNER');
  });
});

describe('Acuerdo de Apoyo.html ya no bloquea por NUMERO_CLAUSULA/TEXTO_CLAUSULA', () => {
  const TEMPLATE_PATH = path.join(
    process.cwd(),
    'templates/support-agreements/Acuerdo de Apoyo.html',
  );
  const html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  it('sin cláusulas cargadas: la sección no aparece, y ya no bloquea', () => {
    const { unresolved, html: out } = renderDocumentHtml(html, {
      TIENE_CLAUSULAS_APOYO: 'NO',
      CLAUSULAS_APOYO: [],
    });
    expect(unresolved).not.toContain('NUMERO_CLAUSULA');
    expect(unresolved).not.toContain('TEXTO_CLAUSULA');
    // El título "CLÁUSULAS" es estático y siempre sale (queda dentro de un
    // {{#if TIENE_CLAUSULAS_APOYO}} más externo que no probamos acá); lo que
    // no debe aparecer es el contenido POR CLÁUSULA del {{#each}} vacío.
    expect(out).not.toContain('clausula-item');
  });

  it('con cláusulas cargadas: se resuelven por ítem y tampoco bloquea', () => {
    const { unresolved, html: out } = renderDocumentHtml(html, {
      TIENE_CLAUSULAS_APOYO: 'SI',
      CLAUSULAS_APOYO: [
        {
          NUMERO_CLAUSULA: 'PRIMERA',
          TEXTO_CLAUSULA: 'El apoyo consiste en...',
        },
        { NUMERO_CLAUSULA: 'SEGUNDA', TEXTO_CLAUSULA: 'El plazo será de...' },
      ],
    });
    expect(unresolved).not.toContain('NUMERO_CLAUSULA');
    expect(unresolved).not.toContain('TEXTO_CLAUSULA');
    expect(out).toContain('CLÁUSULA PRIMERA.');
    expect(out).toContain('El apoyo consiste en...');
    expect(out).toContain('CLÁUSULA SEGUNDA.');
  });
});
