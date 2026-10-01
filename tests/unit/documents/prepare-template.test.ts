/**
 * Fase 1 compartida: leer la plantilla, aplicar el overlay de la variante,
 * renderizar y medir.
 *
 * Estaba escrita dos veces, en dos archivos: `prepareDocument` (ruta
 * automática) y `batchGenerateDocuments` (ruta manual de `/documents`). Se
 * notó al agregar el oficio por juzgado — el mismo cambio hubo que hacerlo en
 * los dos lugares, incluido el string del nombre a mostrar, que podía divergir
 * sin que nada avisara.
 *
 * Lo que estos tests fijan es el contrato del módulo compartido. Que las dos
 * rutas lo usen de verdad, y que sigan dando el mismo resultado que antes, lo
 * cubren el golden master y `generate-documents-pipeline.test.ts`.
 */

import {
  prepareTemplate,
  variantDisplayName,
  readTemplateFile,
  SIN_VARIANTE,
} from '@/features/document/prepare-template';
import { templateVariants } from '@/features/document/template-variants';
import { ALL_TEMPLATES } from '@/features/document/templates-config';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';

const OFICIO = ALL_TEMPLATES.find((t) => t.id === 'suspension-juzgados')!;
const SOLICITUD = ALL_TEMPLATES.find((t) => t.id === 'solicitud-insolvencia')!;

