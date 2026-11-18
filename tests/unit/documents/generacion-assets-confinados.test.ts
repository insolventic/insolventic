/**
 * N-A2-01: HTML de usuario en el oficio + lectura de archivos sin confinar.
 *
 * La cadena que cierra este test: `court`, `plaintiff` y `processTypeOther`
 * entraban SIN escapar al HTML del oficio «Suspensión a juzgados» por el
 * overlay de variantes, y `inlineAssets` resolvía cualquier `<img src>` contra
 * el disco y lo incrustaba en base64. Un usuario con permiso de editar y
 * generar podía sacar un archivo del servidor dentro del PDF.
 *
 * Las dos defensas se prueban por separado, porque cada una tiene que
 * aguantar sola:
 *   1. el overlay sale escapado (el HTML del usuario nunca es HTML);
 *   2. `inlineAssets` no lee nada fuera de `templates/`, aunque le llegue una
 *      etiqueta real.
 *
 * Los archivos «secretos» son señuelos creados en un directorio temporal del
 * test: nunca se toca un archivo real del sistema.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { prepareTemplate } from '@/features/document/prepare-template';
import { templateVariants } from '@/features/document/template-variants';
import {
  ALL_TEMPLATES,
  getTemplateAssetsBaseDir,
  getTemplatePath,
} from '@/features/document/templates-config';
import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import { inlineAssets } from '@/lib/html-to-pdf';
import { logger } from '@/lib/logger';

const OFICIO = ALL_TEMPLATES.find((t) => t.id === 'suspension-juzgados')!;

const makeCase = (legalProcesses: Record<string, unknown>[]) =>
  ({
    type: 'INSOLVENCY',
    tenantId: 'constructores-paz',
    caseNumber: 'INS-2026-091',
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

const estaDentro = (raiz: string, destino: string): boolean => {
  const rel = path.relative(raiz, destino);
  return rel !== '' && !path.isAbsolute(rel) && rel.split(path.sep)[0] !== '..';
};

/** Cargas que un usuario podría escribir en los campos del proceso. */
const CARGAS = [
  '<img src="/etc/passwd">',
  '<img src="../../.env">',
  '<img src="file:///etc/hostname">',
  '<script>alert(1)</script>',
  '"><svg onload=alert(1)>',
];

/** Lo que no puede aparecer en el HTML final si el escapado funciona. */
const HTML_ACTIVO = [
  /<img\s+src="\/etc/i,
  /<img\s+src="\.\./i,
  /<img\s+src="file:/i,
  /<script>alert/i,
  /<svg\s+onload/i,
];

