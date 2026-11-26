/**
 * Actions de la aceptación de términos (N-G-07), con Prisma mockeado.
 *
 * Lo que tiene que valer:
 *  - sin aceptación previa, con una versión vieja o con el mismo número de
 *    versión y otro hash, el documento queda pendiente; con la vigente, no;
 *  - si la consulta falla, la action lo dice (`success: false`) y el cliente
 *    falla abierto;
 *  - aceptar registra la versión y el hash vigentes del lado del servidor, con
 *    el usuario y el centro de la sesión, y nunca una versión que el cliente ya
 *    no tiene;
 *  - la vista del centro exige `Ver usuarios` y solo lee el propio centro.
 *
 * Lo que el mock no puede probar (la restricción única, que la fila llega a
 * Postgres) está en `tests/db/aceptacion-terminos.db.test.ts`.
 */

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

import mockPrisma, { resetAllMocks } from '../../__mocks__/prisma';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: require('../../__mocks__/prisma').default,
}));

const mockAuthenticateUser = jest.fn();
jest.mock('@/features/auth/actions', () => ({
  authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

import { P } from '@/lib/permissions';
import {
  aceptarDocumentosLegales,
  getAceptacionesPendientes,
  getEstadoAceptacionesDelCentro,
  getMisAceptaciones,
} from '@/features/legal/actions';
import { PRIVACIDAD, TERMINOS } from '@/features/legal/documentos';

const TENANT_ID = 'tenant-armonia';
const USUARIO = {
  id: 'user-1',
  name: 'Liliana Patricia Arango Mejía',
  email: 'liliana@centroejemplo.test',
  roleName: 'Operadora',
  professionalCard: '155820',
  permissions: [P.VER_CASOS],
};

function sesion(permissions: string[] = USUARIO.permissions) {
  mockAuthenticateUser.mockResolvedValue({
    user: { ...USUARIO, permissions },
    tenantId: TENANT_ID,
    tenantSlug: 'armonia',
  });
}

const aceptada = (
  doc: typeof TERMINOS,
  over: Partial<{ version: string; sha256: string; aceptadoEn: Date }> = {},
) => ({
  documento: doc.documento,
  version: doc.version,
  sha256: doc.sha256,
  ...over,
});

const findMany = mockPrisma.aceptacionDocumentoLegal.findMany as jest.Mock;
const createMany = mockPrisma.aceptacionDocumentoLegal.createMany as jest.Mock;

beforeEach(() => {
  resetAllMocks();
  mockAuthenticateUser.mockReset();
  sesion();
});

describe('getAceptacionesPendientes', () => {
  it('sin aceptación previa, pide los dos documentos', async () => {
    findMany.mockResolvedValue([]);

    const r = await getAceptacionesPendientes();

    expect(r).toEqual({ success: true, data: [TERMINOS, PRIVACIDAD] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          tenantId: TENANT_ID,
        }),
      }),
    );
  });

  it('con la versión vieja de los términos, los vuelve a pedir', async () => {
    findMany.mockResolvedValue([
      aceptada(TERMINOS, { version: '2026-01-01', sha256: 'viejo' }),
      aceptada(PRIVACIDAD),
    ]);

    const r = await getAceptacionesPendientes();

    expect(r).toEqual({ success: true, data: [TERMINOS] });
  });

  it('con la misma versión y otro hash, también queda pendiente', async () => {
    findMany.mockResolvedValue([
      aceptada(TERMINOS),
      aceptada(PRIVACIDAD, { sha256: 'texto-cambiado-sin-subir-version' }),
    ]);

    const r = await getAceptacionesPendientes();

    expect(r).toEqual({ success: true, data: [PRIVACIDAD] });
  });

  it('con las versiones vigentes, no pide nada', async () => {
    findMany.mockResolvedValue([aceptada(TERMINOS), aceptada(PRIVACIDAD)]);

    expect(await getAceptacionesPendientes()).toEqual({
      success: true,
      data: [],
    });
  });

  it('si la base falla, devuelve success:false (el cliente no bloquea)', async () => {
    findMany.mockRejectedValue(new Error('connection refused'));

    const r = await getAceptacionesPendientes();

    expect(r.success).toBe(false);
  });

  it('sin sesión, devuelve success:false sin consultar', async () => {
    mockAuthenticateUser.mockRejectedValue(new Error('No hay token de acceso'));

    const r = await getAceptacionesPendientes();

    expect(r.success).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('aceptarDocumentosLegales', () => {
  it('registra la versión y el hash vigentes con el usuario y el centro de la sesión', async () => {
    findMany.mockResolvedValue([aceptada(TERMINOS), aceptada(PRIVACIDAD)]);

    const r = await aceptarDocumentosLegales({
      aceptados: [
        { documento: 'terminos', version: TERMINOS.version },
        { documento: 'privacidad', version: PRIVACIDAD.version },
      ],
    });

    expect(r).toEqual({ success: true, data: [] });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: 'user-1',
          userName: USUARIO.name,
          userEmail: USUARIO.email,
          documento: 'terminos',
          version: TERMINOS.version,
          sha256: TERMINOS.sha256,
        }),
        expect.objectContaining({
          documento: 'privacidad',
          version: PRIVACIDAD.version,
          sha256: PRIVACIDAD.sha256,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('no guarda IP ni user-agent', async () => {
    await aceptarDocumentosLegales({
      aceptados: [{ documento: 'terminos', version: TERMINOS.version }],
    });

    const fila = createMany.mock.calls[0][0].data[0];
    expect(Object.keys(fila).sort()).toEqual(
      [
        'documento',
        'requestId',
        'sha256',
        'tenantId',
        'userEmail',
        'userId',
        'userName',
        'version',
      ].sort(),
    );
  });

  it('el hash lo pone el servidor, no el cliente', async () => {
    await aceptarDocumentosLegales({
      aceptados: [
        { documento: 'terminos', version: TERMINOS.version, sha256: 'otro' },
      ],
    });

    expect(createMany.mock.calls[0][0].data[0].sha256).toBe(TERMINOS.sha256);
  });

  it('si el cliente aceptó una versión que ya no es la vigente, no registra nada', async () => {
    const r = await aceptarDocumentosLegales({
      aceptados: [{ documento: 'terminos', version: '2026-01-01' }],
    });

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/cambió mientras lo leía/);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('devuelve lo que sigue pendiente', async () => {
    findMany.mockResolvedValue([aceptada(TERMINOS)]);

    const r = await aceptarDocumentosLegales({
      aceptados: [{ documento: 'terminos', version: TERMINOS.version }],
    });

    expect(r).toEqual({ success: true, data: [PRIVACIDAD] });
  });

  it.each([
    [{}],
    [{ aceptados: [] }],
    [{ aceptados: [{ documento: 'contrato', version: 'x' }] }],
  ])('rechaza la entrada inválida %j', async (input) => {
    const r = await aceptarDocumentosLegales(input);

    expect(r.success).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('sin sesión no registra nada', async () => {
    mockAuthenticateUser.mockRejectedValue(new Error('Token inválido'));

    const r = await aceptarDocumentosLegales({
      aceptados: [{ documento: 'terminos', version: TERMINOS.version }],
    });

    expect(r.success).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('si el insert falla, lo dice', async () => {
    createMany.mockRejectedValue(new Error('timeout'));

    const r = await aceptarDocumentosLegales({
      aceptados: [{ documento: 'terminos', version: TERMINOS.version }],
    });

    expect(r).toEqual({
      success: false,
      error: 'No se pudo registrar la aceptación. Intente de nuevo.',
    });
  });
});

describe('getMisAceptaciones', () => {
  it('lee solo las del usuario en su centro y marca cuál es la vigente', async () => {
    const ayer = new Date('2026-11-25T15:00:00Z');
    findMany.mockResolvedValue([
      { id: 'a2', ...aceptada(TERMINOS), aceptadoEn: ayer },
      {
        id: 'a1',
        ...aceptada(TERMINOS, { version: '2026-01-01', sha256: 'viejo' }),
        aceptadoEn: new Date('2026-02-01'),
      },
    ]);

    const r = await getMisAceptaciones();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', tenantId: TENANT_ID },
      }),
    );
    expect(r).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: 'a2',
          vigente: true,
          titulo: TERMINOS.titulo,
        }),
        expect.objectContaining({
          id: 'a1',
          vigente: false,
          version: '2026-01-01',
        }),
      ],
    });
  });
});

describe('getEstadoAceptacionesDelCentro', () => {
  it('sin "Ver usuarios" no consulta nada', async () => {
    const r = await getEstadoAceptacionesDelCentro();

    expect(r.success).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('con el permiso, lee solo su centro y resume por usuario', async () => {
    sesion([P.VER_USUARIOS]);
    const hoy = new Date('2026-11-26T12:00:00Z');
    findMany.mockResolvedValue([
      { userId: 'u-al-dia', ...aceptada(TERMINOS), aceptadoEn: hoy },
      { userId: 'u-al-dia', ...aceptada(PRIVACIDAD), aceptadoEn: hoy },
      {
        userId: 'u-viejo',
        ...aceptada(TERMINOS, { version: '2026-01-01', sha256: 'viejo' }),
        aceptadoEn: new Date('2026-02-01'),
      },
    ]);

    const r = await getEstadoAceptacionesDelCentro();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
    if (!r.success) throw new Error(r.error);
    expect(r.data['u-al-dia'].alDia).toBe(true);
    expect(r.data['u-viejo']).toEqual({
      alDia: false,
      terminos: {
        estado: 'version-anterior',
        version: '2026-01-01',
        aceptadoEn: new Date('2026-02-01'),
      },
      privacidad: { estado: 'pendiente', version: null, aceptadoEn: null },
    });
    expect(r.data['u-sin-filas']).toBeUndefined();
  });
});

describe('el registro no se edita ni se borra desde la app', () => {
  it('el módulo de actions no exporta nada que actualice o borre', async () => {
    const mod = await import('@/features/legal/actions');
    expect(Object.keys(mod).sort()).toEqual(
      [
        'aceptarDocumentosLegales',
        'getAceptacionesPendientes',
        'getEstadoAceptacionesDelCentro',
        'getMisAceptaciones',
      ].sort(),
    );
  });
});
