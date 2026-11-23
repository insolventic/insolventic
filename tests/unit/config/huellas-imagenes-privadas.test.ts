/**
 * Huellas de las firmas y sellos: detectan una copia versionada aunque tenga
 * otro nombre. El check por nombre de `pr.yml` no vio que
 * `templates/insolvency/img/Logo construpaz.png` era el sello de Constructores
 * de Paz.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  RUTA_HUELLAS,
  buscarCopias,
  formatearHuellas,
  huellaSha256,
  huellasDeCarpeta,
  leerHuellas,
} from '../../../scripts/imagenes-privadas/huellas';

const SELLO = Buffer.from('bytes del sello de prueba');
const FIRMA = Buffer.from('bytes de la firma de prueba');

describe('buscarCopias', () => {
  const huellas = new Map([
    [huellaSha256(SELLO), ['constructores-paz/sello.png']],
    [
      huellaSha256(FIRMA),
      ['armonia/firma-director.jpg', 'constructores-paz/firma-director.jpg'],
    ],
  ]);

  it('encuentra la copia aunque tenga otro nombre y otra extensión', () => {
    const copias = buscarCopias(
      [
        { ruta: 'templates/insolvency/img/Logo construpaz.png', datos: SELLO },
        { ruta: 'docs/img/cualquiera.bin', datos: FIRMA },
        {
          ruta: 'templates/branding/armonia/logo-firma.png',
          datos: Buffer.from('otro logo'),
        },
      ],
      huellas,
    );

    expect(copias).toEqual([
      {
        ruta: 'templates/insolvency/img/Logo construpaz.png',
        etiquetas: ['constructores-paz/sello.png'],
      },
      {
        ruta: 'docs/img/cualquiera.bin',
        etiquetas: [
          'armonia/firma-director.jpg',
          'constructores-paz/firma-director.jpg',
        ],
      },
    ]);
  });

  it('un byte distinto ya no es una copia', () => {
    const casi = Buffer.from(SELLO);
    casi[0] ^= 1;
    expect(buscarCopias([{ ruta: 'x.png', datos: casi }], huellas)).toEqual([]);
  });
});

describe('leerHuellas', () => {
  const h = huellaSha256(SELLO);

  it('ignora comentarios, líneas vacías y fines de línea CRLF', () => {
    const texto = `# comentario\r\n\r\n${h}  constructores-paz/sello.png\r\n`;
    expect(leerHuellas(texto)).toEqual(
      new Map([[h, ['constructores-paz/sello.png']]]),
    );
  });

  it.each([
    ['huella corta', `${h.slice(1)}  a/b.png`],
    ['un solo espacio', `${h} a/b.png`],
    ['sin etiqueta', `${h}  `],
    ['mayúsculas', `${h.toUpperCase()}  a/b.png`],
  ])('rechaza una línea mal formada: %s', (_n, linea) => {
    expect(() => leerHuellas(`# ok\n${linea}\n`)).toThrow(
      'huellas.txt, línea 2',
    );
  });
});

describe('huellasDeCarpeta + formatearHuellas', () => {
  let raiz: string;
  beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'huellas-'));
    fs.mkdirSync(path.join(raiz, 'constructores-paz'));
    fs.mkdirSync(path.join(raiz, 'armonia'));
    fs.writeFileSync(path.join(raiz, 'constructores-paz', 'sello.png'), SELLO);
    fs.writeFileSync(path.join(raiz, 'armonia', 'firma-director.JPG'), FIRMA);
    fs.writeFileSync(path.join(raiz, 'armonia', 'notas.txt'), 'no es imagen');
    fs.writeFileSync(path.join(raiz, 'suelta.png'), 'fuera de un centro');
  });
  afterEach(() => fs.rmSync(raiz, { recursive: true, force: true }));

  it('toma solo las imágenes de cada centro, y el archivo generado se vuelve a leer igual', () => {
    const huellas = huellasDeCarpeta(raiz);

    expect(huellas.map((x) => x.etiqueta)).toEqual([
      'armonia/firma-director.JPG',
      'constructores-paz/sello.png',
    ]);
    expect(leerHuellas(formatearHuellas(huellas))).toEqual(
      new Map([
        [huellaSha256(FIRMA), ['armonia/firma-director.JPG']],
        [huellaSha256(SELLO), ['constructores-paz/sello.png']],
      ]),
    );
  });
});

describe('huellas.txt versionado', () => {
  it('se lee sin errores y cubre las cinco imágenes de los dos centros', () => {
    // Si se vacía o se trunca, `revisar` dejaría de proteger algo sin avisar.
    const etiquetas = [
      ...leerHuellas(fs.readFileSync(RUTA_HUELLAS, 'utf8')).values(),
    ].flat();
    expect(etiquetas.map((e) => e.replace(/\.[^.]+$/, '')).sort()).toEqual([
      'armonia/firma-director',
      'armonia/firma-operador',
      'constructores-paz/firma-director',
      'constructores-paz/firma-operador',
      'constructores-paz/sello',
    ]);
  });
});
