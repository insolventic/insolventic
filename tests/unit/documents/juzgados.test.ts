/**
 * Juzgado actual y juzgado de origen de un proceso judicial: schema de
 * entrada, texto para el documento (ambos, uno, ninguno) y la fila "JUZGADO"
 * de la Solicitud de Insolvencia, sin frases rotas ni etiquetas huérfanas.
 * Los oficios siguen dirigidos al juzgado actual.
 */
import fs from 'fs';

import { legalProcessSchema } from '@/features/case/schemas';
import { textoJuzgados } from '@/features/document/placeholders/case-lists';
import {
  buildTemplateContext,
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import { templateVariants } from '@/features/document/template-variants';

import { makeCase, makeLegalProcess } from '../../helpers/mapper-fixtures';

const BASE = {
  processType: 'EJECUTIVO_SINGULAR',
  plaintiff: 'Banco X',
  court: 'Juzgado 5 Civil Municipal',
  fileNumber: '2025-001',
};

describe('legalProcessSchema', () => {
  it('el juzgado actual sigue siendo obligatorio', () => {
    const r = legalProcessSchema.safeParse({ ...BASE, court: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe('El juzgado actual es requerido');
  });

  it('el juzgado de origen es opcional (ausente, vacío o null)', () => {
    expect(legalProcessSchema.safeParse(BASE).success).toBe(true);
    expect(
      legalProcessSchema.safeParse({ ...BASE, originCourt: '' }).success,
    ).toBe(true);
    expect(
      legalProcessSchema.safeParse({ ...BASE, originCourt: null }).success,
    ).toBe(true);
    expect(
      legalProcessSchema.safeParse({
        ...BASE,
        originCourt: 'Juzgado 1 Civil del Circuito',
      }).success,
    ).toBe(true);
  });

  it('limita el largo del juzgado de origen', () => {
    expect(
      legalProcessSchema.safeParse({ ...BASE, originCourt: 'x'.repeat(201) })
        .success,
    ).toBe(false);
  });
});

describe('textoJuzgados', () => {
  it.each([
    [
      'ambos',
      'Juzgado 5',
      'Juzgado 1',
      'Juzgado 5 (juzgado de origen: Juzgado 1)',
    ],
    ['solo el actual (igual que antes)', 'Juzgado 5', null, 'Juzgado 5'],
    ['solo el actual, origen vacío', 'Juzgado 5', '   ', 'Juzgado 5'],
    ['solo el de origen', '', 'Juzgado 1', 'Juzgado de origen: Juzgado 1'],
    ['ninguno', null, undefined, ''],
  ])('%s', (_, actual, origen, esperado) => {
    expect(textoJuzgados(actual, origen)).toBe(esperado);
  });
});

function plantilla(id: string): string {
  const t = ALL_TEMPLATES.find(
    (x) => x.id === id && x.caseType === 'INSOLVENCY',
  )!;
  return fs.readFileSync(getTemplatePath(t), 'utf8').replace(/\r\n/g, '\n');
}

function filaJuzgado(
  procesos: Array<Record<string, unknown>>,
  n: number,
): string {
  const caso = makeCase({
    legalProcesses: procesos.map((p, i) => makeLegalProcess(i, p)),
  }) as never;
  const { html } = renderDocumentHtml(
    plantilla('solicitud-insolvencia'),
    mapCaseToPlaceholders(caso),
    buildTemplateContext(caso),
  );
  const filas = [
    ...html.matchAll(/<td class="label-td">JUZGADO<\/td><td>([^<]*)<\/td>/g),
  ];
  return filas[n - 1][1];
}

describe('Solicitud de Insolvencia — fila JUZGADO de cada proceso', () => {
  it('con los dos juzgados los muestra ambos', () => {
    expect(
      filaJuzgado(
        [{ court: 'Juzgado 5 Civil', originCourt: 'Juzgado 1 Civil' }],
        1,
      ),
    ).toBe('Juzgado 5 Civil (juzgado de origen: Juzgado 1 Civil)');
  });

  it('solo con el actual sale igual que antes', () => {
    expect(
      filaJuzgado([{ court: 'Juzgado 5 Civil', originCourt: null }], 1),
    ).toBe('Juzgado 5 Civil');
  });

  it('solo con el de origen lo rotula, sin etiqueta suelta del actual', () => {
    const texto = filaJuzgado(
      [{ court: null, originCourt: 'Juzgado 1 Civil' }],
      1,
    );
    expect(texto).toBe('Juzgado de origen: Juzgado 1 Civil');
  });

  it('sin ninguno sale "N/A", como antes (sin "()" ni ":" sueltos)', () => {
    // El mapper ya rellenaba con N/A una celda de juzgado vacía; se conserva.
    expect(filaJuzgado([{ court: null, originCourt: null }], 1)).toBe('N/A');
  });

  it('un caso sin procesos sigue mostrando N/A', () => {
    expect(filaJuzgado([], 1)).toBe('N/A');
  });

  it('el texto del juzgado se escapa', () => {
    const texto = filaJuzgado(
      [{ court: 'Juzgado <b>5</b>', originCourt: 'Juzgado & Cía' }],
      1,
    );
    expect(texto).toBe(
      'Juzgado &lt;b&gt;5&lt;/b&gt; (juzgado de origen: Juzgado &amp; Cía)',
    );
  });
});

describe('los oficios siguen dirigidos al juzgado actual', () => {
  it('NOMBRE_JUZGADO y las variantes por juzgado usan court, no originCourt', () => {
    const caso = makeCase({
      legalProcesses: [
        makeLegalProcess(0, {
          court: 'Juzgado 5 Civil',
          originCourt: 'Juzgado 1 Civil',
        }),
      ],
    }) as never;
    expect(mapCaseToPlaceholders(caso).NOMBRE_JUZGADO).toBe('Juzgado 5 Civil');
    const t = ALL_TEMPLATES.find((x) => x.id === 'suspension-juzgados')!;
    const variantes = templateVariants(t, caso);
    expect(variantes.map((v) => v.label)).toEqual(['Juzgado 5 Civil']);
  });
});
