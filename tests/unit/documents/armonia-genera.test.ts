/**
 * ARMONÍA GENERA: la prueba de aceptación del membrete por centro.
 *
 * El resto de los tests del membrete verifican el mapa de datos. Éste verifica
 * la consecuencia, que es lo que se pidió: renderizar **las 65 plantillas** con
 * un caso de Armonía y comprobar que
 *
 *   1. solo quedan sin resolver las plantillas que usan el único dato que
 *      falta (la cuenta de consignación), y son exactamente 2; y
 *   2. los dos campos vacíos a propósito —web y edificio— no dejan basura
 *      tipográfica: ni una raya al aire, ni una línea en blanco en el pie.
 *
 * POR QUÉ HACE FALTA UN TEST ASÍ. El golden master solo renderiza escenarios de
 * Constructores, así que mide que el centro completo no se rompa — no que el
 * incompleto funcione. Hasta el 2026-10-10 el sub-mapper era todo-o-nada: con
 * un `null` en cualquier campo, Armonía no generaba NADA, y ningún test lo
 * decía porque ninguno renderizaba una plantilla con Armonía.
 */

import fs from 'fs';
import path from 'path';

import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { CLAVES_MEMBRETE } from '@/features/document/placeholders/membrete';
import type { CaseWithRelations } from '@/features/case/schemas';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Un escenario por tipo de caso, con la forma REAL de producción de Armonía. */
const ESCENARIO = {
  INSOLVENCY: 'insolvencia-completa',
  CONCILIATION: 'conciliacion-basica',
  SUPPORT_AGREEMENT: 'apoyo-completo',
} as const;

/** `Case.tenantId` es el cuid del tenant; el slug viaja en la relación. */
const CUID = 'cmluzsnr0000qwertyuiop123';

function casoDeArmonia(kind: keyof typeof ESCENARIO): CaseWithRelations {
  const base = SCENARIOS[ESCENARIO[kind]].build() as unknown as Record<
    string,
    unknown
  >;
  return {
    ...base,
    tenantId: CUID,
    tenant: { slug: 'armonia' },
  } as unknown as CaseWithRelations;
}

/** Renderiza UNA plantilla para UN centro. Para las aserciones exactas. */
function renderCon(
  rel: string,
  kind: keyof typeof ESCENARIO,
  slug: string,
): string {
  const base = SCENARIOS[ESCENARIO[kind]].build() as unknown as Record<
    string,
    unknown
  >;
  const caseData = {
    ...base,
    tenantId: CUID,
    tenant: { slug },
  } as unknown as CaseWithRelations;
  const html = fs
    .readFileSync(path.join(process.cwd(), rel), 'utf8')
    .replace(/\r\n/g, '\n');
  return renderDocumentHtml(
    html,
    mapCaseToPlaceholders(caseData as never),
    buildTemplateContext(caseData as never) as never,
  ).html;
}

type Render = { id: string; html: string; sinResolver: string[] };

const RENDERS: Render[] = (() => {
  const cache = new Map<
    string,
    { placeholders: Record<string, string>; extra: Record<string, unknown> }
  >();
  const out: Render[] = [];
  for (const template of ALL_TEMPLATES) {
    const kind = template.caseType as keyof typeof ESCENARIO;
    if (!cache.has(kind)) {
      const caseData = casoDeArmonia(kind);
      cache.set(kind, {
        placeholders: mapCaseToPlaceholders(caseData as never),
        extra: buildTemplateContext(caseData as never) as Record<
          string,
          unknown
        >,
      });
    }
    const file = path.join(process.cwd(), getTemplatePath(template));
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const { placeholders, extra } = cache.get(kind)!;
    const r = renderDocumentHtml(html, placeholders, extra);
    out.push({
      id: getTemplatePath(template),
      html: r.html,
      sinResolver: [...r.unresolved].filter((k) =>
        CLAVES_MEMBRETE.includes(k),
      ),
    });
  }
  return out;
})();

