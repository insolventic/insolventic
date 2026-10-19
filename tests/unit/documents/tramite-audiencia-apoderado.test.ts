/**
 * TAREA 5 (apoderado único, docs/IMPLEMENTACION_SEMANA_13.md): verifica que
 * Tramite Audiencia.html siga imprimiendo NOMBRE_ABOGADO, CEDULA_ABOGADO y
 * TARJETA_PROFESIONAL desde el apoderado de la Sección XI (Página 6), con el
 * mapper real y la plantilla real del disco — sin PDF (Chromium no aporta
 * señal acá, mismo criterio que documentos-e2e.db.test.ts).
 *
 * `placeholder-mapper.ts` (líneas ~604-615) ya resolvía estos tres
 * placeholders desde `caseData.apoderados?.[0]` antes de esta rama — esto NO
 * es una implementación nueva, es la verificación explícita que pidió la
 * tarea: que ese cableado sigue intacto después de quitar el input de
 * `attorney` de la Página 1, y que es indiferente al centro (Armonía /
 * Constructores de Paz no tienen ninguna lógica propia para este
 * placeholder).
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { prepareTemplate } from '@/features/document/prepare-template';
import {
  getTemplatesByCaseType,
  getTemplatePath,
} from '@/features/document/templates-config';
import { templateVariants } from '@/features/document/template-variants';
import { buildTemplateContext } from '@/features/document/placeholder-mapper';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Caso de insolvencia completo, con el apoderado forzado y el centro inyectado. */
function casoDelCentro(slug: 'armonia' | 'constructores-paz'): CaseWithRelations {
  const base = SCENARIOS['insolvencia-completa'].build() as unknown as CaseWithRelations;
  return {
    ...base,
    tenantId: 'cmluzsnr0000qwertyuiop123',
    tenant: { slug },
    apoderados: [
      {
        id: 'apo-verificacion',
        orden: 0,
        nombreCompleto: 'María Fernanda Torres Gil',
        tipoIdentificacion: 'CC',
        identificacion: '51876543',
        tarjetaProfesional: 'TP-123456',
        direccion: 'Carrera 7 # 45-67 Of. 301',
        telefono: '3115678901',
        correo: 'mftorres@abogados.example.com',
        existePoderOtorgado: true,
      },
    ],
  } as unknown as CaseWithRelations;
}

describe('Tramite Audiencia.html — NOMBRE_ABOGADO / CEDULA_ABOGADO / TARJETA_PROFESIONAL', () => {
  it.each(['armonia', 'constructores-paz'] as const)(
    '%s: los tres placeholders imprimen los datos del apoderado de la Sección XI',
    async (slug) => {
      const caseData = casoDelCentro(slug);
      const placeholders = mapCaseToPlaceholders(caseData);

      expect(placeholders.NOMBRE_ABOGADO).toBe('María Fernanda Torres Gil');
      expect(placeholders.CEDULA_ABOGADO).toBe('51876543');
      expect(placeholders.TARJETA_PROFESIONAL).toBe('TP-123456');

      const template = getTemplatesByCaseType('INSOLVENCY').find(
        (t) => t.id === 'tramite-audiencia',
      );
      expect(template).toBeDefined();

      const extraContext = buildTemplateContext(caseData);
      const [variant] = templateVariants(template!, caseData);
      const prepared = await prepareTemplate(
        template!,
        placeholders,
        extraContext,
        variant,
      );

      expect(prepared.html).toContain(
        'otorga poder amplio y suficiente al Abogado María Fernanda Torres Gil C.C. 51876543 y T.P. TP-123456 del C.S.J',
      );
      // No debe quedar ninguna llave sin resolver de los tres placeholders.
      expect(prepared.unresolved).not.toContain('NOMBRE_ABOGADO');
      expect(prepared.unresolved).not.toContain('CEDULA_ABOGADO');
      expect(prepared.unresolved).not.toContain('TARJETA_PROFESIONAL');

      console.log(
        `[TAREA 5 — ${slug}] "${getTemplatePath(template!)}": ${prepared.html.match(/<p>[^<]*otorga poder amplio[^<]*<\/p>/)?.[0]}`,
      );
    },
  );
});
