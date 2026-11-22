/**
 * Firmas desde la base (`src/lib/imagenes-privadas.ts`): formato, error de
 * dominio, evento de observabilidad y aislamiento entre centros.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
import { logger } from '@/lib/logger';
import { inlineAssets } from '@/lib/html-to-pdf';
import {
  aplicarImagenesPrivadas,
  detectarMimeImagen,
  ImagenPrivadaFaltanteError,
  imagenPrivadaRef,
  motivoImagenInvalida,
  resolverImagenesPrivadas,
  TAMANO_MAXIMO_IMAGEN_PRIVADA,
  tiposRequeridos,
} from '@/lib/imagenes-privadas';
import {
  dataUriDePrueba,
  findManyDeImagenes,
  firmasDelCentro,
  pngDePrueba,
} from '../../helpers/imagenes-privadas';

const ARMONIA = 'tenant-armonia';
const CONSTRUCTORES = 'tenant-constructores';

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  mockPrisma.imagenPrivada.findMany.mockImplementation(
    findManyDeImagenes([
      ...firmasDelCentro(ARMONIA),
      ...firmasDelCentro(CONSTRUCTORES),
    ]),
  );
});

describe('formato', () => {
  it('reconoce PNG y JPEG por el contenido, no por la extensión', () => {
    expect(detectarMimeImagen(pngDePrueba('x'))).toBe('image/png');
    expect(detectarMimeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(detectarMimeImagen(Buffer.from('<svg></svg>'))).toBeNull();
    expect(detectarMimeImagen(Buffer.from('GIF89a'))).toBeNull();
  });

  it('rechaza vacías, demasiado grandes, de otro formato o mal registradas', () => {
    const png = pngDePrueba('firma');
    expect(motivoImagenInvalida(png, 'image/png')).toBeNull();
    expect(motivoImagenInvalida(new Uint8Array(), 'image/png')).toMatch(
      /vacía/,
    );
    expect(motivoImagenInvalida(Buffer.from('%PDF-1.7'), 'image/png')).toMatch(
      /ni JPEG/,
    );
    expect(motivoImagenInvalida(png, 'image/jpeg')).toMatch(/registrada como/);

    const grande = new Uint8Array(TAMANO_MAXIMO_IMAGEN_PRIVADA + 1);
    grande.set(png);
    expect(motivoImagenInvalida(grande, 'image/png')).toMatch(/máximo/);
  });
});

describe('resolverImagenesPrivadas', () => {
  it('devuelve todas las firmas del centro como data URI, con una sola consulta', async () => {
    const imagenes = await resolverImagenesPrivadas(ARMONIA);

    expect(imagenes.get('firma-operador')).toBe(
      dataUriDePrueba(`${ARMONIA}/firma-operador`),
    );
    expect(imagenes.get('firma-director')).toBe(
      dataUriDePrueba(`${ARMONIA}/firma-director`),
    );
    expect(mockPrisma.imagenPrivada.findMany).toHaveBeenCalledTimes(1);
  });

  it('un centro nunca obtiene la firma de otro, aunque el otro tenga las suyas', async () => {
    const armonia = await resolverImagenesPrivadas(ARMONIA);
    const constructores = await resolverImagenesPrivadas(CONSTRUCTORES);

    for (const tipo of ['firma-operador', 'firma-director'] as const) {
      expect(armonia.get(tipo)).toBe(dataUriDePrueba(`${ARMONIA}/${tipo}`));
      expect(constructores.get(tipo)).toBe(
        dataUriDePrueba(`${CONSTRUCTORES}/${tipo}`),
      );
    }
    expect(mockPrisma.imagenPrivada.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: ARMONIA }),
      }),
    );
  });

  it('si el centro no tiene sus firmas, no toma las de otro: falla', async () => {
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(firmasDelCentro(CONSTRUCTORES)),
    );

    await expect(resolverImagenesPrivadas(ARMONIA)).rejects.toBeInstanceOf(
      ImagenPrivadaFaltanteError,
    );
  });

  it('si falta una, lanza el error de dominio con un mensaje para el usuario', async () => {
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(
        firmasDelCentro(ARMONIA).filter((f) => f.tipo !== 'firma-operador'),
      ),
    );
    mockPrisma.tenant.findUnique.mockResolvedValue({
      name: 'Armonía Concertada',
      slug: 'armonia',
    });

    const error = await resolverImagenesPrivadas(ARMONIA).catch((e) => e);

    expect(error).toBeInstanceOf(ImagenPrivadaFaltanteError);
    expect(error.message).toBe(
      'Falta la firma del operador para Armonía Concertada. Contacta al administrador.',
    );
    expect(error.centro).toBe('Armonía Concertada');
    expect(error.tipo).toBe('firma-operador');
  });

  it('deja un evento con el centro y la clave, sin la imagen ni datos del expediente', async () => {
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(
        firmasDelCentro(ARMONIA).filter((f) => f.tipo !== 'firma-director'),
      ),
    );
    mockPrisma.tenant.findUnique.mockResolvedValue({
      name: 'Armonía Concertada',
      slug: 'armonia',
    });

    await resolverImagenesPrivadas(ARMONIA).catch(() => undefined);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, , contexto] = (logger.error as jest.Mock).mock.calls[0];
    expect(contexto).toEqual({
      action: 'documentos.imagen-privada',
      centro: 'armonia',
      clave: 'firma-director',
      motivo: 'no está cargada',
    });
    expect(JSON.stringify(contexto)).not.toMatch(/base64|data:/);
  });

  it('una fila con un contenido que no es imagen cuenta como faltante', async () => {
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes([
        ...firmasDelCentro(ARMONIA).filter((f) => f.tipo !== 'firma-operador'),
        {
          tenantId: ARMONIA,
          tipo: 'firma-operador',
          mimeType: 'image/png',
          datos: Buffer.from('<script>alert(1)</script>'),
        },
      ]),
    );

    await expect(resolverImagenesPrivadas(ARMONIA)).rejects.toBeInstanceOf(
      ImagenPrivadaFaltanteError,
    );
  });

  it('sin centro no consulta nada', async () => {
    await expect(resolverImagenesPrivadas('')).rejects.toThrow(/sin el centro/);
    expect(mockPrisma.imagenPrivada.findMany).not.toHaveBeenCalled();
  });
});

describe('aplicarImagenesPrivadas', () => {
  it('cambia solo los refs de firma y deja el resto igual', async () => {
    const imagenes = await resolverImagenesPrivadas(ARMONIA);
    const resultado = aplicarImagenesPrivadas(
      {
        FIRMA_OPERADOR_SRC: imagenPrivadaRef('firma-operador'),
        FIRMA_DIRECTOR_SRC: imagenPrivadaRef('firma-director'),
        LOGO_FIRMA_SRC: '/branding/armonia/logo-firma.png',
        NOMBRE: 'imagen privada',
      },
      imagenes,
    );

    expect(resultado).toEqual({
      FIRMA_OPERADOR_SRC: dataUriDePrueba(`${ARMONIA}/firma-operador`),
      FIRMA_DIRECTOR_SRC: dataUriDePrueba(`${ARMONIA}/firma-director`),
      LOGO_FIRMA_SRC: '/branding/armonia/logo-firma.png',
      NOMBRE: 'imagen privada',
    });
  });

  it('un ref de un tipo desconocido corta, no se deja pasar', () => {
    expect(() =>
      aplicarImagenesPrivadas({ X: 'imagen-privada:sello-falso' }, new Map()),
    ).toThrow(/no se resolvió/);
  });

  it('un ref que el centro no resolvió corta: el sello no se toma de otro lado', async () => {
    const sinSello = await resolverImagenesPrivadas(ARMONIA);
    expect(() =>
      aplicarImagenesPrivadas(
        { LOGO_FIRMA_SRC: imagenPrivadaRef('sello') },
        sinSello,
      ),
    ).toThrow(/no se resolvió/);
  });
});

describe('sello', () => {
  it('solo Constructores de Paz lo exige', () => {
    expect(tiposRequeridos('constructores-paz')).toEqual([
      'firma-operador',
      'firma-director',
      'sello',
    ]);
    expect(tiposRequeridos('armonia')).toEqual([
      'firma-operador',
      'firma-director',
    ]);
    expect(tiposRequeridos(undefined)).toEqual([
      'firma-operador',
      'firma-director',
    ]);
  });

  it('si el centro lo exige y no está, falla con su propio mensaje', async () => {
    mockPrisma.imagenPrivada.findMany.mockImplementation(
      findManyDeImagenes(
        firmasDelCentro(CONSTRUCTORES).filter((f) => f.tipo !== 'sello'),
      ),
    );
    mockPrisma.tenant.findUnique.mockResolvedValue({
      name: 'Constructores de Paz',
      slug: 'constructores-paz',
    });

    await expect(
      resolverImagenesPrivadas(
        CONSTRUCTORES,
        tiposRequeridos('constructores-paz'),
      ),
    ).rejects.toThrow(
      'Falta el sello para Constructores de Paz. Contacta al administrador.',
    );
  });

  it('si el centro lo exige y está, sale como data URI de ese centro', async () => {
    const imagenes = await resolverImagenesPrivadas(
      CONSTRUCTORES,
      tiposRequeridos('constructores-paz'),
    );
    expect(imagenes.get('sello')).toBe(
      dataUriDePrueba(`${CONSTRUCTORES}/sello`),
    );
  });
});

describe('inlineAssets', () => {
  it('una firma sin resolver no llega a la conversión con la imagen rota', async () => {
    const html = `<img src="${imagenPrivadaRef('firma-operador')}" class="firma">`;
    await expect(inlineAssets(html, '/tmp', '/tmp')).rejects.toThrow(
      /Firma sin resolver/,
    );
  });

  it('una firma ya resuelta pasa tal cual', async () => {
    const dataUri = dataUriDePrueba('firma');
    const html = `<img src="${dataUri}" class="firma">`;
    await expect(inlineAssets(html, '/tmp', '/tmp')).resolves.toBe(html);
  });
});
