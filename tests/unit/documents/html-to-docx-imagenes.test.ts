/**
 * La ruta DOCX no descarga imágenes desde el servidor.
 *
 * `html-to-docx` resuelve los `<img>` por su cuenta: un `src` que contenga
 * `http(s)://` lo descarga con un `node-fetch` empaquetado en la librería. La
 * ruta DOCX no pasa por Chromium, así que el bloqueo de red de N-A2-02 no la
 * cubre. `soloImagenesIncrustadas` deja pasar solo `data:image/...;base64`.
 *
 * La parte 2 usa la librería REAL contra un servidor HTTP en 127.0.0.1 que
 * levanta el propio test: así se ve la petición que la librería hace sin el
 * filtro y que no hace con él. No sale nada de la máquina.
 */

import http from 'http';
import type { AddressInfo } from 'net';
import path from 'path';

import { readTemplateFile } from '@/features/document/prepare-template';
import {
  ALL_TEMPLATES,
  getTemplateAssetsBaseDir,
  getTemplatePath,
} from '@/features/document/templates-config';
import { brandingRef } from '@/lib/branding-assets';
import { inlineAssets } from '@/lib/html-to-pdf';

import { htmlToDocx, soloImagenesIncrustadas } from '@/lib/html-to-docx';
import { logger } from '@/lib/logger';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DATA_OK = `data:image/png;base64,${PNG_1PX}`;

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('1. soloImagenesIncrustadas', () => {
  const quitadas: Array<[string, string]> = [
    ['http entre comillas', '<img src="http://127.0.0.1/x.png">'],
    ['https entre comillas simples', "<img src='https://ejemplo.test/x.png'>"],
    ['sin comillas', '<img src=http://127.0.0.1/x.png>'],
    ['mayúsculas', '<IMG SRC="http://127.0.0.1/x.png">'],
    ['barra en vez de espacio', '<img/src="http://127.0.0.1/x.png">'],
    [
      '> dentro de otro atributo',
      '<img alt="a>b" src="http://127.0.0.1/x.png">',
    ],
    ['http en medio del valor', '<img src="/x/http://127.0.0.1/x.png">'],
    ['entidades', '<img src="&#104;ttp://127.0.0.1/x.png">'],
    ['src repetido', `<img src="${DATA_OK}" src="http://127.0.0.1/x.png">`],
    [
      'data: con http dentro',
      '<img src="data:image/png;base64,http://127.0.0.1/a.png">',
    ],
    ['data: que no es imagen', '<img src="data:text/html;base64,PGI+">'],
    ['ruta local', '<img src="/etc/passwd">'],
    ['ruta relativa', '<img src="../../.env">'],
    ['file://', '<img src="file:///etc/passwd">'],
    ['etiqueta sin cerrar', '<p>a</p><img src="http://127.0.0.1/x.png"'],
  ];

  it.each(quitadas)('%s: se quita', (_n, tag) => {
    const salida = soloImagenesIncrustadas(`<p>antes</p>${tag}<p>después</p>`);

    expect(salida).not.toMatch(/<img/i);
    expect(salida).toContain('<p>antes</p>');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Se quitaron imágenes'),
      undefined,
      expect.objectContaining({ action: 'docx.imagenes', quitadas: 1 }),
    );
  });

  it('las imágenes incrustadas y el resto del HTML quedan intactos', () => {
    const html = [
      '<p class="x">texto con http://no-es-img.test</p>',
      `<img src="${DATA_OK}" class="logo" alt="Logo">`,
      `<img class="firma" src='data:image/jpeg;base64,/9j/4AAQ'>`,
      '<img alt="sin src">',
    ].join('\n');

    expect(soloImagenesIncrustadas(html)).toBe(html);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('quita solo la mala cuando hay varias', () => {
    const salida = soloImagenesIncrustadas(
      `<img src="${DATA_OK}"><img src=http://127.0.0.1/a.png><img src="${DATA_OK}">`,
    );
    expect(salida).toBe(`<img src="${DATA_OK}"><img src="${DATA_OK}">`);
  });
});

describe('2. con la librería real: ninguna petición sale del servidor', () => {
  let servidor: http.Server;
  let base: string;
  const peticiones: string[] = [];

  beforeAll(async () => {
    servidor = http.createServer((req, res) => {
      peticiones.push(req.url ?? '');
      res.setHeader('content-type', 'image/png');
      res.end(Buffer.from(PNG_1PX, 'base64'));
    });
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => servidor.close(() => r()));
  });

  beforeEach(() => {
    peticiones.length = 0;
  });

  it('control: sin el filtro, la librería SÍ descarga el <img>', async () => {
    // Si este control deja de pedir, la librería cambió y el test de abajo ya
    // no prueba nada: hay que revisar el filtro contra la versión nueva.
    const HTMLtoDOCX = (await import('html-to-docx')).default;
    await HTMLtoDOCX(`<p>a</p><img src="${base}/control.png">`, null, {});
    expect(peticiones).toContain('/control.png');
  });

  it.each([
    ['comillas', (b: string) => `<img src="${b}/a.png">`],
    ['sin comillas', (b: string) => `<img src=${b}/b.png>`],
    ['mayúsculas', (b: string) => `<IMG SRC="${b}/c.png">`],
  ])('htmlToDocx con %s no hace ninguna petición', async (_n, tag) => {
    const buffer = await htmlToDocx(`<p>a</p>${tag(base)}<p>b</p>`);

    expect(buffer.length).toBeGreaterThan(0);
    expect(peticiones).toEqual([]);
  });

  it('regresión: una imagen incrustada sigue entrando al DOCX', async () => {
    const con = await htmlToDocx(`<p>a</p><img src="${DATA_OK}">`);
    const sin = await htmlToDocx('<p>a</p>');

    // Los nombres de los archivos del zip van sin comprimir.
    expect(con.includes('word/media/')).toBe(true);
    expect(sin.includes('word/media/')).toBe(false);
    expect(peticiones).toEqual([]);
  });
});

describe('3. regresión: ninguna plantilla real pierde imágenes en la ruta DOCX', () => {
  // Las plantillas pasan por `inlineAssets` antes del filtro: todo `<img>`
  // legítimo ya llega como `data:image/...;base64`. Si alguno no, el filtro lo
  // quitaría del DOCX y la firma o el logo desaparecerían en silencio.
  const plantillas = ALL_TEMPLATES.map((t) => [t.id, t] as const);

  it.each(plantillas)('%s', async (_id, template) => {
    const crudo = await readTemplateFile(template);
    const html = crudo
      .replace(
        /\{\{LOGO_ENCABEZADO_SRC\}\}/g,
        brandingRef('logo-encabezado', 'constructores-paz'),
      )
      .replace(
        /\{\{LOGO_FIRMA_SRC\}\}/g,
        brandingRef('logo-firma', 'constructores-paz'),
      )
      .replace(
        /\{\{FIRMA_OPERADOR_SRC\}\}/g,
        brandingRef('firma-operador', 'constructores-paz'),
      );

    const incrustado = await inlineAssets(
      html,
      path.join(process.cwd(), getTemplateAssetsBaseDir(template)),
      path.dirname(path.join(process.cwd(), getTemplatePath(template))),
    );
    const filtrado = soloImagenesIncrustadas(incrustado);

    const contar = (s: string) => (s.match(/<img[\s/>]/gi) ?? []).length;
    expect(contar(filtrado)).toBe(contar(crudo));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
