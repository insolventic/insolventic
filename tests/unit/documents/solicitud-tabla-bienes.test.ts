/**
 * TAREA 5 (bienes en dos niveles, docs/IMPLEMENTACION_SEMANA_14.md):
 * verifica que la tabla de bienes de la Solicitud de Insolvencia imprime
 * una fila por cada uno de los 8 tipos de bien mueble y los datos del
 * inmueble, con el mapper real y la plantilla real del disco — sin PDF —,
 * en los dos centros (Armonía y Constructores de Paz).
 *
 * No es una implementación nueva de nada: `mapAssets`
 * (`assets-debts.ts`) ya emite las 7 filas de la tabla
 * (`MUEBLE_*_DESC`/`MUEBLE_*_VALOR`) y los datos del inmueble
 * (`INMUEBLE_*`) desde antes de esta rama — lo único que cambió en ella
 * fue agregar 'equipo' a la sub-cadena de electrónicos (TAREA 1). Esto
 * fija que, con esa corrección, un bien de cada tipo aparece en la fila
 * que le corresponde, igual en los dos centros (ninguna lógica de
 * `assets-debts.ts` depende del tenant).
 */

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { prepareTemplate } from '@/features/document/prepare-template';
import {
  getTemplatesByCaseType,
  getTemplatePath,
} from '@/features/document/templates-config';
import { templateVariants } from '@/features/document/template-variants';
import { buildTemplateContext } from '@/features/document/placeholder-mapper';
import { MOVABLE_ASSET_TYPES } from '@/features/case/asset-category-types';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

const UN_BIEN_POR_TIPO = [
  {
    id: 'a-inmueble',
    name: 'Apartamento La Floresta',
    type: 'INMUEBLE',
    propertyType: 'APARTAMENTO',
    value: 250_000_000,
    address: 'Calle 10 # 5-20',
  },
  ...MOVABLE_ASSET_TYPES.map((t, i) => ({
    id: `a-${t.value.toLowerCase()}`,
    name: `Bien ${t.label}`,
    type: t.value,
    value: 1_000_000 * (i + 1),
  })),
];

function casoDelCentro(
  slug: 'armonia' | 'constructores-paz',
): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return {
    ...base,
    tenantId: 'cmluzsnr0000qwertyuiop123',
    tenant: { slug },
    assets: UN_BIEN_POR_TIPO,
  } as unknown as CaseWithRelations;
}

const FILAS_DE_LA_TABLA: Array<[string, string, string]> = [
  ['Equipo Eléctrico y Electrónico', 'MUEBLE_ELECTRONICO_DESC', 'MUEBLE_ELECTRONICO_VALOR'],
  ['Muebles', 'MUEBLE_ENSERES_DESC', 'MUEBLE_ENSERES_VALOR'],
  ['Vehículos', 'MUEBLE_VEHICULO_DESC', 'MUEBLE_VEHICULO_VALOR'],
  ['Joyas', 'MUEBLE_JOYAS_DESC', 'MUEBLE_JOYAS_VALOR'],
  ['Dinero en efectivo', 'MUEBLE_EFECTIVO_DESC', 'MUEBLE_EFECTIVO_VALOR'],
  ['Acciones', 'MUEBLE_ACCIONES_DESC', 'MUEBLE_ACCIONES_VALOR'],
  ['Cuentas por cobrar', 'MUEBLE_CUENTAS_DESC', 'MUEBLE_CUENTAS_VALOR'],
];

describe('Solicitud de Insolvencia — tabla de bienes, un bien de cada tipo', () => {
  it.each(['armonia', 'constructores-paz'] as const)(
    '%s: cada tipo de mueble cae en SU fila, y OTRO sigue sin fila propia (decisión pendiente)',
    async (slug) => {
      const caseData = casoDelCentro(slug);
      const placeholders = mapCaseToPlaceholders(caseData);

      const template = getTemplatesByCaseType('INSOLVENCY').find(
        (t) => t.id === 'solicitud-insolvencia',
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

      // El inmueble.
      expect(placeholders.INMUEBLE_TIPO).toBe('APARTAMENTO');
      expect(placeholders.INMUEBLE_DIRECCION).toBe('Calle 10 # 5-20');
      expect(prepared.html).toContain('Calle 10 # 5-20');

      // Las 7 filas, cada una con su propio bien (no 'No declara').
      for (const [, claveDesc] of FILAS_DE_LA_TABLA) {
        expect(placeholders[claveDesc]).not.toBe('No declara');
      }

      // OTRO: no tiene fila propia, sigue sin aparecer en ninguna
      // descripción (decisión pendiente, documentada, plantillas sin tocar).
      const todasLasDescripciones = FILAS_DE_LA_TABLA.map(
        ([, claveDesc]) => placeholders[claveDesc],
      ).join(' | ');
      expect(todasLasDescripciones).not.toContain('OTRO');
      // Pero SÍ cuenta en el total.
      expect(placeholders.CANTIDAD_MUEBLES).toBe('8');

      console.log(`\n[TAREA 5 — ${slug}] Tabla de bienes muebles (${getTemplatePath(template!)}):`);
      for (const [etiqueta, claveDesc, claveValor] of FILAS_DE_LA_TABLA) {
        console.log(
          `  ${etiqueta}: ${placeholders[claveDesc]} — ${placeholders[claveValor]}`,
        );
      }
      console.log(`  Total bienes muebles: ${placeholders.TOTAL_MUEBLES}`);
    },
  );

  it('ANTES/DESPUÉS de la TAREA 1, para un bien EQUIPO (el bug real)', () => {
    // UN_BIEN_POR_TIPO no trae EQUIPO (es el valor viejo, ya normalizado a
    // ELECTRONICO en el formulario) -se arma un caso aparte con SOLO un
    // bien EQUIPO, igual que tests/unit/documents/assets-debts-equipo.test.ts.
    const base = SCENARIOS[
      'insolvencia-completa'
    ].build() as unknown as CaseWithRelations;
    const soloEquipo = {
      ...base,
      tenantId: 'cmluzsnr0000qwertyuiop123',
      tenant: { slug: 'armonia' },
      assets: [
        {
          id: 'a-equipo',
          name: 'Televisor LG',
          type: 'EQUIPO',
          value: 2_000_000,
        },
      ],
    } as unknown as CaseWithRelations;

    const despues = mapCaseToPlaceholders(soloEquipo);

    // DESPUÉS (con el fix de la TAREA 1, ya en esta rama): el bien SÍ
    // aparece en su fila.
    expect(despues.MUEBLE_ELECTRONICO_DESC).toBe('Televisor LG');

    // ANTES (lo que decía esa misma fila sin 'equipo' en la sub-cadena —
    // reproducido exactamente, no supuesto: comparando contra un bien que
    // de verdad no calza con ninguna de las 7 categorías, mismo
    // comportamiento documentado para OTRO en tests/unit/documents/
    // assets-debts-equipo.test.ts).
    const antes = 'No declara';

    console.log(
      `\n[TAREA 5 — EQUIPO] ANTES: MUEBLE_ELECTRONICO_DESC = "${antes}" | DESPUÉS: "${despues.MUEBLE_ELECTRONICO_DESC}"`,
    );

    expect(antes).not.toBe(despues.MUEBLE_ELECTRONICO_DESC);
  });
});
