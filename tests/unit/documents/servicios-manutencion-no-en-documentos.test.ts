/**
 * Invariante: el desglose de servicios de manutención NO sale en los documentos.
 *
 * El cliente pidió que este dato quedara guardado y visible para el operador,
 * pero que NUNCA apareciera en los PDF legales. Hoy eso se cumple por OMISIÓN:
 * el mapper es opt-in, así que un dato llega a un documento solo si alguien le
 * escribe un placeholder. Una omisión no es una garantía — el próximo que
 * agregue un `SERVICIOS_*` al mapper no tiene forma de saber que no debe.
 *
 * Este test convierte la omisión en invariante: falla si el desglose aparece en
 * la salida del mapper, en cualquiera de sus formas (una clave nueva que lo
 * enumere, o el texto de un servicio filtrándose dentro del valor de un
 * placeholder existente).
 *
 * Lo que sí puede seguir saliendo es el MONTO AGREGADO
 * (`gastosServiciosPublicos`): ese es un dato declarado del expediente y
 * alimenta el Excel directamente desde `caseData` (`generate-excel.ts`), no es
 * lo que se pidió ocultar. No hay un placeholder equivalente en el mapper desde
 * que se borró el Formulario Definitivo muerto (`mapFormularioDefinitivoFields`
 * era la única fuente de `gastos_servicios_publicos`, y ningún documento lo
 * consumía).
 */

import {
  mapCaseToPlaceholders,
  buildConciliationContext,
} from '@/features/document/placeholder-mapper';
import { asCaseWithRelations } from '@/features/document/persistence';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/**
 * Textos inconfundibles: si alguno aparece en la salida del mapper, solo puede
 * venir del desglose.
 */
const NOMBRE_OTRO = 'ZZQQ-SERVICIO-INTERNO-NOMBRE';
const DESCRIPCION_OTRO = 'ZZQQ-SERVICIO-INTERNO-DESCRIPCION';
const DESCRIPCION_GAS = 'ZZQQ-GAS-INTERNO-DESCRIPCION';

const DESGLOSE = [
  { tipo: 'GAS', nombre: 'Gas', descripcion: DESCRIPCION_GAS },
  { tipo: 'AGUA', nombre: 'Agua', descripcion: '' },
  { tipo: 'LUZ', nombre: 'Luz' },
  {
    tipo: 'OTRO',
    nombre: NOMBRE_OTRO,
    descripcion: DESCRIPCION_OTRO,
  },
];

const MARCADORES = [NOMBRE_OTRO, DESCRIPCION_OTRO, DESCRIPCION_GAS];

/** Claves del mapper que delatarían un placeholder nuevo del desglose. */
const PATRONES_DE_CLAVE = [
  /servicios?_?manutencion/i,
  /manutencion/i,
  /SERVICIO_\d/i,
  /DESGLOSE_SERVICIOS/i,
];

function conDesglose(scenarioName: string) {
  const scenario = SCENARIOS[scenarioName];
  const raw = scenario.build() as Record<string, unknown>;
  return asCaseWithRelations({
    ...raw,
    serviciosManutencion: DESGLOSE,
  } as Parameters<typeof asCaseWithRelations>[0]);
}

describe('servicios de manutención — invariante de no aparecer en documentos', () => {
  const escenarios = Object.keys(SCENARIOS);

  it('hay escenarios de los tres tipos de caso', () => {
    expect(escenarios.length).toBeGreaterThan(10);
  });

  describe.each(escenarios)('%s', (nombre) => {
    it('ninguna clave del mapper nombra el desglose', () => {
      const placeholders = mapCaseToPlaceholders(conDesglose(nombre));

      const sospechosas = Object.keys(placeholders).filter((clave) =>
        PATRONES_DE_CLAVE.some((patron) => patron.test(clave)),
      );

      expect(sospechosas).toEqual([]);
    });

    it('ningún valor del mapper contiene el texto de un servicio', () => {
      const placeholders = mapCaseToPlaceholders(conDesglose(nombre));

      const filtrados = Object.entries(placeholders)
        .filter(([, valor]) =>
          MARCADORES.some((marcador) => String(valor ?? '').includes(marcador)),
        )
        .map(([clave]) => clave);

      expect(filtrados).toEqual([]);
    });
  });

  it('el contexto de conciliación (arreglos de {{#each}}) tampoco lo lleva', () => {
    // Es la otra puerta de entrada al render: buildConciliationContext pasa
    // arreglos y banderas que no van por el PlaceholderMap plano.
    for (const nombre of escenarios.filter((n) =>
      n.startsWith('conciliacion'),
    )) {
      const contexto = buildConciliationContext(conDesglose(nombre));
      const serializado = JSON.stringify(contexto);

      for (const marcador of MARCADORES) {
        expect(serializado).not.toContain(marcador);
      }
      for (const patron of PATRONES_DE_CLAVE) {
        expect(Object.keys(contexto).some((k) => patron.test(k))).toBe(false);
      }
    }
  });
});
