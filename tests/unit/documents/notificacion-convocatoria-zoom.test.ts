/**
 * C-3 de la auditoría del formulario de conciliación (2026-10-12).
 *
 * `Notificacion de Convocatoria.html` imprime `{{ZOOM_ID}}`, `{{ZOOM_CODIGO}}`
 * y `{{ZOOM_LINK}}` en su bloque "DATOS INGRESO REUNIÓN ZOOM". El mapper
 * (`placeholder-mapper.ts:519-521`) ya los produce desde
 * `caseData.zoomMeetingId`/`zoomPassword`/`zoomLink` con fallback a `''` —no
 * cambia en esta rama—; lo que cambió fue que esos tres campos ahora tienen
 * un input (`conciliation-details-section.tsx`). Este test verifica el
 * extremo documental: con los tres datos puestos, el PDF los imprime; sin
 * ellos, el bloque sale vacío pero el documento se genera igual (no son
 * obligatorios).
 */

import fs from 'fs';
import path from 'path';

import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import { ALL_TEMPLATES, getTemplatePath } from '@/features/document/templates-config';
import { makeCase } from '../../helpers/mapper-fixtures';

const TEMPLATE = ALL_TEMPLATES.find(
  (t) => t.id === 'conc-notificacion-convocatoria',
);
if (!TEMPLATE) throw new Error('No se encontró la plantilla en ALL_TEMPLATES');
const TEMPLATE_PATH = getTemplatePath(TEMPLATE);

function renderConCaso(caseData: Record<string, unknown>): string {
  const html = fs
    .readFileSync(path.join(process.cwd(), TEMPLATE_PATH), 'utf8')
    .replace(/\r\n/g, '\n');
  return renderDocumentHtml(
    html,
    mapCaseToPlaceholders(caseData as never),
    buildTemplateContext(caseData as never) as never,
  ).html;
}

describe('Notificacion de Convocatoria — datos de Zoom (C-3)', () => {
  it('con los tres campos llenos, el bloque de Zoom imprime los tres valores', () => {
    const caso = makeCase({ type: 'CONCILIATION', fill: 'full' }) as Record<
      string,
      unknown
    >;
    caso.zoomMeetingId = '123 4567 8901';
    caso.zoomPassword = 'ABC123';
    caso.zoomLink = 'https://zoom.us/j/1234567890';

    const html = renderConCaso(caso);

    expect(html).toContain('123 4567 8901');
    expect(html).toContain('ABC123');
    expect(html).toContain('https://zoom.us/j/1234567890');
  });

  it('sin los tres campos, el bloque sale vacío pero el documento se genera', () => {
    const caso = makeCase({ type: 'CONCILIATION', fill: 'minimal' }) as Record<
      string,
      unknown
    >;
    caso.zoomMeetingId = null;
    caso.zoomPassword = null;
    caso.zoomLink = null;

    const html = renderConCaso(caso);

    // El bloque "DATOS INGRESO REUNIÓN ZOOM" sigue presente (no son
    // condicionales en la plantilla), pero sin ningún placeholder sin
    // resolver: el fallback a '' del mapper los deja vacíos, no en blanco
    // literal "{{ZOOM_ID}}".
    expect(html).toContain('DATOS INGRESO REUNIÓN ZOOM');
    expect(html).not.toMatch(/\{\{ZOOM_(ID|CODIGO|LINK)\}\}/);
  });
});
