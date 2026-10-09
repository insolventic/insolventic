/**
 * Un oficio de suspensión por cada juzgado del caso.
 *
 * `Suspension Juzgados Procesos Judiciales.html` es un oficio dirigido a UN
 * juzgado. El pipeline era "una plantilla = un documento", así que un caso con
 * procesos en tres juzgados producía un solo oficio, con los datos de
 * `legalProcesses[0]`: los otros dos juzgados nunca se enteraban y sus procesos
 * seguían corriendo.
 *
 * Estos tests fijan las cuatro cosas que pueden romperse al generar N
 * documentos de una plantilla: cuántas variantes salen, que el contenido de
 * cada una apunte a SU juzgado, que los nombres de archivo y las claves del
 * lote no colisionen, y que el gate de placeholders sin resolver siga limpio.
 */

import fs from 'fs';

import {
  templateVariants,
  jobKey,
} from '@/features/document/template-variants';
import {
  ALL_TEMPLATES,
  getTemplatePath,
} from '@/features/document/templates-config';
import {
  mapCaseToPlaceholders,
  renderDocumentHtml,
} from '@/features/document/placeholder-mapper';

const OFICIO = ALL_TEMPLATES.find((t) => t.id === 'suspension-juzgados')!;
const OTRA = ALL_TEMPLATES.find((t) => t.id === 'solicitud-insolvencia')!;

type Proceso = {
  court?: string | null;
  plaintiff?: string | null;
  processType?: string | null;
  processTypeOther?: string | null;
};

const makeCase = (legalProcesses: Proceso[] = []) =>
  ({
    type: 'INSOLVENCY',
    // Tenant REAL: el membrete por centro falla cerrado ante un tenant
    // desconocido (membrete-centro.ts), asi que un caso sin el no resuelve los
    // placeholders del membrete y el gate bloquearia la generacion.
    tenantId: 'constructores-paz',
    caseNumber: 'INS-2026-077',
    debtor: {
      name: 'Ana Torres',
      idNumber: '987654321',
      address: 'Calle 8 # 3-20',
      city: 'Bogotá',
      email: 'ana@example.com',
      phone: '3001112222',
      occupation: 'Comerciante',
    },
    debts: [],
    assets: [],
    documents: [],
    legalProcesses,
    libranzas: [],
    suspendedServices: [],
    dependents: [],
    causes: [],
    applicantScope: [],
    operator: null,
  }) as never;

const TRES_JUZGADOS: Proceso[] = [
  {
    court: 'Juzgado 1 Civil Municipal de Cali',
    plaintiff: 'Banco Uno S.A.',
    processType: 'EJECUTIVO',
  },
  {
    court: 'Juzgado 2 Civil Municipal de Cali',
    plaintiff: 'Cooperativa Dos',
    processType: 'RESTITUCION_INMUEBLE',
  },
  {
    court: 'Juzgado 3 Laboral del Circuito de Cali',
    plaintiff: 'Empleador Tres Ltda.',
    processType: 'LABORAL',
  },
];

describe('templateVariants — cuántos documentos produce una plantilla', () => {
  it('una plantilla sin variantes declaradas produce un solo documento, sin sufijo', () => {
    const variantes = templateVariants(OTRA, makeCase(TRES_JUZGADOS));

    expect(variantes).toEqual([{ suffix: '', label: '', overlay: {} }]);
  });

  it('el oficio con tres juzgados produce tres variantes', () => {
    const variantes = templateVariants(OFICIO, makeCase(TRES_JUZGADOS));

    expect(variantes).toHaveLength(3);
    expect(variantes.map((v) => v.overlay.NOMBRE_JUZGADO)).toEqual([
      'Juzgado 1 Civil Municipal de Cali',
      'Juzgado 2 Civil Municipal de Cali',
      'Juzgado 3 Laboral del Circuito de Cali',
    ]);
  });

  it('dos procesos en el MISMO juzgado se notifican con un solo oficio', () => {
    const variantes = templateVariants(
      OFICIO,
      makeCase([
        { court: 'Juzgado 5 Civil', plaintiff: 'Banco A' },
        { court: 'Juzgado 5 Civil', plaintiff: 'Banco B' },
      ]),
    );

    expect(variantes).toHaveLength(1);
    expect(variantes[0].overlay.NOMBRE_DEMANDANTE).toBe('Banco A');
  });

  it('un proceso sin juzgado no produce oficio: no hay a quién dirigirlo', () => {
    const variantes = templateVariants(
      OFICIO,
      makeCase([
        { court: 'Juzgado 5 Civil', plaintiff: 'Banco A' },
        { court: '   ', plaintiff: 'Sin juzgado' },
        { court: null, plaintiff: 'Tampoco' },
      ]),
    );

    expect(variantes).toHaveLength(1);
    expect(variantes[0].overlay.NOMBRE_JUZGADO).toBe('Juzgado 5 Civil');
  });

  it('un caso sin procesos sigue produciendo el documento único de siempre', () => {
    const variantes = templateVariants(OFICIO, makeCase([]));

    expect(variantes).toEqual([{ suffix: '', label: '', overlay: {} }]);
  });
});

