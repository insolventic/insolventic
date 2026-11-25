/**
 * Gastos mensuales en los documentos generados.
 *
 * Renderiza la Solicitud de Insolvencia real (y una plantilla de Fracaso, que
 * usa PROPUESTA_PAGO) con el mismo pipeline de producción y verifica, para cada
 * caso borde, que cada concepto sale con su valor mensual, que los de $0 no
 * salen, que de los prorrateados no aparece el valor anual, y que el total del
 * documento es idéntico al del formulario (`totalEnVivo`) y al del servidor
 * (`calcularGastos`) en las cuatro secciones que lo usan.
 */
import fs from 'fs';

import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { generateExcelForCase } from '@/features/document/generate-excel';
import {
  MAX_OTROS_GASTOS,
  calcularGastos,
  totalEnVivo,
  type EntradaGastos,
} from '@/features/case/gastos-mensuales';
import { formatCurrency } from '@/features/document/placeholders/format';
import ExcelJS from 'exceljs';

import { makeCase, type Row } from '../../helpers/mapper-fixtures';

function plantilla(id: string): string {
  const t = ALL_TEMPLATES.find(
    (x) => x.id === id && x.caseType === 'INSOLVENCY',
  );
  if (!t) throw new Error(`plantilla ${id} no registrada`);
  return fs.readFileSync(getTemplatePath(t), 'utf8').replace(/\r\n/g, '\n');
}

function casoCon(extra: Row) {
  return makeCase({ overrides: extra }) as never;
}

function render(id: string, caso: never) {
  const placeholders = mapCaseToPlaceholders(caso);
  const { html, unresolved } = renderDocumentHtml(
    plantilla(id),
    placeholders,
    buildTemplateContext(caso),
  );
  return { html, unresolved, placeholders };
}

/** La sección 9 de la Solicitud, entre su título y el de la 10. */
function seccion9(html: string): string {
  const desde = html.indexOf('9. VALOR GASTOS GENERALES MENSUALES');
  const hasta = html.indexOf('10. OBLIGACIONES ALIMENTARIAS');
  expect(desde).toBeGreaterThan(-1);
  expect(hasta).toBeGreaterThan(desde);
  return html.slice(desde, hasta);
}

/** `formatCurrency` separa "$" del número con un espacio duro (Intl). */
const sinNbsp = (texto: string) => texto.replace(/ /g, ' ');

/** Filas `[concepto, valor]` de la tabla de gastos. */
function filas(seccion: string): [string, string][] {
  return [
    ...seccion.matchAll(
      /<tr[^>]*>\s*<td[^>]*>((?:(?!<\/tr>).)*?)<\/td>\s*<td[^>]*>((?:(?!<\/tr>).)*?)<\/td>\s*<\/tr>/g,
    ),
  ].map((m) => [
    m[1].replace(/<[^>]+>/g, ''),
    sinNbsp(m[2].replace(/<[^>]+>/g, '')),
  ]);
}

function detalle(entrada: EntradaGastos) {
  const r = calcularGastos(entrada);
  if (!r.ok || !r.detalle) throw new Error(JSON.stringify(r));
  return r.detalle;
}

/** Sin las 7 columnas legadas que `fill: 'complete'` llena, para aislar el detalle. */
const SIN_LEGADO: Row = {
  gastosVivienda: null,
  gastosAlimentacion: null,
  gastosServiciosPublicos: null,
  gastosTransporte: null,
  gastosEducacion: null,
  gastosSalud: null,
  otrosGastos: null,
};

