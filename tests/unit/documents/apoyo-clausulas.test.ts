/**
 * El Acuerdo de Apoyo perdía sus cláusulas en silencio.
 *
 * `CLAUSULAS_APOYO` viajaba por el mapa escalar (string-only) con un cast
 * (`as unknown as string`), y `escapeAllUnlessHtml` —el punto de fusión que
 * escapa TODO lo que no esté en la allowlist— convierte cualquier valor
 * no-string con `String(value)`. Un array de objetos se vuelve
 * `"[object Object],[object Object],..."`, `{{#each}}` recibe un string,
 * `Array.isArray` da `false`, y el bloque renderiza vacío debajo del
 * encabezado "CLÁUSULAS".
 *
 * Segundo defecto, independiente: `TIENE_CLAUSULAS_APOYO` era la cadena
 * `'SI'`/`'NO'`, y en `handlebars-lite` cualquier string no vacío es verdadero
 * — `'NO'` incluido. El encabezado "CLÁUSULAS" se imprimía igual con cero
 * cláusulas debajo.
 *
 * Hallazgo §4.3 de docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md.
 */

import {
  mapCaseToPlaceholders,
  buildTemplateContext,
} from '@/features/document/placeholder-mapper';
import { renderDocumentHtml } from '@/features/document/placeholder-mapper';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

const PLANTILLA_CLAUSULAS = `
<p class="seccion-titulo">CLÁUSULAS</p>
{{#if TIENE_CLAUSULAS_APOYO}}
<div class="clausulas-lista">
  {{#each CLAUSULAS_APOYO}}
  <div class="clausula-item">
    <span>CLÁUSULA {{NUMERO_CLAUSULA}}.</span>
    <span>{{TEXTO_CLAUSULA}}</span>
  </div>
  {{/each}}
</div>
{{/if}}
`;

function casoApoyo(overrides: Record<string, unknown> = {}): CaseWithRelations {
  const base = SCENARIOS[
    'apoyo-completo'
  ].build() as unknown as CaseWithRelations;
  return { ...base, ...overrides } as CaseWithRelations;
}

describe('buildApoyoContext — CLAUSULAS_APOYO viaja como array real', () => {
  it('con 3 cláusulas, el contexto trae un array de 3 (no un string)', () => {
    const caso = casoApoyo({
      apoyoClausulas: [
        { NUMERO_CLAUSULA: 'PRIMERA', TEXTO_CLAUSULA: 'Texto uno.' },
        { NUMERO_CLAUSULA: 'SEGUNDA', TEXTO_CLAUSULA: 'Texto dos.' },
        { NUMERO_CLAUSULA: 'TERCERA', TEXTO_CLAUSULA: 'Texto tres.' },
      ],
    } as Partial<CaseWithRelations>);

    const ctx = buildTemplateContext(caso)!;
    expect(Array.isArray(ctx.CLAUSULAS_APOYO)).toBe(true);
    expect(ctx.CLAUSULAS_APOYO).toHaveLength(3);
    expect(ctx.TIENE_CLAUSULAS_APOYO).toBe(true);
  });

  it('sin cláusulas, TIENE_CLAUSULAS_APOYO es false (booleano, no la cadena "NO")', () => {
    const caso = casoApoyo({
      apoyoClausulas: [],
    } as Partial<CaseWithRelations>);
    const ctx = buildTemplateContext(caso)!;
    expect(ctx.TIENE_CLAUSULAS_APOYO).toBe(false);
    expect(ctx.CLAUSULAS_APOYO).toEqual([]);
  });

  it('el mapa escalar YA NO produce CLAUSULAS_APOYO ni TIENE_CLAUSULAS_APOYO', () => {
    // Si reaparecieran acá, el spread `{...extraContext, ...placeholders}` de
    // renderDocumentHtml dejaría que este valor (string) pise al del contexto
    // (array/booleano), y el bug volvería.
    const placeholders = mapCaseToPlaceholders(casoApoyo());
    expect(placeholders.CLAUSULAS_APOYO).toBeUndefined();
    expect(placeholders.TIENE_CLAUSULAS_APOYO).toBeUndefined();
  });

  it('las cláusulas escapan su texto (son interpolación de usuario)', () => {
    const caso = casoApoyo({
      apoyoClausulas: [
        { NUMERO_CLAUSULA: 'PRIMERA', TEXTO_CLAUSULA: '<script>XSS</script>' },
      ],
    } as Partial<CaseWithRelations>);
    const ctx = buildTemplateContext(caso)!;
    const clausula = (ctx.CLAUSULAS_APOYO as Array<Record<string, string>>)[0];
    expect(clausula.TEXTO_CLAUSULA).not.toContain('<script>');
    expect(clausula.TEXTO_CLAUSULA).toContain('&lt;script&gt;');
  });
});

