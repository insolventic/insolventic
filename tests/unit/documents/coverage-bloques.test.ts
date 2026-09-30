/**
 * `validatePlaceholderCoverage` no puede contar las variables de dentro de un
 * bloque `{{#each}}` / `{{#if}}` / `{{#unless}}`.
 *
 * Esas variables se resuelven contra el scope del bloque —el item del `each`—,
 * no contra el `PlaceholderMap` del mapper. Contarlas como variables de la
 * plantilla producía dos cosas, las dos falsas:
 *
 *  - entradas en `missing` de campos que el mapper no tiene por qué producir;
 *  - un `coveragePercentage` hundido, que en `generate-documents.ts` dispara un
 *    `logger.warn` de "cobertura baja" por debajo de 80% en CADA generación de
 *    una plantilla con bloques — hoy todas las de conciliación.
 *
 * No bloqueaba nada: el documento salía perfecto. El costo era ruido en Sentry
 * y una métrica que mentía. El detector de `renderDocumentHtml` —el que SÍ
 * bloquea— ya pelaba los bloques desde el PR #50; esto alinea el segundo
 * análisis con el primero, contra el mismo helper.
 */

import fs from 'fs';

import {
  validatePlaceholderCoverage,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

describe('validatePlaceholderCoverage — bloques', () => {
  describe('las variables de adentro de un bloque no se cuentan', () => {
    it('un {{#each}} envuelto en comentarios HTML', () => {
      // Es el patrón real de las plantillas de conciliación: los tags van
      // dentro de comentarios para que el HTML siga siendo válido sin render.
      const html = `
        <p>{{NOMBRE_DEUDOR}}</p>
        <!-- {{#each ACREEDORES}} -->
          <tr><td>{{NOMBRE}}</td><td>{{CAPITAL}}</td></tr>
        <!-- {{/each}} -->
      `;

      const r = validatePlaceholderCoverage(html, { NOMBRE_DEUDOR: 'Ana' });

      expect(r.missing).toEqual([]);
      expect(r.totalPlaceholders).toBe(1);
      expect(r.coveragePercentage).toBe(100);
    });

    it('un {{#each}} sin comentarios', () => {
      const html = `{{A}}{{#each L}}{{X}}{{Y}}{{/each}}`;
      const r = validatePlaceholderCoverage(html, { A: 'v' });

      expect(r.missing).toEqual([]);
      expect(r.totalPlaceholders).toBe(1);
    });

    it('{{#if}} y {{#unless}}', () => {
      const html = `{{A}}{{#if F}}{{X}}{{/if}}{{#unless G}}{{Y}}{{/unless}}`;
      const r = validatePlaceholderCoverage(html, { A: 'v' });

      expect(r.missing).toEqual([]);
    });

    it('cierre con el identificador repetido ({{/each LISTA}})', () => {
      // Forma que usan varias plantillas de conciliación.
      const html = `{{A}}{{#each LISTA}}{{X}}{{/each LISTA}}`;
      const r = validatePlaceholderCoverage(html, { A: 'v' });

      expect(r.missing).toEqual([]);
    });

    it('bloques anidados: se pelan de adentro hacia afuera', () => {
      const html = `{{A}}{{#each L}}{{X}}{{#if F}}{{Y}}{{/if}}{{/each}}`;
      const r = validatePlaceholderCoverage(html, { A: 'v' });

      expect(r.missing).toEqual([]);
      expect(r.totalPlaceholders).toBe(1);
    });
  });

  describe('lo que sí se sigue contando', () => {
    it('una variable de nivel raíz que el mapper no produce sigue en missing', () => {
      // Es el caso que esta función existe para detectar: no se puede aflojar.
      const html = `{{A}}{{FALTANTE}}{{#each L}}{{X}}{{/each}}`;
      const r = validatePlaceholderCoverage(html, { A: 'v' });

      expect(r.missing).toEqual(['FALTANTE']);
    });

    it('una variable después de un bloque cerrado cuenta', () => {
      const html = `{{#each L}}{{X}}{{/each}}{{DESPUES}}`;
      const r = validatePlaceholderCoverage(html, {});

      expect(r.missing).toEqual(['DESPUES']);
    });

    it('sin bloques, el comportamiento no cambia', () => {
      const html = `{{A}}{{B}}{{C}}`;
      const r = validatePlaceholderCoverage(html, { A: 'x', B: '' });

      expect(r.missing).toEqual(['C']);
      expect(r.empty).toEqual(['B']);
      expect(r.filled).toEqual(['A']);
      expect(r.totalPlaceholders).toBe(3);
    });
  });

  describe('coherencia con el detector que bloquea la generación', () => {
    /**
     * Los dos análisis ahora usan el mismo helper. Este test los compara sobre
     * las plantillas reales: lo que uno considera "variable de la plantilla" y
     * lo que el otro considera "candidata a no resuelta" tiene que coincidir.
     *
     * Si divergen, uno de los dos está contando variables de bloque.
     */
    it('en las 77 plantillas, coverage.missing == unresolved', () => {
      const divergentes: string[] = [];

      for (const template of ALL_TEMPLATES) {
        const html = fs.readFileSync(getTemplatePath(template), 'utf-8');

        // Mapper vacío a propósito: así TODAS las variables de raíz caen en
        // `missing` y en `unresolved`, y la comparación es máxima.
        const coverage = validatePlaceholderCoverage(html, {});
        const { unresolved } = renderDocumentHtml(html, {});

        const a = [...coverage.missing].sort().join(',');
        const b = [...unresolved].sort().join(',');
        if (a !== b) divergentes.push(template.id);
      }

      expect(divergentes).toEqual([]);
    });
  });
});