describe('1. el overlay del oficio sale escapado', () => {
  // Una variante por carga: cada una va como nombre de juzgado, y como
  // demandante y tipo "Otro" del mismo proceso.
  const procesos = CARGAS.map((carga, i) => ({
    court: `${carga} ${i}`,
    plaintiff: carga,
    processType: 'OTROS',
    processTypeOther: carga,
  }));

  it('ningún valor del overlay conserva un < o un "', () => {
    const variantes = templateVariants(OFICIO, makeCase(procesos));
    expect(variantes).toHaveLength(CARGAS.length);

    for (const v of variantes) {
      for (const valor of Object.values(v.overlay)) {
        expect(valor).not.toMatch(/[<>"]/);
      }
    }
    expect(variantes[0].overlay.NOMBRE_JUZGADO).toBe(
      '&lt;img src=&quot;/etc/passwd&quot;&gt; 0',
    );
  });

  it('el label no se escapa: no va al HTML, es el nombre de la fila', () => {
    const [v] = templateVariants(OFICIO, makeCase(procesos));
    expect(v.label).toBe('<img src="/etc/passwd"> 0');
  });

  it.each(CARGAS.map((c, i) => [c, i] as const))(
    'carga %s: el HTML renderizado la muestra como texto, no como etiqueta',
    async (_carga, i) => {
      const caseData = makeCase(procesos);
      const variante = templateVariants(OFICIO, caseData)[i];
      const { html } = await prepareTemplate(
        OFICIO,
        mapCaseToPlaceholders(caseData),
        undefined,
        variante,
      );

      for (const patron of HTML_ACTIVO) expect(html).not.toMatch(patron);
      expect(html).toContain('&lt;');
    },
  );

  it('la cadena completa (render + inlineAssets) solo lee bajo templates/', async () => {
    const caseData = makeCase(procesos);
    const raiz = fs.realpathSync(path.join(process.cwd(), 'templates'));
    const spy = jest.spyOn(fs, 'readFileSync');

    let leidos: string[] = [];
    try {
      for (const variante of templateVariants(OFICIO, caseData)) {
        const { html } = await prepareTemplate(
          OFICIO,
          mapCaseToPlaceholders(caseData),
          undefined,
          variante,
        );
        const salida = await inlineAssets(
          html,
          path.join(process.cwd(), getTemplateAssetsBaseDir(OFICIO)),
          path.dirname(path.join(process.cwd(), getTemplatePath(OFICIO))),
        );

        for (const patron of HTML_ACTIVO) expect(salida).not.toMatch(patron);
        // Regresión: el oficio legítimo sigue llevando su CSS y su logo.
        expect(salida).toContain('<style>');
        expect(salida).toContain('data:image/png;base64,');
      }
      leidos = spy.mock.calls.map(([p]) => String(p));
    } finally {
      spy.mockRestore();
    }

    // Las lecturas propias de jest (`node_modules/...`) no cuentan: lo que se
    // prueba es que el pipeline no lee nada del proyecto fuera de templates/.
    const delProyecto = leidos.filter(
      (p) => !p.split(path.sep).includes('node_modules'),
    );
    expect(delProyecto.length).toBeGreaterThan(0);
    for (const leido of delProyecto) {
      expect({ leido, dentro: estaDentro(raiz, leido) }).toEqual({
        leido,
        dentro: true,
      });
    }
  });
});

describe('2. inlineAssets no lee nada fuera de templates/', () => {
  const SECRETO = 'SENUELO-SECRETO-NO-DEBE-SALIR';
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

  let tmp: string;
  let plantillas: string;
  let insolvencia: string;
  let senuelo: string;
  let enlaceCreado: boolean;
  let cwdSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let readSpy: jest.SpyInstance;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-assets-'));
    plantillas = path.join(tmp, 'templates');
    insolvencia = path.join(plantillas, 'insolvency');
    fs.mkdirSync(path.join(insolvencia, 'img'), { recursive: true });
    fs.mkdirSync(path.join(insolvencia, 'CSS'), { recursive: true });
    fs.mkdirSync(path.join(insolvencia, 'Sub'), { recursive: true });
    fs.mkdirSync(path.join(plantillas, 'branding', 'centro'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmp, 'fuera'), { recursive: true });

    fs.writeFileSync(path.join(insolvencia, 'img', 'ok.png'), PNG);
    fs.writeFileSync(
      path.join(plantillas, 'branding', 'centro', 'logo.png'),
      PNG,
    );
    fs.writeFileSync(
      path.join(insolvencia, 'CSS', 'ok.css'),
      'p { color: red; }',
    );
    fs.writeFileSync(
      path.join(insolvencia, 'CSS', 'base.css'),
      'h1 { margin: 0; }',
    );
    fs.writeFileSync(
      path.join(insolvencia, 'CSS', 'con-import.css'),
      '@import url("base.css");\n@import url("../../../secreto.env");\nbody { x: 1; }',
    );

    senuelo = path.join(tmp, 'secreto.env');
    fs.writeFileSync(senuelo, SECRETO);
    fs.writeFileSync(path.join(tmp, 'fuera', 'img.png'), SECRETO);

    // `junction` no pide privilegios en Windows; en POSIX el tipo se ignora y
    // queda un symlink de directorio común.
    try {
      fs.symlinkSync(
        path.join(tmp, 'fuera'),
        path.join(insolvencia, 'enlace'),
        'junction',
      );
      enlaceCreado = true;
    } catch {
      enlaceCreado = false;
    }
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  beforeEach(() => {
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmp);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    readSpy = jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    errorSpy.mockRestore();
    readSpy.mockRestore();
  });

  const inline = (html: string, docDir = insolvencia) =>
    inlineAssets(html, insolvencia, docDir);

  /**
   * Ningún archivo del directorio temporal se leyó fuera de `tmp/templates`.
   *
   * Se miran solo las lecturas bajo `tmp`, que es donde están los señuelos:
   * mientras el spy está activo jest también lee sus propios módulos
   * (`node_modules/...`), y eso no es lo que se está probando.
   */
  const soloLeyoPlantillas = () => {
    const bases = [tmp, fs.realpathSync(tmp)];
    const raices = [plantillas, fs.realpathSync(plantillas)];
    for (const [p] of readSpy.mock.calls) {
      const leido = String(p);
      if (!bases.some((b) => estaDentro(b, leido))) continue;
      expect({
        leido,
        dentro: raices.some((r) => estaDentro(r, leido)),
      }).toEqual({ leido, dentro: true });
    }
  };

  const noFiltro = (salida: string) => {
    expect(salida).not.toContain(SECRETO);
    expect(salida).not.toContain(Buffer.from(SECRETO).toString('base64'));
  };

  const maliciosos: Array<[string, () => string]> = [
    ['traversal relativo', () => '../../secreto.env'],
    ['traversal desde un subdirectorio', () => '../../../secreto.env'],
    ['traversal root-relative', () => '/../../secreto.env'],
    ['traversal disfrazado de branding', () => '/branding/../../secreto.env'],
    ['file:// absoluto', () => `file:///${senuelo.replace(/\\/g, '/')}`],
    ['ruta absoluta del sistema', () => senuelo],
    ['ruta absoluta con barras normales', () => senuelo.replace(/\\/g, '/')],
    ['http remoto', () => 'http://atacante.example/x.png'],
    ['protocolo relativo', () => '//atacante.example/x.png'],
  ];

  it.each(maliciosos)(
    '<img> con %s: no se lee ni se incrusta',
    async (_n, ref) => {
      const salida = await inline(
        `<p>a</p><img src="${ref()}"><p>b</p>`,
        path.join(insolvencia, 'Sub'),
      );

      noFiltro(salida);
      soloLeyoPlantillas();
      expect(readSpy.mock.calls.map(([p]) => String(p))).not.toContain(senuelo);
    },
  );

  it('un rechazo quita la etiqueta y se registra como error', async () => {
    const salida = await inline(
      '<p>a</p><img src="../../secreto.env" class="x"><p>b</p>',
    );

    expect(salida).toBe('<p>a</p><p>b</p>');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Se rechazó un asset'),
      undefined,
      expect.objectContaining({
        action: 'pdf.inline-assets',
        tipoAsset: 'imagen',
        motivo: 'ruta fuera de templates/',
      }),
    );
  });

  it('un esquema no permitido se rechaza por esquema', async () => {
    await inline('<img src="file:///etc/passwd">');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ motivo: 'esquema no permitido' }),
    );
  });

  it('<link> a un archivo fuera de templates/ no se lee', async () => {
    const salida = await inline(
      '<link rel="stylesheet" href="../../secreto.env"><p>x</p>',
    );

    expect(salida).toBe('<p>x</p>');
    noFiltro(salida);
    soloLeyoPlantillas();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ tipoAsset: 'css' }),
    );
  });

  it('un @import de un CSS legítimo que apunta afuera no se lee', async () => {
    const salida = await inline(
      '<link rel="stylesheet" href="/CSS/con-import.css">',
    );

    expect(salida).toContain('h1 { margin: 0; }'); // el import legítimo sí
    expect(salida).toContain('body { x: 1; }');
    expect(salida).not.toContain('@import');
    noFiltro(salida);
    soloLeyoPlantillas();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ tipoAsset: 'css-import' }),
    );
  });

  it('un symlink dentro de templates/ que apunta afuera se rechaza', async () => {
    if (!enlaceCreado) {
      throw new Error(
        'No se pudo crear el enlace del test en el directorio temporal',
      );
    }
    // Léxicamente la ruta está dentro: solo `realpath` la delata.
    const salida = await inline('<img src="/enlace/img.png">');

    expect(salida).toBe('');
    noFiltro(salida);
    soloLeyoPlantillas();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({
        motivo: 'enlace simbólico fuera de templates/',
      }),
    );
  });

  it('regresión: los assets legítimos se siguen incrustando', async () => {
    const salida = await inline(
      [
        '<link rel="stylesheet" href="/CSS/ok.css">',
        '<link href="./CSS/ok.css" rel="stylesheet">',
        '<img src="/img/ok.png">',
        '<img src="./img/ok.png">',
        '<img src="/branding/centro/logo.png">',
        '<img src="data:image/png;base64,AAAA">',
      ].join('\n'),
    );

    expect(salida).not.toContain('<link');
    expect(salida.match(/<style>/g)).toHaveLength(2);
    expect(salida.match(/data:image\/png;base64,iVBORw0KGgo=/g)).toHaveLength(
      3,
    );
    expect(salida).toContain('data:image/png;base64,AAAA');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('regresión: un ../ legítimo que queda dentro de templates/ se incrusta', async () => {
    // Las plantillas de conciliación usan `../CSS/...` desde su subcarpeta.
    const salida = await inline(
      '<img src="../img/ok.png">',
      path.join(insolvencia, 'Sub'),
    );

    expect(salida).toContain('data:image/png;base64,');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
