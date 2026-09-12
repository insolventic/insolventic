/**
 * Unit Tests: bloqueo de documentos con datos incompletos (C-3).
 *
 * El hallazgo crítico: `replacePlaceholders` borraba en silencio todo
 * `{{VAR}}` que el contexto no cubriera, así que un documento legal salía con
 * campos en blanco indistinguible de uno correcto, se radicaba, y el defecto
 * aparecía en la audiencia.
 *
 * Decisión de producto (confirmada con los dos centros): BLOQUEAR y devolver
 * el informe de campos faltantes. Nada incompleto llega a Drive.
 */

import {
  renderDocumentHtml,
  replacePlaceholders,
  validatePlaceholderCoverage,
} from '@/features/document/placeholder-mapper';

describe('renderDocumentHtml — informe de placeholders sin resolver (C-3)', () => {
  describe('camino feliz', () => {
    it('resuelve todos los placeholders y no reporta faltantes', () => {
      const { html, unresolved } = renderDocumentHtml(
        '<p>{{NOMBRE_DEUDOR}} con cédula {{CEDULA_DEUDOR}}</p>',
        { NOMBRE_DEUDOR: 'Juan Pérez', CEDULA_DEUDOR: '1234567890' },
      );

      expect(unresolved).toEqual([]);
      expect(html).toContain('Juan Pérez');
      expect(html).toContain('1234567890');
      expect(html).not.toContain('{{');
    });

    it('un placeholder CONOCIDO pero vacío se sigue vaciando (campo opcional)', () => {
      // Distinción clave: el mapper lo produce, viene en blanco a propósito.
      // No debe ensuciar el documento con un marcador ni bloquear.
      const { html, unresolved } = renderDocumentHtml(
        '<p>Observaciones: {{OBSERVACIONES}}</p>',
        { OBSERVACIONES: '' },
      );

      expect(unresolved).toEqual([]);
      expect(html).toBe('<p>Observaciones: </p>');
      expect(html).not.toContain('FALTA');
    });

    it('sigue limpiando las filas de tabla que quedan vacías', () => {
      const { html } = renderDocumentHtml(
        '<table><tr><td>{{VACIO}}</td></tr></table>',
        { VACIO: '' },
      );
      expect(html).toBe('<table></table>');
    });
  });

  describe('datos faltantes — deben reportarse, nunca borrarse en silencio', () => {
    it('reporta el placeholder que el mapper no produce', () => {
      const { unresolved } = renderDocumentHtml(
        '<p>{{NOMBRE_DEUDOR}} — {{DATO_INEXISTENTE}}</p>',
        { NOMBRE_DEUDOR: 'Juan Pérez' },
      );

      expect(unresolved).toEqual(['DATO_INEXISTENTE']);
    });

    it('deja un marcador visible en vez de un hueco silencioso', () => {
      const { html } = renderDocumentHtml('<p>Deudor: {{SIN_MAPEAR}}</p>', {});

      expect(html).toContain('«FALTA: SIN_MAPEAR»');
      expect(html).not.toBe('<p>Deudor: </p>');
    });

    it('deduplica un mismo placeholder repetido', () => {
      const { unresolved } = renderDocumentHtml(
        '<p>{{X}}</p><p>{{X}}</p><p>{{X}}</p>',
        {},
      );
      expect(unresolved).toEqual(['X']);
    });

    it('reporta varios faltantes distintos', () => {
      const { unresolved } = renderDocumentHtml('<p>{{A}} {{B}} {{C}}</p>', {
        B: 'presente',
      });
      expect(unresolved.sort()).toEqual(['A', 'C']);
    });

    it('REGRESIÓN: el comportamiento anterior (borrado silencioso) ya no ocurre', () => {
      // Este era exactamente el bug: el documento salía con el campo en blanco
      // y nadie se enteraba.
      const html = '<p>Cédula: {{CEDULA_DEUDOR}}</p>';
      const { html: rendered, unresolved } = renderDocumentHtml(html, {});

      expect(unresolved).toContain('CEDULA_DEUDOR');
      expect(rendered).not.toBe('<p>Cédula: </p>');
    });
  });

  it('replacePlaceholders sigue funcionando como wrapper deprecado', () => {
    const out = replacePlaceholders('<p>{{A}}</p>', { A: 'valor' });
    expect(out).toBe('<p>valor</p>');
  });
});

describe('validatePlaceholderCoverage — distingue faltante de vacío', () => {
  it('clasifica correctamente missing / empty / filled', () => {
    const coverage = validatePlaceholderCoverage(
      '<p>{{LLENO}} {{VACIO}} {{AUSENTE}}</p>',
      { LLENO: 'dato', VACIO: '' },
    );

    expect(coverage.filled).toEqual(['LLENO']);
    expect(coverage.empty).toEqual(['VACIO']);
    expect(coverage.missing).toEqual(['AUSENTE']);
    expect(coverage.complete).toBe(false);
  });

  it('trata el relleno manual (____, N/A) como vacío, no como dato', () => {
    const coverage = validatePlaceholderCoverage('<p>{{A}} {{B}}</p>', {
      A: '____',
      B: 'N/A',
    });
    expect(coverage.empty.sort()).toEqual(['A', 'B']);
    expect(coverage.filled).toEqual([]);
  });

  it('reporta 100% cuando todo está lleno', () => {
    const coverage = validatePlaceholderCoverage('<p>{{A}}</p>', { A: 'x' });
    expect(coverage.coveragePercentage).toBe(100);
    expect(coverage.complete).toBe(true);
  });
});
