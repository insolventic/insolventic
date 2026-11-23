/**
 * La pestaña Drive de `/documents` lee a partir de la carpeta guardada de cada
 * caso (`Case.driveFolderId`) y muestra solo lo de los casos que el usuario
 * puede ver (`case-access`), dentro de su centro.
 *
 * Antes:
 *  - la sincronización solo recorría `documentos-generados/{centro}`, así que
 *    lo de los casos v1 (`Insolventic/...`) no entraba nunca al índice;
 *  - la lectura asociaba cada archivo a un caso con el patrón
 *    `(CON|INS|ACU)-\d{4}-\d{3}`, que los números actuales (`INSOL-000007`) no
 *    cumplen, y armaba el alcance a mano.
 *
 * La base es un fake en memoria del índice (`DocumentFromDrive`) y de los
 * casos de dos centros, con el mismo número de caso en los dos.
 */
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'raiz-de-drive';

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

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

/** Árbol de Drive de cada carpeta de caso v1, por id. */
const arboles: Record<string, { folders: unknown[]; files: unknown[] }> = {};
const mockListAllRecursively = jest.fn(async (id: string) =>
  id === 'centro-folder-id'
    ? { folders: [], files: [] }
    : (arboles[id] ?? { folders: [], files: [] }),
);
const mockGetFileInfo = jest.fn(async (id: string) => ({
  id,
  createdTime: '2026-11-10T15:00:00.000Z',
  modifiedTime: '2026-11-11T15:00:00.000Z',
}));
/** El listado por niveles: cada raíz devuelve su árbol de `arboles`. */
const listarCompleto = async (raices: string[]) => ({
  arboles: new Map(
    await Promise.all(
      raices.map(async (r) => [r, await mockListAllRecursively(r)] as const),
    ),
  ),
  incompletas: new Set<string>(),
});
const mockListarPorNiveles = jest.fn(listarCompleto);
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    listFoldersAndFiles: jest.fn().mockResolvedValue({
      folders: [{ id: 'docgen', name: 'documentos-generados' }],
      files: [],
    }),
    createFolderHierarchy: jest.fn().mockResolvedValue('centro-folder-id'),
    // La sincronización lee por niveles.
    listarArbolesPorNiveles: (raices: string[]) => mockListarPorNiveles(raices),
    listAllFoldersAndFilesRecursively: (id: string) =>
      mockListAllRecursively(id),
    getFileInfo: (id: string) => mockGetFileInfo(id),
  },
}));

import { P } from '@/lib/permissions';
import {
  getDocumentsFromDrive,
  syncDocumentsWithGoogleDrive,
} from '@/features/document/actions';

type Centro = 'armonia' | 'constructores-paz';

interface Caso {
  id: string;
  tenantId: Centro;
  caseNumber: string;
  operatorId: string;
  debtorId: string;
  driveFolderId: string | null;
}