describe('render real: el bloque {{#each}} ya no queda vacío', () => {
  it('con cláusulas, el HTML las lista', () => {
    const caso = casoApoyo({
      apoyoClausulas: [
        {
          NUMERO_CLAUSULA: 'PRIMERA',
          TEXTO_CLAUSULA: 'El beneficiario acompaña.',
        },
        { NUMERO_CLAUSULA: 'SEGUNDA', TEXTO_CLAUSULA: 'Vigencia de 36 meses.' },
      ],
    } as Partial<CaseWithRelations>);

    const placeholders = mapCaseToPlaceholders(caso);
    const ctx = buildTemplateContext(caso);
    const { html, unresolved } = renderDocumentHtml(
      PLANTILLA_CLAUSULAS,
      placeholders,
      ctx,
    );

    expect(unresolved).toEqual([]);
    expect(html).toContain('CLÁUSULA PRIMERA');
    expect(html).toContain('El beneficiario acompaña.');
    expect(html).toContain('CLÁUSULA SEGUNDA');
    expect(html).toContain('Vigencia de 36 meses.');
    // No el objeto crudo convertido a texto — el síntoma original del bug.
    expect(html).not.toContain('[object Object]');
  });

  it('sin cláusulas, el bloque entero desaparece (antes: encabezado sin nada debajo)', () => {
    const caso = casoApoyo({
      apoyoClausulas: [],
    } as Partial<CaseWithRelations>);
    const placeholders = mapCaseToPlaceholders(caso);
    const ctx = buildTemplateContext(caso);
    const { html } = renderDocumentHtml(PLANTILLA_CLAUSULAS, placeholders, ctx);

    expect(html).not.toContain('clausulas-lista');
    expect(html).not.toContain('CLÁUSULA ');
  });
});

describe('mapApoyoFields — conciliadora y montos sin dato', () => {
  it('TP_CONCILIADORA_APOYO cae a la tarjeta profesional del operador', () => {
    const caso = casoApoyo({
      apoyoConciliadoraTP: undefined,
      operator: {
        id: 'op-1',
        name: 'Liliana Patricia Arango Mejía',
        email: 'liliana@example.com',
        professionalCard: '155820',
      },
    } as Partial<CaseWithRelations>);
    const placeholders = mapCaseToPlaceholders(caso);
    expect(placeholders.TP_CONCILIADORA_APOYO).toBe('155820');
  });

  it('sin plazo, PLAZO_MESES_APOYO es "N/A", no una fila "meses" vacía', () => {
    const caso = casoApoyo({
      apoyoPlazoMeses: undefined,
    } as Partial<CaseWithRelations>);
    const placeholders = mapCaseToPlaceholders(caso);
    expect(placeholders.PLAZO_MESES_APOYO).toBe('N/A');
  });

  it('sin monto, MONTO_MENSUAL_APOYO es "N/A"', () => {
    const caso = casoApoyo({
      apoyoMontoMensual: undefined,
    } as Partial<CaseWithRelations>);
    const placeholders = mapCaseToPlaceholders(caso);
    expect(placeholders.MONTO_MENSUAL_APOYO).toBe('N/A');
  });
});