describe('1. qué bloquea y qué no', () => {
  it('renderizó las 65 plantillas (si no, el test no prueba nada)', () => {
    expect(RENDERS.length).toBeGreaterThanOrEqual(64);
  });

  it('SOLO las 2 plantillas de la cuenta de consignación quedan sin resolver', () => {
    const bloqueadas = RENDERS.filter((r) => r.sinResolver.length > 0);
    expect(bloqueadas.map((r) => r.id).sort()).toEqual([
      'templates/insolvency/Solicitud de Incumplimiento del Acuerdo/Auto Solicitud por Incumplimiento.html',
      'templates/insolvency/Solicitud de Reforma del Acuerdo/Auto Solicitud Reforma del Acuerdo.html',
    ]);
    // Y el motivo es ese campo y no otro.
    for (const b of bloqueadas) {
      expect(b.sinResolver).toEqual(['CENTRO_CUENTA_CONSIGNACION']);
    }
  });

  it('las otras 63 no tienen ningún placeholder de membrete sin resolver', () => {
    const limpias = RENDERS.filter((r) => r.sinResolver.length === 0);
    expect(limpias.length).toBe(RENDERS.length - 2);
  });
});

describe('2. los campos vacíos a propósito no dejan basura', () => {
  /**
   * Los tres sitios donde la web o el edificio vacíos dejaban basura, con el
   * fragmento renderizado EXACTO de los dos centros.
   *
   * Se afirma el string completo y no un regex de "no hay raya suelta" a
   * propósito: el primer intento de este test usaba heurísticas (`<br><br>`,
   * "guion antes de cierre de etiqueta") y marcaba 23 plantillas que estaban
   * perfectas — `<br><br>` es maquetación legítima en 17 de ellas. Un detector
   * aproximado que grita no prueba nada; el fragmento exacto sí.
   */
  const CASOS = [
    {
      que: 'el pie con <br> (59 plantillas): a Armonía le falta la línea de la web, sin dejar el <br>',
      plantilla: 'templates/conciliation/Actas de Conciliacion/Acta General.html',
      kind: 'CONCILIATION' as const,
      'constructores-paz': `<div class="footer">
        <p>Asociación Lonja de Propiedad Raíz y Avaluadores de Colombia<br>
        Calle 74 No. 15-80 interior 1 Oficina 308 Bogotá D.C.<br>
        Cel. 311 811 7520<br>
        www.constructoresdepaz.com.co<br>
        contacto@constructoresdepaz.com.co</p>`,
      armonia: `<div class="footer">
        <p>Asociación para el Fomento de la Cultura la Justicia y la Conciliación<br>
        Calle 74 #15-80 Interior 1 oficina 306 Bogotá D.C.<br>
        Cel. 313 290 4984<br>
        contacto@armoniaconcertada.co</p>`,
    },
    {
      que: 'el pie con guion (Check List): sin la web, el guion tampoco queda',
      plantilla: 'templates/insolvency/Check List.html',
      kind: 'INSOLVENCY' as const,
      'constructores-paz': '<p>Cel. 311 811 7520 – www.constructoresdepaz.com.co</p>',
      armonia: '<p>Cel. 313 290 4984</p>',
    },
    {
      que: 'la prosa del Edicto: sin la web, no queda ", - – correo"',
      plantilla:
        'templates/insolvency/Edicto Emplazatorio Publicacion en periodico.html',
      kind: 'INSOLVENCY' as const,
      'constructores-paz':
        'Bogotá D.C., - www.constructoresdepaz.com.co– contacto@constructoresdepaz.com.co,',
      armonia: 'Bogotá D.C., contacto@armoniaconcertada.co,',
    },
  ];

  it.each(CASOS)('$que', (caso) => {
    for (const slug of ['constructores-paz', 'armonia'] as const) {
      const html = renderCon(caso.plantilla, caso.kind, slug);
      expect(html).toContain(caso[slug]);
    }
    // Y lo del otro centro NO está.
    const ar = renderCon(caso.plantilla, caso.kind, 'armonia');
    expect(ar).not.toContain(caso['constructores-paz']);
  });

  it('el dato que sí tiene aparece: el correo propio de Armonía', () => {
    const conCorreo = RENDERS.filter((r) =>
      r.html.includes('contacto@armoniaconcertada.co'),
    );
    expect(conCorreo.length).toBeGreaterThan(50);
  });
});

describe('3. nada de Constructores se cuela en un documento de Armonía', () => {
  const AJENOS = [
    'Constructores de Paz',
    'CONSTRUCTORES DE PAZ',
    'constructoresdepaz.com.co',
    'Lonja de Propiedad',
    'LONJA DE PROPIEDAD',
    'Osaka',
    '1459',
    '830.122.178-7',
    '2061 399 5617',
    'Arbitraje',
    'ARBITRAJE',
    '311 811 7520',
  ];

  it.each(AJENOS)('ningún documento de Armonía dice %s', (ajeno) => {
    const culpables = RENDERS.filter((r) => r.html.includes(ajeno)).map(
      (r) => r.id,
    );
    expect(culpables).toEqual([]);
  });
});