describe('Solicitud de Insolvencia — §9 detalle de gastos', () => {
  const ENTRADA: EntradaGastos = {
    conceptos: {
      ARRIENDO: { valor: '800.000' },
      ADMINISTRACION: { valor: '0' },
      LUZ: { valor: '95.500' },
      IMPUESTOS: { valor: '1.000.000' }, // 83.333,33 → 83.333
      UNIFORMES: { valor: '150' }, // 12,5 → 13
      MATRICULA: { valor: '1.800.000', periodicidad: 'UNIVERSIDAD' }, // 300.000
    },
    otros: [{ concepto: 'Gas', valor: '45.000' }],
  };

  it('una fila por concepto con su valor mensual, en orden del catálogo, y el total', () => {
    const { html, unresolved } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: detalle(ENTRADA) }),
    );
    expect(unresolved).not.toContain('GASTOS_DETALLE_TABLA');
    expect(filas(seccion9(html))).toEqual([
      ['Arriendo', '$ 800.000'],
      ['Luz', '$ 95.500'],
      ['Uniformes', '$ 13'],
      ['Matrícula', '$ 300.000'],
      ['Impuestos', '$ 83.333'],
      ['Gas', '$ 45.000'],
      ['TOTAL GASTOS MENSUALES', '$ 1.323.846'],
    ]);
  });

  it('el total del documento es el mismo del formulario y del servidor, en §9, §11 y §12', () => {
    const { html, placeholders } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: detalle(ENTRADA) }),
    );
    const esperado = formatCurrency(totalEnVivo(ENTRADA));
    expect(esperado).toBe(formatCurrency(detalle(ENTRADA).total));
    expect(placeholders.GASTOS_MENSUALES).toBe(esperado);
    expect(placeholders.RECURSOS_GASTOS).toBe(esperado);
    expect(placeholders.PROPUESTA_GASTOS).toBe(esperado);
    // §11 y §12 en el HTML renderizado.
    const resto = html.slice(html.indexOf('11. DE LOS RECURSOS DISPONIBLES'));
    expect(resto.split(esperado).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('no muestra el valor anual ni semestral de los prorrateados, ni las líneas en $0', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: detalle(ENTRADA) }),
    );
    const s9 = seccion9(html);
    expect(s9).not.toContain('1.000.000');
    expect(s9).not.toContain('1.800.000');
    expect(s9).not.toContain('Administración');
  });

  it('ya no imprime "$ $" (el formato de moneda trae su propio signo)', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: detalle(ENTRADA) }),
    );
    expect(seccion9(html)).not.toMatch(/\$\s*\$/);
  });

  it('todo en cero: solo la fila de total en $ 0', () => {
    const cero = detalle({ conceptos: { ARRIENDO: { valor: '0' } } });
    const { html, placeholders } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: cero }),
    );
    expect(filas(seccion9(html))).toEqual([['TOTAL GASTOS MENSUALES', '$ 0']]);
    expect(sinNbsp(placeholders.GASTOS_MENSUALES)).toBe('$ 0');
  });

  it('solo "Otros"', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({
        ...SIN_LEGADO,
        gastosMensualesDetalle: detalle({
          otros: [
            { concepto: 'Gas', valor: '45.000' },
            { concepto: 'Cuota de manejo', valor: '12.000' },
          ],
        }),
      }),
    );
    expect(filas(seccion9(html))).toEqual([
      ['Gas', '$ 45.000'],
      ['Cuota de manejo', '$ 12.000'],
      ['TOTAL GASTOS MENSUALES', '$ 57.000'],
    ]);
  });

  it(`muchas filas en "Otros" (${MAX_OTROS_GASTOS}) y nombres largos: todas salen, sin cortarse entre páginas`, () => {
    const largo = 'Cuota extraordinaria de la junta de acción comunal '
      .repeat(2)
      .trim();
    const otros = Array.from({ length: MAX_OTROS_GASTOS }, (_, i) => ({
      concepto: i === 0 ? largo.slice(0, 120) : `Gasto ${i + 1}`,
      valor: '1.000',
    }));
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, gastosMensualesDetalle: detalle({ otros }) }),
    );
    const s9 = seccion9(html);
    const f = filas(s9);
    expect(f).toHaveLength(MAX_OTROS_GASTOS + 1);
    expect(f[0][0]).toBe(largo.slice(0, 120));
    expect(f.at(-1)).toEqual([
      'TOTAL GASTOS MENSUALES',
      `$ ${(MAX_OTROS_GASTOS * 1000).toLocaleString('es-CO')}`,
    ]);
    // Cada fila evita partirse (las 50 y el subtítulo "Otros gastos") y el
    // concepto hace salto de línea.
    expect(
      s9.match(/<tr style="page-break-inside: avoid; break-inside: avoid;">/g),
    ).toHaveLength(MAX_OTROS_GASTOS + 1);
    expect(s9).toContain('overflow-wrap: anywhere');
    expect(s9).toContain('display: table-header-group');
  });

  it('caso viejo con las 7 columnas: detalle derivado y total = su suma', () => {
    const { html, placeholders } = render(
      'solicitud-insolvencia',
      casoCon({
        gastosVivienda: 800000,
        gastosAlimentacion: 600000,
        gastosServiciosPublicos: 250000,
        gastosTransporte: 300000,
        gastosEducacion: 400000,
        gastosSalud: 150000,
        otrosGastos: 300000,
        monthlyExpenses: 2750000,
      }),
    );
    expect(filas(seccion9(html)).at(-1)).toEqual([
      'TOTAL GASTOS MENSUALES',
      '$ 2.800.000',
    ]);
    expect(filas(seccion9(html)).map((r) => r[0])).toContain(
      'Servicios públicos (histórico)',
    );
    expect(sinNbsp(placeholders.GASTOS_MENSUALES)).toBe('$ 2.800.000');
  });

  it('caso viejo sin ninguna columna: sigue usando monthlyExpenses (sin desglose)', () => {
    const { html, placeholders } = render(
      'solicitud-insolvencia',
      casoCon({ ...SIN_LEGADO, monthlyExpenses: 2750000 }),
    );
    expect(filas(seccion9(html))).toEqual([
      ['TOTAL GASTOS MENSUALES', '$ 2.750.000'],
    ]);
    expect(sinNbsp(placeholders.GASTOS_MENSUALES)).toBe('$ 2.750.000');
    expect(sinNbsp(placeholders.RECURSOS_GASTOS)).toBe('$ 2.750.000');
  });

  it('un concepto libre con HTML sale escapado', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({
        ...SIN_LEGADO,
        gastosMensualesDetalle: detalle({
          otros: [{ concepto: '<img src=x onerror=alert(1)>', valor: '1' }],
        }),
      }),
    );
    expect(seccion9(html)).not.toContain('<img');
    expect(seccion9(html)).toContain('&lt;img');
  });
});