interface Fila {
  id: string;
  tenantId: string;
  googleDriveId: string;
  fileName: string;
  mimeType: string;
  folderPath: string[];
  parentFolderId: string | null;
  isFolder: boolean;
  size: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let casos: Caso[];
let indice: Fila[];

const archivo = (
  id: string,
  nombre: string,
  padre: string,
  ruta: string[],
) => ({
  id,
  name: nombre,
  mimeType: 'application/pdf',
  path: ruta,
  parentId: padre,
  size: '10',
  createdTime: '2026-11-12T10:00:00.000Z',
  modifiedTime: '2026-11-12T10:00:00.000Z',
});

function sesion(
  centro: Centro,
  permisos: string[],
  usuario = { id: `usuario-${centro}`, email: `u-${centro}@x.test` },
) {
  mockAuthenticateUser.mockResolvedValue({
    user: { ...usuario, name: 'Usuario', permissions: permisos },
    tenantId: centro,
    tenantSlug: centro,
  });
}

beforeEach(() => {
  resetAllMocks();
  jest.clearAllMocks();
  mockListarPorNiveles.mockImplementation(listarCompleto);
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // El mismo número en los dos centros; los dos casos son v1.
  casos = [
    {
      id: 'caso-a',
      tenantId: 'armonia',
      caseNumber: 'INSOL-000007',
      operatorId: 'usuario-armonia',
      debtorId: 'deudor-a',
      driveFolderId: 'v1-armonia',
    },
    {
      id: 'caso-a2',
      tenantId: 'armonia',
      caseNumber: 'INSOL-000008',
      operatorId: 'otro-operador',
      debtorId: 'deudor-a2',
      driveFolderId: 'v1-armonia-2',
    },
    {
      id: 'caso-b',
      tenantId: 'constructores-paz',
      caseNumber: 'INSOL-000007',
      operatorId: 'usuario-constructores-paz',
      debtorId: 'deudor-b',
      driveFolderId: 'v1-constructores',
    },
  ];
  indice = [];
  for (const k of Object.keys(arboles)) delete arboles[k];
  arboles['v1-armonia'] = {
    folders: [
      {
        id: 'generados-a',
        name: '01-Generados',
        path: ['01-Generados'],
        parentId: 'v1-armonia',
        createdTime: '2026-11-12T09:00:00.000Z',
        modifiedTime: '2026-11-12T09:00:00.000Z',
      },
    ],
    files: [archivo('doc-a', 'solicitud.pdf', 'generados-a', ['01-Generados'])],
  };
  arboles['v1-armonia-2'] = {
    folders: [],
    files: [archivo('doc-a2', 'otro.pdf', 'v1-armonia-2', [])],
  };
  arboles['v1-constructores'] = {
    folders: [],
    files: [archivo('doc-b', 'solicitud.pdf', 'v1-constructores', [])],
  };

  mockPrisma.case.findMany.mockImplementation(
    async ({
      where,
    }: {
      where: {
        tenantId: string;
        operatorId?: string;
        debtorId?: string;
        id?: { in: string[] };
        driveFolderId?: { not: null };
      };
    }) =>
      casos.filter(
        (c) =>
          c.tenantId === where.tenantId &&
          (where.operatorId === undefined ||
            c.operatorId === where.operatorId) &&
          (where.debtorId === undefined || c.debtorId === where.debtorId) &&
          (where.id === undefined || where.id.in.includes(c.id)) &&
          (where.driveFolderId === undefined || c.driveFolderId !== null),
      ),
  );
  mockPrisma.debtor.findFirst.mockResolvedValue(null);
  mockPrisma.documentFromDrive.findMany.mockImplementation(
    async ({
      where,
    }: {
      where: { tenantId: string; googleDriveId?: { in: string[] } };
    }) =>
      indice.filter(
        (f) =>
          f.tenantId === where.tenantId &&
          (!where.googleDriveId ||
            where.googleDriveId.in.includes(f.googleDriveId)),
      ),
  );
  mockPrisma.documentFromDrive.createMany.mockImplementation(
    async ({ data }: { data: Omit<Fila, 'id'>[] }) => {
      for (const d of data) indice.push({ ...d, id: `fila-${indice.length}` });
      return { count: data.length };
    },
  );
  mockPrisma.documentFromDrive.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: Partial<Fila> }) => {
      const f = indice.find((x) => x.id === where.id)!;
      Object.assign(f, data);
      return f;
    },
  );
  mockPrisma.$transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as () => unknown)(),
  );
});

async function sincronizarLosDosCentros() {
  sesion('armonia', [P.VER_DOCUMENTOS]);
  expect((await syncDocumentsWithGoogleDrive()).success).toBe(true);
  sesion('constructores-paz', [P.VER_DOCUMENTOS]);
  expect((await syncDocumentsWithGoogleDrive()).success).toBe(true);
}