const makeCase = (legalProcesses: Record<string, unknown>[] = []) =>
  ({
    type: 'INSOLVENCY',
    caseNumber: 'INS-2026-090',
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

const DOS_JUZGADOS = [
  {
    court: 'Juzgado 1 Civil Municipal de Cali',
    plaintiff: 'Banco Uno S.A.',
    processType: 'EJECUTIVO',
  },
  {
    court: 'Juzgado 2 Laboral del Circuito',
    plaintiff: 'Empleador Dos Ltda.',
    processType: 'LABORAL',
  },
];

describe('variantDisplayName — un solo lugar donde se arma el nombre', () => {
  it('sin variantes devuelve el nombre de la plantilla, tal cual', () => {
    expect(variantDisplayName(SOLICITUD, SIN_VARIANTE)).toBe(SOLICITUD.name);
  });

  it('con variante agrega el ítem al nombre', () => {
    const [v1] = templateVariants(OFICIO, makeCase(DOS_JUZGADOS));

    expect(variantDisplayName(OFICIO, v1)).toBe(
      'Suspension Juzgados — Juzgado 1 Civil Municipal de Cali',
    );
  });

  it('las dos rutas producen el MISMO nombre para la misma variante', () => {
    // Antes cada ruta lo construía por su cuenta; lo que este test evita es
    // que vuelvan a divergir. Si alguien cambia el separador, cambia para las
    // dos a la vez o este test no dice nada — por eso lo que se fija es el
    // formato concreto, arriba, y acá la fuente única.
    const [v1] = templateVariants(OFICIO, makeCase(DOS_JUZGADOS));
    const fs = require('fs');
    const path = require('path');
    const leer = (rel: string) =>
      fs.readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');

    const auto = leer('features/document/generate-documents.ts');
    const manual = leer('features/document/actions.ts');

    for (const fuente of [auto, manual]) {
      expect(fuente).toContain('variantDisplayName');
      // El literal viejo, construido a mano, no debe volver.
      expect(fuente).not.toMatch(/\$\{template\.name\} — \$\{variant\.label\}/);
    }
    expect(variantDisplayName(OFICIO, v1)).toContain('—');
  });
});

describe('prepareTemplate', () => {
  it('rellena la plantilla y no deja placeholders sin resolver', async () => {
    const caseData = makeCase(DOS_JUZGADOS);
    const [v1] = templateVariants(OFICIO, caseData);

    const p = await prepareTemplate(
      OFICIO,
      mapCaseToPlaceholders(caseData),
      undefined,
      v1,
    );

    expect(p.unresolved).toEqual([]);
    expect(p.html).toContain('Juzgado 1 Civil Municipal de Cali');
  });

  it('el overlay de la variante pisa los placeholders del caso', async () => {
    const caseData = makeCase(DOS_JUZGADOS);
    const base = mapCaseToPlaceholders(caseData);
    const [, v2] = templateVariants(OFICIO, caseData);

    const p = await prepareTemplate(OFICIO, base, undefined, v2);

    // El mapper, sin overlay, pone siempre el primer juzgado.
    expect(base.NOMBRE_JUZGADO).toBe('Juzgado 1 Civil Municipal de Cali');
    expect(p.placeholders.NOMBRE_JUZGADO).toBe(
      'Juzgado 2 Laboral del Circuito',
    );
    expect(p.html).toContain('Juzgado 2 Laboral del Circuito');
    expect(p.html).not.toContain('Juzgado 1 Civil Municipal de Cali');
  });

  it('sin overlay devuelve los placeholders del caso sin copiarlos', async () => {
    const caseData = makeCase();
    const base = mapCaseToPlaceholders(caseData);

    const p = await prepareTemplate(OFICIO, base, undefined, SIN_VARIANTE);

    expect(p.placeholders).toBe(base);
  });

  it('devuelve también la plantilla SIN rellenar, que la validación manual necesita', async () => {
    const caseData = makeCase(DOS_JUZGADOS);
    const [v1] = templateVariants(OFICIO, caseData);

    const p = await prepareTemplate(
      OFICIO,
      mapCaseToPlaceholders(caseData),
      undefined,
      v1,
    );

    expect(p.htmlContent).toContain('{{NOMBRE_JUZGADO}}');
    expect(p.html).not.toContain('{{NOMBRE_JUZGADO}}');
  });

  it('mide la cobertura sobre los placeholders ya pisados por el overlay', async () => {
    const caseData = makeCase(DOS_JUZGADOS);
    const [v1] = templateVariants(OFICIO, caseData);

    const p = await prepareTemplate(
      OFICIO,
      mapCaseToPlaceholders(caseData),
      undefined,
      v1,
    );

    expect(p.coveragePercentage).toBeGreaterThan(0);
    expect(p.coveragePercentage).toBeLessThanOrEqual(100);
    expect(Array.isArray(p.missing)).toBe(true);
    expect(Array.isArray(p.empty)).toBe(true);
  });

  it('una plantilla que no existe falla con el nombre del archivo', async () => {
    const inexistente = { ...OFICIO, fileName: 'No Existe.html' };

    await expect(
      prepareTemplate(inexistente, {}, undefined, SIN_VARIANTE),
    ).rejects.toThrow(/No se pudo leer la plantilla/);
  });
});

describe('readTemplateFile', () => {
  it('lee la plantilla desde la raíz del proyecto', async () => {
    const html = await readTemplateFile(OFICIO);

    expect(html).toContain('{{NOMBRE_JUZGADO}}');
  });
});

describe('las dos rutas usan el módulo compartido', () => {
  const fs = require('fs');
  const path = require('path');
  const leer = (rel: string) =>
    fs.readFileSync(path.join(process.cwd(), 'src', rel), 'utf8');

  const auto = leer('features/document/generate-documents.ts');
  const manual = leer('features/document/actions.ts');

  it('las dos importan prepareTemplate', () => {
    for (const fuente of [auto, manual]) {
      expect(fuente).toContain("from './prepare-template'");
      expect(fuente).toContain('prepareTemplate(');
    }
  });

  it('ninguna vuelve a armar el overlay por su cuenta', () => {
    for (const fuente of [auto, manual]) {
      expect(fuente).not.toContain('...placeholders, ...variant.overlay');
    }
  });

  it('ninguna llama directo a renderDocumentHtml para generar', () => {
    // `actions.ts` sigue importándolo en otra acción (vista previa de una
    // plantilla suelta); lo que no debe volver es el render de la Fase 1.
    expect(auto).not.toContain('renderDocumentHtml(');
  });
});