describe('§9 — subtítulo "Otros gastos"', () => {
  const SUBTITULO = /<td colspan="2"[^>]*>Otros gastos<\/td>/;

  it('agrupa las filas libres bajo "Otros gastos", después de los conceptos fijos', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({
        ...SIN_LEGADO,
        gastosMensualesDetalle: detalle({
          conceptos: { ARRIENDO: { valor: '800.000' } },
          otros: [{ concepto: 'Gas', valor: '45.000' }],
        }),
      }),
    );
    const s9 = seccion9(html);
    expect(s9).toMatch(SUBTITULO);
    const posArriendo = s9.indexOf('Arriendo');
    const posSubtitulo = s9.search(SUBTITULO);
    const posGas = s9.indexOf('>Gas<');
    expect(posArriendo).toBeLessThan(posSubtitulo);
    expect(posSubtitulo).toBeLessThan(posGas);
  });

  it('sin filas libres no imprime el subtítulo', () => {
    const { html } = render(
      'solicitud-insolvencia',
      casoCon({
        ...SIN_LEGADO,
        gastosMensualesDetalle: detalle({
          conceptos: { ARRIENDO: { valor: '800.000' } },
        }),
      }),
    );
    expect(seccion9(html)).not.toMatch(SUBTITULO);
  });
});

describe('PROPUESTA_PAGO (plantillas de Fracaso) usa el mismo total', () => {
  it('gastos y disponible de la propuesta salen del detalle', () => {
    const caso = casoCon({
      ...SIN_LEGADO,
      gastosMensualesDetalle: detalle({
        conceptos: { ARRIENDO: { valor: '700.000' } },
      }),
    });
    const { PROPUESTA_PAGO } = mapCaseToPlaceholders(caso);
    expect(PROPUESTA_PAGO).toContain('Gastos Mensuales:');
    expect(sinNbsp(PROPUESTA_PAGO)).toContain('$ 700.000');
  });
});

describe('Excel "Ingresos y Gastos"', () => {
  it('lista los conceptos y el total del detalle', async () => {
    const caso = casoCon({
      ...SIN_LEGADO,
      gastosMensualesDetalle: detalle({
        conceptos: {
          ARRIENDO: { valor: '700.000' },
          IMPUESTOS: { valor: '1.200.000' },
        },
        otros: [{ concepto: 'Gas', valor: '30.000' }],
      }),
    });
    const buffer = await generateExcelForCase(caso);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const hoja = wb.getWorksheet('Ingresos y Gastos')!;
    const filasHoja: [string, number][] = [];
    hoja.eachRow((r) => {
      const a = r.getCell(1).value;
      const b = r.getCell(2).value;
      if (typeof a === 'string' && typeof b === 'number')
        filasHoja.push([a, b]);
    });
    expect(filasHoja).toEqual(
      expect.arrayContaining([
        ['Arriendo', 700000],
        ['Impuestos', 100000],
        ['Gas', 30000],
        ['TOTAL GASTOS', 830000],
      ]),
    );
  });
});