describe('sincronización: la carpeta de cada caso sale de su driveFolderId', () => {
  it('indexa la carpeta v1 de cada caso con el formato de la pestaña, en el índice de su centro', async () => {
    await sincronizarLosDosCentros();

    expect(mockListAllRecursively).toHaveBeenCalledWith('v1-armonia');
    expect(mockListAllRecursively).toHaveBeenCalledWith('v1-constructores');

    const deArmonia = indice.filter((f) => f.tenantId === 'armonia');
    expect(deArmonia.map((f) => [f.googleDriveId, f.folderPath])).toEqual(
      expect.arrayContaining([
        ['v1-armonia', ['Armonía']],
        ['generados-a', ['Armonía', 'INSOL-000007', '01-Generados']],
        ['doc-a', ['Armonía', 'INSOL-000007', '01-Generados']],
      ]),
    );
    expect(
      deArmonia.find((f) => f.googleDriveId === 'v1-armonia')?.fileName,
    ).toBe('INSOL-000007');
    // Lo de un centro no entra al índice del otro.
    expect(deArmonia.some((f) => f.googleDriveId === 'doc-b')).toBe(false);
    const deConstructores = indice.filter(
      (f) => f.tenantId === 'constructores-paz',
    );
    expect(deConstructores.map((f) => f.googleDriveId).sort()).toEqual([
      'doc-b',
      'v1-constructores',
    ]);
  });

  it('una segunda sincronización sin cambios en Drive no escribe nada', async () => {
    await sincronizarLosDosCentros();
    jest.clearAllMocks();

    await sincronizarLosDosCentros();

    expect(mockPrisma.documentFromDrive.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.documentFromDrive.update).not.toHaveBeenCalled();
  });
  it('si el tope de tiempo corta la lectura, escribe solo las carpetas que leyó completas y dice cuántas quedaron', async () => {
    mockListarPorNiveles.mockImplementation(async (raices: string[]) => {
      const leido = await listarCompleto(raices);
      if (raices.includes('v1-armonia')) leido.incompletas.add('v1-armonia');
      return leido;
    });
    sesion('armonia', [P.VER_DOCUMENTOS]);

    const r = await syncDocumentsWithGoogleDrive();

    expect(r.success).toBe(true);
    expect((r.data as { pendientes: number }).pendientes).toBe(1);
    const ids = indice.map((f) => f.googleDriveId);
    // Lo de v1-armonia no se escribió a medias: no está ni la carpeta.
    for (const id of ['v1-armonia', 'generados-a', 'doc-a'])
      expect(ids).not.toContain(id);
    // La otra carpeta, leída completa, sí.
    expect(ids).toEqual(expect.arrayContaining(['v1-armonia-2', 'doc-a2']));
  });

  it('primero lee los casos que todavía no tienen fila en el índice', async () => {
    // v1-armonia ya se indexó en una corrida anterior; v1-armonia-2 no.
    indice.push({
      id: 'fila-previa',
      tenantId: 'armonia',
      googleDriveId: 'v1-armonia',
      fileName: 'INSOL-000007',
      mimeType: 'application/vnd.google-apps.folder',
      folderPath: ['Armonía'],
      parentFolderId: null,
      isFolder: true,
      size: null,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
    });
    sesion('armonia', [P.VER_DOCUMENTOS]);

    await syncDocumentsWithGoogleDrive();

    // La primera llamada es el árbol del centro; la segunda, los casos.
    const [raicesDeCasos] = mockListarPorNiveles.mock.calls[1];
    expect(raicesDeCasos).toEqual(['v1-armonia-2', 'v1-armonia']);
  });
});

describe('lectura: solo lo de los casos visibles, y nunca de otro centro', () => {
  const idsVistos = async () => {
    const r = await getDocumentsFromDrive();
    expect(r.success).toBe(true);
    return (r.data ?? []).map((d) => d.googleDriveId).sort();
  };

  it('un usuario de un centro nunca ve la carpeta ni los archivos de un caso de otro centro, aunque tenga el mismo número', async () => {
    await sincronizarLosDosCentros();

    sesion('constructores-paz', [P.VER_DOCUMENTOS, P.VER_TODOS_CASOS]);
    const deConstructores = await idsVistos();
    expect(deConstructores).toEqual(['doc-b', 'v1-constructores']);

    sesion('armonia', [P.VER_DOCUMENTOS, P.VER_TODOS_CASOS]);
    const deArmonia = await idsVistos();
    for (const id of ['doc-b', 'v1-constructores'])
      expect(deArmonia).not.toContain(id);
    // Y ve lo suyo: los números actuales ya no quedan afuera.
    expect(deArmonia).toEqual(
      ['doc-a', 'doc-a2', 'generados-a', 'v1-armonia', 'v1-armonia-2'].sort(),
    );
  });

  it('con alcance "propios" ve solo los casos que opera', async () => {
    await sincronizarLosDosCentros();

    sesion('armonia', [P.VER_DOCUMENTOS, P.VER_CASOS_PROPIOS]);
    expect(await idsVistos()).toEqual(
      ['doc-a', 'generados-a', 'v1-armonia'].sort(),
    );
  });

  it('sin permiso de alcance no ve nada y ni siquiera lee el índice', async () => {
    await sincronizarLosDosCentros();
    mockPrisma.documentFromDrive.findMany.mockClear();

    sesion('armonia', [P.VER_DOCUMENTOS]);
    expect(await idsVistos()).toEqual([]);
    expect(mockPrisma.documentFromDrive.findMany).not.toHaveBeenCalled();
  });
});
