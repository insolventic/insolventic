/**
 * Tamaño de los logos de branding en los DOCX (`src/lib/docx-imagenes.ts`).
 *
 * `html-to-docx` ignora el CSS de las plantillas: sin `width`/`height` en el
 * `style` del `<img>` usa el tamaño natural de la imagen, recortado al ancho
 * útil de la página. Medido antes del cambio en los DOCX de /documents:
 *  - logo del encabezado de Armonía (1477 × 1477 px): 18,59 × 18,59 cm;
 *  - de Constructores de Paz (1536 × 345 px): 18,59 × 4,18 cm;
 *  - logo de la firma (1024 × 1024 px): 18,59 × 18,59 cm.
 *
 * Los topes son los del CSS del PDF: encabezado 100 px de alto y 380 px de
 * ancho (260 px en las remisiones); logo de la firma, 200 px de ancho.
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

import {
  TOPES_POR_CLASE,
  dimensionesDeImagen,
  limitarLogosParaDocx,
  medidaConTope,
} from '@/lib/docx-imagenes';
import { htmlToDocx } from '@/lib/html-to-docx';

const BRANDING = path.join(process.cwd(), 'templates/branding');
const CENTROS = ['armonia', 'constructores-paz'] as const;
const EMU_POR_PX = 9525;

function dataUri(centro: string, asset: string): string {
  const b = fs.readFileSync(path.join(BRANDING, centro, `${asset}.png`));
  return `data:image/png;base64,${b.toString('base64')}`;
}

describe('dimensionesDeImagen', () => {
  it('lee el tamaño de los PNG de branding', () => {
    const leer = (c: string, a: string) =>
      dimensionesDeImagen(fs.readFileSync(path.join(BRANDING, c, `${a}.png`)));
    expect(leer('armonia', 'logo-encabezado')).toEqual({
      ancho: 1477,
      alto: 1477,
    });
    expect(leer('constructores-paz', 'logo-encabezado')).toEqual({
      ancho: 1536,
      alto: 345,
    });
    expect(leer('armonia', 'logo-firma')).toEqual({ ancho: 1024, alto: 1024 });
  });

  it('lee el tamaño de un JPEG (marcador SOF0)', () => {
    const jpeg = Buffer.from([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0 de 4 bytes
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x00,
      0x2a,
      0x01,
      0x40, // SOF0: 42 × 320
      0x03,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    expect(dimensionesDeImagen(jpeg)).toEqual({ ancho: 320, alto: 42 });
  });

  it('devuelve null si no es PNG ni JPEG', () => {
    expect(dimensionesDeImagen(Buffer.from('GIF89a......'))).toBeNull();
  });
});

describe('medidaConTope', () => {
  it('encabezado: Armonía (cuadrado) 100 × 100, Constructores (apaisado) 380 × 85', () => {
    expect(
      medidaConTope({ ancho: 1477, alto: 1477 }, TOPES_POR_CLASE.logo),
    ).toEqual({ ancho: 100, alto: 100 });
    expect(
      medidaConTope({ ancho: 1536, alto: 345 }, TOPES_POR_CLASE.logo),
    ).toEqual({ ancho: 380, alto: 85 });
  });

  it('remisiones al juzgado: el apaisado queda en 260 de ancho', () => {
    expect(
      medidaConTope(
        { ancho: 1536, alto: 345 },
        TOPES_POR_CLASE['logo-principal'],
      ),
    ).toEqual({ ancho: 260, alto: 58 });
  });

  it('logo de la firma: 200 de ancho, con su proporción', () => {
    for (const clase of ['logo-firma', 'logo-secundario', 'logo-small']) {
      expect(
        medidaConTope({ ancho: 1024, alto: 1024 }, TOPES_POR_CLASE[clase]),
      ).toEqual({ ancho: 200, alto: 200 });
    }
  });

  it('nunca agranda una imagen más chica que el tope', () => {
    expect(
      medidaConTope({ ancho: 120, alto: 40 }, TOPES_POR_CLASE.logo),
    ).toEqual({
      ancho: 120,
      alto: 40,
    });
  });
});

describe('limitarLogosParaDocx', () => {
  const firmaOperador = dataUri('armonia', 'firma-operador');

  it('fija el tamaño de los logos y no toca la firma del operador', () => {
    const html = [
      `<div class="logo-section"><img src="${dataUri('armonia', 'logo-encabezado')}" alt="Logo" class="logo"></div>`,
      `<img src="${dataUri('armonia', 'logo-firma')}" alt="Logo" class="logo-firma">`,
      `<img src="${firmaOperador}" alt="Firma" class="firma-img">`,
      `<img src="${firmaOperador}" alt="Firma" class="firma">`,
    ].join('\n');

    const salida = limitarLogosParaDocx(html);

    expect(salida).toContain(
      '<p style="text-align:center"><img src="data:image/png;base64,',
    );
    expect(salida).toMatch(/class="logo" style="width:100px;height:100px">/);
    expect(salida).toMatch(
      /class="logo-firma" style="width:200px;height:200px">/,
    );
    expect(salida).toContain(
      `<img src="${firmaOperador}" alt="Firma" class="firma-img">`,
    );
    expect(salida).toContain(
      `<img src="${firmaOperador}" alt="Firma" class="firma">`,
    );
  });

  it('respeta el resto del style y reemplaza un width/height previo', () => {
    const html = `<img class="logo-institucional" style="border:0; width:900px" src="${dataUri('constructores-paz', 'logo-encabezado')}">`;
    const salida = limitarLogosParaDocx(html);
    expect(salida).toMatch(/style="border:0; width:380px;height:85px"/);
    expect(salida).not.toContain('900px');
  });

  it('atributos en varias líneas, como en Check List y las remisiones', () => {
    const html = `<img \n        src="${dataUri('armonia', 'logo-encabezado')}" \n        alt="Logo"\n        class="logo-principal">`;
    expect(limitarLogosParaDocx(html)).toMatch(
      /style="width:100px;height:100px"/,
    );
  });

  it('sin data URI, deja el tope que manda y la librería completa la proporción', () => {
    expect(
      limitarLogosParaDocx(
        '<img src="/branding/armonia/logo-encabezado.png" class="logo">',
      ),
    ).toContain('style="height:100px"');
    expect(
      limitarLogosParaDocx(
        '<img src="/branding/armonia/logo-firma.png" class="logo-firma">',
      ),
    ).toContain('style="width:200px"');
  });
});

describe('el DOCX generado (html-to-docx real): tamaño final en word/document.xml', () => {
  async function extents(centro: string): Promise<Array<[number, number]>> {
    const html = `<!DOCTYPE html><html><body>
      <div class="logo-section"><img src="${dataUri(centro, 'logo-encabezado')}" alt="Logo" class="logo"></div>
      <p>Texto.</p>
      <div class="firma-section">
        <img src="${dataUri(centro, 'firma-operador')}" alt="Firma" class="firma-img">
        <img src="${dataUri(centro, 'logo-firma')}" alt="Logo" class="logo-firma">
      </div>
    </body></html>`;
    const docx = await htmlToDocx(html);
    const zip = await JSZip.loadAsync(docx);
    const xml = await zip.file('word/document.xml')!.async('string');
    return [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\s*\/>/g)].map(
      ([, cx, cy]) => [
        Math.round(+cx / EMU_POR_PX),
        Math.round(+cy / EMU_POR_PX),
      ],
    );
  }

  it('Armonía: encabezado 100 × 100 px (2,65 cm), firma del operador intacta, logo de la firma 200 × 200 px', async () => {
    expect(await extents('armonia')).toEqual([
      [100, 100],
      [193, 116],
      [200, 200],
    ]);
  });

  it('Constructores de Paz: encabezado 380 × 85 px, firma del operador intacta, logo de la firma 200 × 200 px', async () => {
    expect(await extents('constructores-paz')).toEqual([
      [380, 85],
      [235, 128],
      [200, 200],
    ]);
  });
});

describe('todas las plantillas: cada logo de branding tiene su tope para DOCX', () => {
  // Si una plantilla nueva pone el logo con otra clase, saldría a tamaño
  // natural en el DOCX. Este test obliga a darle un tope (o a usar una clase
  // existente).
  function plantillas(dir: string, acc: string[] = []): string[] {
    for (const e of fs.readdirSync(dir)) {
      const ruta = path.join(dir, e);
      if (fs.statSync(ruta).isDirectory()) plantillas(ruta, acc);
      else if (e.endsWith('.html')) acc.push(ruta);
    }
    return acc;
  }

  it('las imágenes con LOGO_ENCABEZADO_SRC o LOGO_FIRMA_SRC usan una clase con tope', () => {
    const sinTope: string[] = [];
    for (const archivo of plantillas(path.join(process.cwd(), 'templates'))) {
      const html = fs.readFileSync(archivo, 'utf8');
      for (const [img] of html.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\{\{(LOGO_ENCABEZADO_SRC|LOGO_FIRMA_SRC)\}\}/.test(img)) continue;
        const clases =
          /class\s*=\s*"([^"]*)"/i.exec(img)?.[1].split(/\s+/) ?? [];
        if (!clases.some((c) => c in TOPES_POR_CLASE)) {
          sinTope.push(path.relative(process.cwd(), archivo));
        }
      }
    }
    expect(sinTope).toEqual([]);
  });

  it('el centro de Constructores y el de Armonía tienen sus logos', () => {
    for (const c of CENTROS) {
      expect(fs.existsSync(path.join(BRANDING, c, 'logo-encabezado.png'))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(BRANDING, c, 'logo-firma.png'))).toBe(
        true,
      );
    }
  });
});
