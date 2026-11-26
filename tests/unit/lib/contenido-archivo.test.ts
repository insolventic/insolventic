/**
 * Verificación del contenido real de un archivo subido: tipo por firma de
 * bytes, coincidencia con el tipo declarado y con la extensión.
 */
import {
  detectarTipoArchivo,
  motivoContenidoInvalido,
} from '@/lib/contenido-archivo';

const bytes = (...partes: Array<string | number[]>) =>
  new Uint8Array(
    partes.flatMap((p) =>
      typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p,
    ),
  );

const PDF = bytes('%PDF-1.7\n%âãÏÓ\n1 0 obj');
const PNG = bytes([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const EXE = bytes('MZ\x90\x00\x03\x00\x00\x00');
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04]);

describe('detectarTipoArchivo', () => {
  it.each([
    ['PDF', PDF, 'application/pdf'],
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['ejecutable', EXE, null],
    ['zip/docx', ZIP, null],
    ['vacío', new Uint8Array(0), null],
  ])('%s', (_, datos, esperado) => {
    expect(detectarTipoArchivo(datos)).toBe(esperado);
  });

  it('acepta un PDF con bytes antes de la cabecera (dentro del primer KB)', () => {
    expect(detectarTipoArchivo(bytes(' \r\n', '%PDF-1.4'))).toBe(
      'application/pdf',
    );
    const lejos = new Uint8Array(2048);
    lejos.set(bytes('%PDF-1.4'), 1500);
    expect(detectarTipoArchivo(lejos)).toBeNull();
  });

  it('"%PDF" sin el guion de versión no es un PDF', () => {
    expect(detectarTipoArchivo(bytes('%PDF'))).toBeNull();
  });
});

describe('motivoContenidoInvalido', () => {
  it.each([
    ['poder.pdf', 'application/pdf', PDF],
    ['captura.png', 'image/png', PNG],
    ['captura.jpg', 'image/jpeg', JPEG],
    ['captura.jpeg', 'image/jpeg', JPEG],
    ['CAPTURA.JPG', 'image/jpg', JPEG],
  ])('acepta %s', (nombre, tipo, datos) => {
    expect(motivoContenidoInvalido(datos, tipo, nombre)).toBeNull();
  });

  it('rechaza un ejecutable renombrado a .pdf', () => {
    expect(
      motivoContenidoInvalido(EXE, 'application/pdf', 'poder.pdf'),
    ).toMatch(/no es un PDF, JPG o PNG válido/);
  });

  it('rechaza un JPEG declarado como PNG', () => {
    expect(motivoContenidoInvalido(JPEG, 'image/png', 'foto.png')).toMatch(
      /no corresponde al tipo de archivo declarado/,
    );
  });

  it('rechaza un PDF con extensión de imagen', () => {
    expect(
      motivoContenidoInvalido(PDF, 'application/pdf', 'poder.png'),
    ).toMatch(/extensión no corresponde/);
  });

  it('rechaza un archivo vacío', () => {
    expect(
      motivoContenidoInvalido(new Uint8Array(0), 'application/pdf', 'x.pdf'),
    ).toMatch(/vacío/);
  });

  it('sin tipo declarado decide por contenido y extensión', () => {
    expect(motivoContenidoInvalido(PDF, '', 'poder.pdf')).toBeNull();
  });
});
