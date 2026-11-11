/**
 * Un placeholder que el sistema no puede llenar tiene que salir como un blanco
 * para llenar a mano, nunca como nada.
 *
 * Hay datos que el mapper no tiene porque se dictan en la audiencia o los
 * escribe el operador sobre el papel. Emitirlos como `''` no los deja
 * pendientes: los borra. La frase se cierra sobre la nada y el documento sale
 * con un hueco mudo, visualmente indistinguible de uno completo:
 *
 *   «…se cede el uso de la palabra a  se verifican las pruebas .»
 *   «…fijar fecha para el día  de  de 2026 a las »
 *
 * y en el Fracaso por Impugnación la sección HECHOS salía vacía entera. Es el
 * mismo riesgo que `renderDocumentHtml` documenta querer evitar con los
 * placeholders ausentes, solo que por la otra puerta (auditoría 2026-10-27).
 *
 * El test recorre las PLANTILLAS, no una lista escrita a mano: busca toda
 * clave que una plantilla imprima fuera de un `{{#if}}` y que el mapper
 * resuelva a vacío con un caso completo. Si mañana alguien agrega un
 * placeholder manual y lo deja en `''`, este test lo encuentra solo.
 */

import fs from 'fs';
import path from 'path';

import {
  mapCaseToPlaceholders,
  type PlaceholderMap,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';

import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Escenario completo de cada tipo: lo que no se llena acá, no se llena nunca. */
const ESCENARIO_COMPLETO: Record<string, string> = {
  INSOLVENCY: 'insolvencia-completa',
  CONCILIATION: 'conciliacion-con-fechas',
  SUPPORT_AGREEMENT: 'apoyo-completo',
};

const leerPlantilla = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');

/** `true` si la plantilla imprime la clave FUERA de su propio `{{#if}}`. */
function seImprimeSinGuarda(html: string, clave: string): boolean {
  const sinIf = html.replace(
    new RegExp('\\{\\{#if ' + clave + '\\}\\}[\\s\\S]*?\\{\\{\\/if\\}\\}', 'g'),
    '',
  );
  return new RegExp('\\{\\{' + clave + '\\}\\}').test(sinIf);
}

/**
 * La mitad no marcada de una casilla SI/NO, o una casilla suelta de marca.
 *
 * No son huecos: el vacío ES el dato —«no ofrece este seguro», «no eligió esta
 * opción»—. Poner una raya ahí diría que falta algo por llenar cuando el
 * expediente ya respondió. `PROP_SEGURO_INCENDIO` y `PROP_SEGURO_VIDA` salen
 * de `insuranceOffering`, que es un campo capturado.
 */
const MARCAS_SUELTAS = new Set(['PROP_SEGURO_INCENDIO', 'PROP_SEGURO_VIDA']);

function esCasillaSinMarcar(clave: string, map: PlaceholderMap): boolean {
  if (MARCAS_SUELTAS.has(clave)) return true;
  const hermana = clave.startsWith('SI_')
    ? 'NO_' + clave.slice(3)
    : clave.startsWith('NO_')
      ? 'SI_' + clave.slice(3)
      : clave.endsWith('_SI')
        ? clave.slice(0, -3) + '_NO'
        : clave.endsWith('_NO')
          ? clave.slice(0, -3) + '_SI'
          : null;
  return hermana ? (map[hermana] ?? '') !== '' : false;
}

/** Huecos reales por plantilla, con un caso completo de su tipo. */
function huecosPorPlantilla(): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  const mapas = new Map<string, PlaceholderMap>();

  for (const plantilla of ALL_TEMPLATES) {
    const nombreEscenario = ESCENARIO_COMPLETO[plantilla.caseType];
    if (!mapas.has(nombreEscenario)) {
      const caso = SCENARIOS[nombreEscenario].build() as never;
      mapas.set(nombreEscenario, mapCaseToPlaceholders(caso));
    }
    const map = mapas.get(nombreEscenario)!;
    const html = leerPlantilla(getTemplatePath(plantilla));

    const referenciadas = [
      ...new Set(
        [...html.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]),
      ),
    ];

    const huecos = referenciadas
      .filter((k) => k in map && (map[k] ?? '') === '')
      .filter((k) => seImprimeSinGuarda(html, k))
      .filter((k) => !esCasillaSinMarcar(k, map));

    if (huecos.length) salida[plantilla.name] = huecos.sort();
  }

  return salida;
}

describe('placeholders manuales', () => {
  it('ninguna plantilla imprime una clave conocida en vacío', () => {
    expect(huecosPorPlantilla()).toEqual({});
  });

  describe('los ocho que dejaban el hueco salen como blanco', () => {
    const CASOS: Array<[string, string]> = [
      ['DIA_PROXIMA', '____'],
      ['MES_PROXIMA', '____________'],
      ['HORA_PROXIMA', '____:____'],
      ['NOMBRE_PERSONA', '________________________________'],
      ['DESCRIPCION_PRUEBAS', '________________________________'],
      ['HECHO_1', '________________________________'],
      ['HECHO_2', '________________________________'],
      ['HECHO_3', '________________________________'],
    ];

    const map = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-completa'].build() as never,
    );

    for (const [clave, esperado] of CASOS) {
      it(`${clave} sale como una raya para llenar`, () => {
        expect(map[clave]).toBe(esperado);
      });
    }
  });

  it('los ocho usan anchos que el validador cuenta como vacíos', () => {
    // `validatePlaceholderCoverage` decide si un campo está lleno comparando
    // contra una lista cerrada de anchos (`emptyIndicators`). Un ancho que no
    // esté en esa lista cuenta como "campo lleno" y sube falsamente el
    // porcentaje de cobertura del documento.
    //
    // ALCANCE: se afirma solo sobre las ocho claves de este cambio. El mapper
    // tiene además 9 placeholders con un ancho de 20 guiones que la lista NO
    // reconoce, y que por eso hoy se cuentan como llenos. Es anterior a este
    // cambio y se deja anotado, no corregido acá: tocar esos 9 mueve el
    // porcentaje de cobertura de varias plantillas y merece su propio cambio.
    const RECONOCIDOS = new Set([
      '____',
      '______',
      '____________',
      '________________',
      '________________________________',
      '____:____',
    ]);
    const map = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-completa'].build() as never,
    );
    const OCHO = [
      'DIA_PROXIMA',
      'MES_PROXIMA',
      'HORA_PROXIMA',
      'NOMBRE_PERSONA',
      'DESCRIPCION_PRUEBAS',
      'HECHO_1',
      'HECHO_2',
      'HECHO_3',
    ];

    for (const clave of OCHO) {
      expect(RECONOCIDOS.has(map[clave])).toBe(true);
    }
  });

  it('las marcas sueltas siguen vacías: el vacío es el dato', () => {
    const map = mapCaseToPlaceholders(
      SCENARIOS['insolvencia-completa'].build() as never,
    );
    // El escenario completo no ofrece seguros, así que las dos van vacías y
    // eso es correcto: no es un campo por llenar.
    for (const clave of MARCAS_SUELTAS) {
      expect(map[clave]).toBe('');
    }
  });
});