describe('nombres de archivo y claves del lote', () => {
  it('con UN juzgado el nombre de archivo no cambia (sufijo vacío)', () => {
    const variantes = templateVariants(OFICIO, makeCase([TRES_JUZGADOS[0]]));

    expect(variantes).toHaveLength(1);
    expect(variantes[0].suffix).toBe('');
    expect(jobKey(OFICIO, variantes[0])).toBe('suspension-juzgados');
  });

  it('con varios juzgados los sufijos son distintos entre sí', () => {
    const variantes = templateVariants(OFICIO, makeCase(TRES_JUZGADOS));
    const sufijos = variantes.map((v) => v.suffix);

    expect(new Set(sufijos).size).toBe(3);
    expect(sufijos[0]).toBe('_1_Juzgado_1_Civil_Municipal_de_Cali');
  });

  it('las claves del lote son distintas: con template.id el 2.º oficio subiría el PDF del 1.º', () => {
    const claves = templateVariants(OFICIO, makeCase(TRES_JUZGADOS)).map((v) =>
      jobKey(OFICIO, v),
    );

    expect(new Set(claves).size).toBe(3);
  });

  it('los nombres de archivo completos son distintos', () => {
    const caseNumber = 'INS-2026-077';
    const nombres = templateVariants(OFICIO, makeCase(TRES_JUZGADOS)).map(
      (v) => `${caseNumber}_${OFICIO.name.replace(/\s+/g, '_')}${v.suffix}.pdf`,
    );

    expect(new Set(nombres).size).toBe(3);
  });

  it('el sufijo no arrastra tildes, puntuación ni barras (rompen la ruta en Drive)', () => {
    const variantes = templateVariants(
      OFICIO,
      makeCase([
        { court: 'Juzgado 3.º Civil / Sec. 2 — Bogotá' },
        { court: 'Otro juzgado' },
      ]),
    );

    expect(variantes[0].suffix).toBe('_1_Juzgado_3_Civil_Sec_2_Bogota');
    expect(variantes[0].suffix).not.toMatch(/[^\w]/);
  });

  it('un nombre de juzgado larguísimo no desborda el nombre de archivo', () => {
    const variantes = templateVariants(
      OFICIO,
      makeCase([{ court: 'J'.repeat(200) }, { court: 'Otro' }]),
    );

    // 3 del prefijo "_1_" + 40 del slug recortado.
    expect(variantes[0].suffix).toHaveLength(43);
  });
});

describe('el label distingue las filas de Document', () => {
  it('lleva el nombre del juzgado, no el slug del archivo', () => {
    const variantes = templateVariants(OFICIO, makeCase(TRES_JUZGADOS));

    expect(variantes.map((v) => v.label)).toEqual([
      'Juzgado 1 Civil Municipal de Cali',
      'Juzgado 2 Civil Municipal de Cali',
      'Juzgado 3 Laboral del Circuito de Cali',
    ]);
  });

  it('con un solo juzgado hay label (fila más precisa) pero no sufijo (archivo igual)', () => {
    const [v] = templateVariants(OFICIO, makeCase([TRES_JUZGADOS[0]]));

    expect(v.label).toBe('Juzgado 1 Civil Municipal de Cali');
    expect(v.suffix).toBe('');
  });
});

describe('tipo de proceso: la etiqueta, no el valor guardado', () => {
  it('traduce el valor persistido a la etiqueta que dictó la abogada', () => {
    const variantes = templateVariants(OFICIO, makeCase(TRES_JUZGADOS));

    expect(variantes.map((v) => v.overlay.TIPO_PROCESO)).toEqual([
      'Ejecutivo',
      'Restitución de inmueble',
      'Laboral',
    ]);
  });

  it('en "Otros" usa el texto libre del operador, no la palabra OTROS', () => {
    const [v] = templateVariants(
      OFICIO,
      makeCase([
        {
          court: 'Juzgado 9',
          processType: 'OTROS',
          processTypeOther: 'Proceso monitorio',
        },
      ]),
    );

    expect(v.overlay.TIPO_PROCESO).toBe('Proceso monitorio');
  });
});

describe('el oficio renderizado va dirigido a SU juzgado', () => {
  const html = fs.readFileSync(getTemplatePath(OFICIO), 'utf-8');

  it('cada variante nombra su juzgado, su demandante y su tipo de proceso', () => {
    const caseData = makeCase(TRES_JUZGADOS);
    const placeholders = mapCaseToPlaceholders(caseData);

    const renders = templateVariants(OFICIO, caseData).map(
      (v) => renderDocumentHtml(html, { ...placeholders, ...v.overlay }).html,
    );

    expect(renders[0]).toContain('Juzgado 1 Civil Municipal de Cali');
    expect(renders[0]).toContain('Banco Uno S.A.');
    expect(renders[0]).toContain('Ejecutivo');
    expect(renders[0]).not.toContain('Juzgado 2 Civil Municipal de Cali');

    expect(renders[1]).toContain('Juzgado 2 Civil Municipal de Cali');
    expect(renders[1]).toContain('Cooperativa Dos');
    expect(renders[1]).not.toContain('Banco Uno S.A.');

    expect(renders[2]).toContain('Juzgado 3 Laboral del Circuito de Cali');
    expect(renders[2]).toContain('Empleador Tres Ltda.');
    expect(renders[2]).not.toContain('Cooperativa Dos');
  });

  it('ninguna variante deja placeholders sin resolver (el gate bloquearía la generación)', () => {
    const caseData = makeCase(TRES_JUZGADOS);
    const placeholders = mapCaseToPlaceholders(caseData);

    for (const v of templateVariants(OFICIO, caseData)) {
      const { unresolved } = renderDocumentHtml(html, {
        ...placeholders,
        ...v.overlay,
      });
      expect(unresolved).toEqual([]);
    }
  });

  it('el overlay solo pisa los campos del proceso: el resto del oficio es el mismo', () => {
    const caseData = makeCase(TRES_JUZGADOS);
    const placeholders = mapCaseToPlaceholders(caseData);

    for (const v of templateVariants(OFICIO, caseData)) {
      const { html: render } = renderDocumentHtml(html, {
        ...placeholders,
        ...v.overlay,
      });
      expect(render).toContain('Ana Torres');
      expect(render).toContain('987654321');
    }
  });
});
