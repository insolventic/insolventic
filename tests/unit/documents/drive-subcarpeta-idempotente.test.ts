/**
 * `createFolderHierarchy` con peticiones simultáneas: terminan usando la MISMA
 * carpeta, la más antigua por `createdTime`.
 *
 * Antes buscaba por nombre sin orden y tomaba la primera que devolvía Drive.
 * Si dos peticiones creaban a la vez la misma subcarpeta (un Regenerar y una
 * generación de `/documents`), cada una podía quedarse con la suya, y las
 * siguientes, con cualquiera de las dos: los documentos del caso quedaban
 * repartidos.
 *
 * Drive es un fake en memoria del cliente de `googleapis`: sin `orderBy`
 * devuelve las carpetas en el orden inverso al de creación, para que un
 * código que no pida el orden no pase por suerte.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

interface Carpeta {
  id: string;
  name: string;
  parent: string;
  createdTime: string;
}
let carpetas: Carpeta[] = [];
let reloj = 0;
/** Promesas de búsqueda pendientes: permiten que dos peticiones busquen antes de que ninguna cree. */
let barrera: Promise<void> | null = null;

const mockList = jest.fn(
  async ({ q, orderBy }: { q: string; orderBy?: string }) => {
    if (barrera) await barrera;
    const padre = /^'([^']+)' in parents/.exec(q)![1];
    const nombre = /name='([^']+)'/.exec(q)![1];
    const halladas = carpetas.filter(
      (c) => c.parent === padre && c.name === nombre,
    );
    const ordenadas =
      orderBy === 'createdTime'
        ? [...halladas].sort((a, b) =>
            a.createdTime.localeCompare(b.createdTime),
          )
        : [...halladas].reverse();
    return {
      data: {
        files: ordenadas.map(({ id, createdTime }) => ({ id, createdTime })),
      },
    };
  },
);
const mockCreate = jest.fn(
  async ({
    requestBody,
  }: {
    requestBody: { name: string; parents: string[] };
  }) => {
    reloj += 1;
    const id = `carpeta-${reloj}`;
    carpetas.push({
      id,
      name: requestBody.name,
      parent: requestBody.parents[0],
      createdTime: `2026-11-22T10:00:${String(reloj).padStart(2, '0')}Z`,
    });
    return { data: { id } };
  },
);

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials = jest.fn();
      },
    },
    drive: () => ({
      files: {
        list: (a: { q: string; orderBy?: string }) => mockList(a),
        create: (a: { requestBody: { name: string; parents: string[] } }) =>
          mockCreate(a),
      },
    }),
  },
}));

import { logger } from '@/lib/logger';
import { googleDriveService } from '@/lib/google-drive';

beforeEach(() => {
  carpetas = [];
  reloj = 0;
  barrera = null;
  jest.clearAllMocks();
});

describe('createFolderHierarchy: una sola carpeta aunque se pida a la vez', () => {
  it('pide las carpetas ordenadas por createdTime', async () => {
    await googleDriveService.createFolderHierarchy(['01-Generados'], 'caso');
    for (const [args] of mockList.mock.calls) {
      expect(args.orderBy).toBe('createdTime');
    }
  });

  it('si ya hay varias con el mismo nombre, usa siempre la más antigua', async () => {
    carpetas.push(
      {
        id: 'vieja',
        name: '01-Generados',
        parent: 'caso',
        createdTime: '2026-01-01T00:00:00Z',
      },
      {
        id: 'nueva',
        name: '01-Generados',
        parent: 'caso',
        createdTime: '2026-06-01T00:00:00Z',
      },
    );

    const ids = await Promise.all(
      [1, 2, 3].map(() =>
        googleDriveService.createFolderHierarchy(['01-Generados'], 'caso'),
      ),
    );

    expect(ids).toEqual(['vieja', 'vieja', 'vieja']);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('dos peticiones simultáneas que no la encuentran terminan usando la misma; la otra queda vacía y en el log', async () => {
    // Las dos buscan antes de que ninguna cree.
    let soltar!: () => void;
    barrera = new Promise((r) => (soltar = r));
    const a = googleDriveService.createFolderHierarchy(
      ['01-Generados'],
      'caso',
    );
    const b = googleDriveService.createFolderHierarchy(
      ['01-Generados'],
      'caso',
    );
    await new Promise((r) => setImmediate(r));
    barrera = null;
    soltar();

    const [idA, idB] = await Promise.all([a, b]);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(carpetas).toHaveLength(2);
    expect(idA).toBe('carpeta-1');
    expect(idB).toBe('carpeta-1');
    expect(logger.warn).toHaveBeenCalledWith(
      'Carpeta duplicada por concurrencia; se usa la más antigua',
      expect.objectContaining({
        carpetaUsada: 'carpeta-1',
        carpetaVacia: 'carpeta-2',
      }),
    );
    // La siguiente petición también va a la más antigua.
    await expect(
      googleDriveService.createFolderHierarchy(['01-Generados'], 'caso'),
    ).resolves.toBe('carpeta-1');
  });

  it('en una ruta de varios niveles, cada nivel cuelga del anterior', async () => {
    const id = await googleDriveService.createFolderHierarchy(
      ['Insolventic', 'Armonia', 'INSOL-000007'],
      'raiz',
    );

    expect(carpetas.map((c) => [c.name, c.parent])).toEqual([
      ['Insolventic', 'raiz'],
      ['Armonia', 'carpeta-1'],
      ['INSOL-000007', 'carpeta-2'],
    ]);
    expect(id).toBe('carpeta-3');
  });
});
