/**
 * El overlay de variantes no puede tener valores exentos del escapado.
 *
 * `escapeAllUnlessHtml` decide qué NO escapar por la CLAVE, contra una lista
 * fija (`HTML_PLACEHOLDERS_ALLOWLIST`), nunca por el contenido del valor. El
 * overlay pasa por esa función (`templateVariants`, N-A2-01), así que la única
 * forma de que un valor del overlay saliera crudo sería que una variante
 * emitiera una clave de la allowlist. Este test fija las dos cosas:
 *   1. la decisión es por clave: el contenido del valor no cambia nada;
 *   2. ninguna variante de ninguna plantilla emite una clave de la allowlist.
 */

import {
  escapeAllUnlessHtml,
  HTML_PLACEHOLDERS_ALLOWLIST,
} from '@/features/document/placeholders/escape';
import { templateVariants } from '@/features/document/template-variants';
import { ALL_TEMPLATES } from '@/features/document/templates-config';

const HTML = '<img src="/etc/passwd"><script>x</script>';

describe('1. escapeAllUnlessHtml decide por clave, no por contenido', () => {
  it('un valor que parece HTML se escapa si su clave no está en la allowlist', () => {
    const out = escapeAllUnlessHtml({
      NOMBRE_JUZGADO: HTML,
      EMPIEZA_CON_TAG: '<p>hola</p>',
      SOLO_TAG: '<b>',
    });

    expect(out.NOMBRE_JUZGADO).toBe(
      '&lt;img src=&quot;/etc/passwd&quot;&gt;&lt;script&gt;x&lt;/script&gt;',
    );
    expect(out.EMPIEZA_CON_TAG).toBe('&lt;p&gt;hola&lt;/p&gt;');
    expect(out.SOLO_TAG).toBe('&lt;b&gt;');
  });

  it('una clave de la allowlist pasa tal cual, sea HTML o texto plano', () => {
    const [clave] = [...HTML_PLACEHOLDERS_ALLOWLIST];
    expect(escapeAllUnlessHtml({ [clave]: HTML })[clave]).toBe(HTML);
    expect(escapeAllUnlessHtml({ [clave]: 'texto & más' })[clave]).toBe(
      'texto & más',
    );
  });
});

describe('2. ninguna variante emite una clave de la allowlist', () => {
  const caso = {
    type: 'INSOLVENCY',
    tenantId: 'constructores-paz',
    caseNumber: 'INS-2026-092',
    debtor: { name: 'Ana Torres', idNumber: '1', address: 'x', city: 'Cali' },
    legalProcesses: [
      {
        court: `${HTML} A`,
        plaintiff: HTML,
        processType: 'OTROS',
        processTypeOther: HTML,
      },
      {
        court: `${HTML} B`,
        plaintiff: HTML,
        processType: 'EJECUTIVO',
      },
    ],
  } as never;

  it.each(ALL_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s',
    (_id, template) => {
      for (const variante of templateVariants(template, caso)) {
        for (const [clave, valor] of Object.entries(variante.overlay)) {
          expect(HTML_PLACEHOLDERS_ALLOWLIST.has(clave)).toBe(false);
          expect(valor).not.toMatch(/[<>"']/);
        }
      }
    },
  );

  it('el oficio sí produce overlay (si no, el barrido de arriba no prueba nada)', () => {
    const oficio = ALL_TEMPLATES.find((t) => t.id === 'suspension-juzgados')!;
    const variantes = templateVariants(oficio, caso);
    expect(variantes).toHaveLength(2);
    expect(Object.keys(variantes[0].overlay).sort()).toEqual([
      'NOMBRE_DEMANDANTE',
      'NOMBRE_JUZGADO',
      'TIPO_PROCESO',
    ]);
  });
});
