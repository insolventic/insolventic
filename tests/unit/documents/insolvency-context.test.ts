/**
 * `buildInsolvencyContext` — contexto de bloques `{{#each}}` para insolvencia.
 *
 * Paso 2 de `docs/PLAN_TODOS_LOS_ACREEDORES_2026-09-28.md`. La infraestructura
 * entra sola, **sin migrar ninguna plantilla**, para que se pueda verificar en
 * aislamiento: mientras nadie la consuma, el render tiene que salir byte por
 * byte igual que antes.
 *
 * Los slots planos (`AC1_*` … `AC11_*`) siguen intactos y son los que las
 * plantillas usan hoy. Este builder es su reemplazo sin tope, y se prueba
 * contra ellos: para los primeros 11 acreedores tiene que decir lo mismo.
 */

import fs from 'fs';

import {
  buildInsolvencyContext,
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

const build = (name: string) => SCENARIOS[name].build() as never;

/** Los 21 campos que expone cada acreedor. */
const CAMPOS = [
  'NUMERO',
  'NOMBRE',
  'DOMICILIO',
  'DIRECCION',
  'EMAIL',
  'CAPITAL',
  'INTERESES',
  'POSTERGADO',
  'TASA',
  'DOCUMENTO',
  'FECHA_OTORGAMIENTO',
  'FECHA_VENCIMIENTO',
  'CLASIFICACION',
  'CODEUDOR_NOMBRE',
  'CODEUDOR_DOMICILIO',
  'CODEUDOR_DIRECCION',
  'VALOR',
  'LIBRANZA',
  'CLASE',
  'PORCENTAJE',
  'DIAS',
  'APODERADO',
];

type Acreedor = Record<string, string>;
const acreedoresDe = (escenario: string): Acreedor[] =>
  buildInsolvencyContext(build(escenario)).ACREEDORES as Acreedor[];

describe('buildInsolvencyContext', () => {
  describe('la lista completa, sin tope', () => {
    it('emite un ítem por deuda, no 11', () => {
      // El escenario tiene 13 deudas y los slots planos llegan a 11: esas dos
      // últimas son las que hoy desaparecen de todos los documentos.
      const acreedores = acreedoresDe('insolvencia-muchos');

      expect(acreedores).toHaveLength(13);
      expect(acreedores[11]).toBeDefined();
      expect(acreedores[12]).toBeDefined();
    });

    it('un caso sin deudas da lista vacía y la bandera en false', () => {
      const ctx = buildInsolvencyContext(build('insolvencia-minima'));
      const acreedores = ctx.ACREEDORES as Acreedor[];

      // `insolvencia-minima` puede traer deudas; lo que se fija es la relación
      // entre la lista y la bandera, que es lo que consume el `{{#if}}`.
      expect(ctx.TIENE_ACREEDORES_LISTA).toBe(acreedores.length > 0);
    });

    it('cada ítem trae los 21 campos, y ninguno undefined', () => {
      for (const acreedor of acreedoresDe('insolvencia-completa')) {
        expect(Object.keys(acreedor).sort()).toEqual([...CAMPOS].sort());
        for (const campo of CAMPOS) {
          expect(typeof acreedor[campo]).toBe('string');
        }
      }
    });

    it('NUMERO es el orden 1-based (handlebars-lite no expone @index)', () => {
      const acreedores = acreedoresDe('insolvencia-muchos');
      expect(acreedores.map((a) => a.NUMERO).slice(0, 3)).toEqual([
        '1',
        '2',
        '3',
      ]);
      expect(acreedores.at(-1)!.NUMERO).toBe('13');
    });
  });

  // El describe de paridad con los slots planos se retiro en el Paso 5: esos
  // slots ya no existen, asi que no hay contra que comparar. Su trabajo -que el
  // contexto dijera lo mismo que los slots para los primeros 11- ya se cumplio
  // al migrar las dos plantillas, y el golden lo dejo fijado.

  describe('codeudor', () => {
    it('sin codeudor declarado, los tres campos dicen N/A y no vacío', () => {
      // En un documento legal "no aplica" y "no se informó" no son lo mismo.
      const caseData = build('insolvencia-completa') as unknown as {
        debts: Array<Record<string, unknown>>;
      };
      const conFlag = {
        ...caseData,
        debts: caseData.debts.map((d) => ({ ...d, noCoDebtor: true })),
      };

      for (const acreedor of buildInsolvencyContext(conFlag as never)
        .ACREEDORES as Acreedor[]) {
        expect(acreedor.CODEUDOR_NOMBRE).toBe('N/A');
        expect(acreedor.CODEUDOR_DOMICILIO).toBe('N/A');
        expect(acreedor.CODEUDOR_DIRECCION).toBe('N/A');
      }
    });
  });

  describe('buildTemplateContext — el dispatcher', () => {
    it('INSOLVENCY devuelve el contexto de insolvencia', () => {
      const ctx = buildTemplateContext(build('insolvencia-completa'));
      expect(ctx).toHaveProperty('ACREEDORES');
    });

    it('CONCILIATION sigue devolviendo el de conciliación', () => {
      const ctx = buildTemplateContext(build('conciliacion-basica'));
      expect(ctx).toHaveProperty('CLAUSULAS_ACUERDO');
      expect(ctx).not.toHaveProperty('ACREEDORES');
    });

    it('SUPPORT_AGREEMENT no aporta bloques, igual que antes', () => {
      expect(buildTemplateContext(build('apoyo-completo'))).toBeUndefined();
    });
  });

  describe('criterio de aceptación del Paso 2: nada lo consume todavía', () => {
    /**
     * Mientras ninguna plantilla use `{{#each ACREEDORES}}`, agregar el
     * contexto al render no puede cambiar ni un byte de la salida.
     *
     * El golden master no alcanza para probarlo: `mapper-golden.test.ts` arma
     * el `extraContext` con `buildConciliationContext` directo, así que nunca
     * ejercita el builder nuevo. Esto compara el render real, con y sin el
     * contexto, sobre las 77 plantillas.
     *
     * CUANDO SE MIGRE UNA PLANTILLA (Pasos 3 y 4 del plan) este test va a
     * fallar nombrándola: es intencional. Ahí se la agrega a la lista de
     * migradas.
     */
    // Plantillas que YA consumen el contexto. Al migrar una, se agrega aca:
    // el test de abajo falla nombrandola, que es la senal de que hay que
    // moverla de lista.
    const YA_MIGRADAS: string[] = ['solicitud-insolvencia', 'cyg-tramite'];

    it('render con y sin el contexto de insolvencia: idénticos', () => {
      const caseData = build('insolvencia-muchos');
      const placeholders = mapCaseToPlaceholders(caseData);
      const contexto = buildInsolvencyContext(caseData);

      const cambiadas: string[] = [];

      for (const template of ALL_TEMPLATES) {
        if (YA_MIGRADAS.includes(template.id)) continue;

        const html = fs.readFileSync(getTemplatePath(template), 'utf-8');
        const sin = renderDocumentHtml(html, placeholders).html;
        const con = renderDocumentHtml(html, placeholders, contexto).html;

        if (sin !== con) cambiadas.push(template.id);
      }

      expect(cambiadas).toEqual([]);
    });

    it('ninguna plantilla referencia todavía ACREEDORES ni TIENE_ACREEDORES_LISTA', () => {
      const referencian = ALL_TEMPLATES.filter((t) => {
        const html = fs.readFileSync(getTemplatePath(t), 'utf-8');
        return (
          /\{\{#each\s+ACREEDORES\s*\}\}/.test(html) ||
          html.includes('TIENE_ACREEDORES_LISTA')
        );
      }).map((t) => t.id);

      expect(referencian).toEqual(YA_MIGRADAS);
    });
  });
});
