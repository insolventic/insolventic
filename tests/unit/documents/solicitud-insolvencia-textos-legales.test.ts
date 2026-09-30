/**
 * Textos legales de la Solicitud de Insolvencia que el cliente pidió de forma
 * literal y que, por ser estáticos, no dependen de ningún placeholder.
 *
 * Existe aparte del golden master (`mapper-golden.test.ts`) a propósito: el
 * golden fija un hash del HTML renderizado, así que detecta que el texto cambió
 * pero no dice CUÁL era ni por qué tenía que estar. Si alguien reescribe la
 * Sección 17, el golden falla con un hash distinto y se regenera sin pensar;
 * este test falla nombrando el requisito.
 */

import fs from 'fs';

import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

function templateHtml(id: string): string {
  const template = ALL_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`No existe la plantilla con id "${id}"`);
  return fs.readFileSync(getTemplatePath(template), 'utf-8');
}

describe('Solicitud de Insolvencia — textos legales literales', () => {
  const html = templateHtml('solicitud-insolvencia');

  describe('Sección 17 — Notificaciones', () => {
    it('la notificación al deudor va rotulada como tal', () => {
      expect(html).toContain('Notificación al deudor:');
    });

    it('conserva la fórmula en primera persona y la dirección de notificación', () => {
      expect(html).toContain(
        'Como deudor recibiré notificaciones en la siguiente dirección:',
      );
      expect(html).toContain('{{NOTIF_DIRECCION}}');
    });
  });

  describe('Sección 4 — afectaciones del inmueble', () => {
    // Las dos citas van juntas y en este orden: la casilla de patrimonio de
    // familia se agregó al formulario precisamente para poder llenar la segunda.
    it('cita vivienda familiar (Ley 258 de 1996) y patrimonio de familia (Ley 70 de 1931)', () => {
      const viviendaFamiliar = html.indexOf('LEY 258 DE 1996');
      const patrimonioFamilia = html.indexOf('LEY 70 DE 1931');

      expect(viviendaFamiliar).toBeGreaterThan(-1);
      expect(patrimonioFamilia).toBeGreaterThan(-1);
      expect(patrimonioFamilia).toBeGreaterThan(viviendaFamiliar);
    });
  });
});
