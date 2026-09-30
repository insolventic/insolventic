/**
 * Unit tests: reclasificación de 'rechazo-inasistencia' → 'inasistencia-deudor'
 * (docs/DISENO_FASES_NUEVAS_2026-09-11.md §3.1.5, Fase 2 paso 2.1).
 */
import {
  ALL_TEMPLATES,
  getFailureTypes,
  getTemplateById,
  getTemplatesForFailure,
} from '@/features/document/templates-config';

describe('inasistencia-deudor (antes rechazo-inasistencia)', () => {
  it('ya no existe con el id viejo', () => {
    expect(getTemplateById('rechazo-inasistencia')).toBeUndefined();
    expect(ALL_TEMPLATES.some((t) => t.id === 'rechazo-inasistencia')).toBe(
      false,
    );
  });

  it('existe con el id nuevo, clasificada como fracaso', () => {
    const template = getTemplateById('inasistencia-deudor');
    expect(template).toBeDefined();
    expect(template?.category).toBe('fracaso');
    expect(template?.packageNumber).toBe(5);
    expect(template?.generateOnFailure).toBe(true);
  });

  it('vive en la carpeta de Fracaso, no en "Tipos de Rechazo"', () => {
    const template = getTemplateById('inasistencia-deudor');
    expect(template?.folderPath).toContain('Tipos De Fracaso');
    expect(template?.folderPath).not.toContain('Tipos de Rechazo');
  });

  it('aparece en getFailureTypes()', () => {
    const types = getFailureTypes();
    expect(types.some((t) => t.id === 'inasistencia-deudor')).toBe(true);
  });

  it('getTemplatesForFailure("inasistencia-deudor") la devuelve', () => {
    const templates = getTemplatesForFailure('inasistencia-deudor');
    expect(templates.map((t) => t.id)).toContain('inasistencia-deudor');
  });

  it('no queda ninguna plantilla con category "rechazo" (paso 2.1 la vació)', () => {
    // No es una prohibición: la fase Rechazo tendrá sus propias plantillas
    // nuevas en el paso 4 (bloqueado por el abogado). Este test documenta que
    // hoy, tras la reclasificación, la categoría está vacía a propósito.
    expect(ALL_TEMPLATES.some((t) => t.category === 'rechazo')).toBe(false);
  });
});
