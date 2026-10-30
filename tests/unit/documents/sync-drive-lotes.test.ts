/**
 * Unit Tests: `syncDocumentsWithGoogleDrive` escribe por lotes (P-2).
 *
 * La sincronización era un N+1 doble: por **cada** carpeta y por **cada**
 * archivo del árbol de Drive hacía un `findUnique` y después un `update` o un
 * `create`, en serie. Para un centro con 5.000 casos y ~10 documentos cada uno
 * son ~50.000 ítems y del orden de 100.000 round trips, dentro de una server
 * action con techo de 60 s (hallazgo P-2 de
 * `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * Lo que estos tests fijan es la propiedad que importa: **la cantidad de
 * consultas no crece con la cantidad de ítems**. Por eso varios cuentan
 * llamadas en vez de mirar datos — un `findUnique` por ítem volvería a pasar
 * todos los tests de comportamiento y ninguno de estos.
 *
 * No había ningún test de esta función antes.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'root-folder-id';

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

const mockListFoldersAndFiles = jest.fn();
const mockCreateFolderHierarchy = jest.fn();
const mockListAllRecursively = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    listFoldersAndFiles: (...a: unknown[]) => mockListFoldersAndFiles(...a),
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    listAllFoldersAndFilesRecursively: (...a: unknown[]) =>
      mockListAllRecursively(...a),
  },
}));

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { TENANT, ADMIN_USER } from '../../helpers/fixtures';
import { P } from '@/lib/permissions';
import { syncDocumentsWithGoogleDrive } from '@/features/document/actions';

/** Un archivo como lo devuelve el listado recursivo de Drive. */
function archivoDeDrive(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `file-${i}`,
    name: `documento-${i}.pdf`,
    mimeType: 'application/pdf',
    path: ['INS-2026-001'],
    parentId: 'carpeta-caso',
    size: '1024',
    createdTime: '2026-01-01T00:00:00.000Z',
    modifiedTime: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Una fila ya guardada, consistente con `archivoDeDrive(i)`. */
function filaGuardada(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `row-${i}`,
    googleDriveId: `file-${i}`,
    fileName: `documento-${i}.pdf`,
    mimeType: 'application/pdf',
    folderPath: ['Armonía', 'INS-2026-001'],
    parentFolderId: 'carpeta-caso',
    isFolder: false,
    size: '1024',
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

function conArbolDeDrive(folders: unknown[], files: unknown[]) {
  mockListFoldersAndFiles.mockResolvedValue({
    folders: [{ id: 'docgen', name: 'documentos-generados' }],
    files: [],
  });
  mockCreateFolderHierarchy.mockResolvedValue('centro-folder-id');
  mockListAllRecursively.mockResolvedValue({ folders, files });
}

describe('syncDocumentsWithGoogleDrive — lotes en vez de N+1', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        permissions: [P.VER_DOCUMENTOS],
      },
      tenantId: TENANT.id,
      tenantSlug: 'armonia',
    });
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([]);
    mockPrisma.documentFromDrive.createMany.mockResolvedValue({ count: 0 });
  });

  it('nunca usa `findUnique`: lee lo existente con un `findMany` por lote de ids', async () => {
    conArbolDeDrive([], [archivoDeDrive(1), archivoDeDrive(2)]);

    const result = await syncDocumentsWithGoogleDrive();

    expect(result.success).toBe(true);
    expect(mockPrisma.documentFromDrive.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.documentFromDrive.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.documentFromDrive.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT.id,
          googleDriveId: { in: ['file-1', 'file-2'] },
        },
      }),
    );
  });

  it('crea con `createMany` por lotes, no con un `create` por ítem', async () => {
    const files = Array.from({ length: 450 }, (_, i) => archivoDeDrive(i));
    conArbolDeDrive([], files);

    const result = await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.create).not.toHaveBeenCalled();
    // 450 filas en lotes de 200.
    expect(mockPrisma.documentFromDrive.createMany).toHaveBeenCalledTimes(3);
    expect(result.data).toMatchObject({
      created: 450,
      updated: 0,
      synced: 450,
    });
  });

  it('con 1.200 ítems la cantidad de consultas sigue siendo de dos dígitos', async () => {
    const files = Array.from({ length: 1200 }, (_, i) => archivoDeDrive(i));
    conArbolDeDrive([], files);

    await syncDocumentsWithGoogleDrive();

    // Lecturas: 1.200 ids en lotes de 500 => 3. Escrituras: lotes de 200 => 6.
    // Antes eran 1.200 findUnique + 1.200 create = 2.400 viajes.
    expect(mockPrisma.documentFromDrive.findMany).toHaveBeenCalledTimes(3);
    expect(mockPrisma.documentFromDrive.createMany).toHaveBeenCalledTimes(6);
    const total =
      mockPrisma.documentFromDrive.findMany.mock.calls.length +
      mockPrisma.documentFromDrive.createMany.mock.calls.length +
      mockPrisma.documentFromDrive.update.mock.calls.length;
    expect(total).toBeLessThan(20);
  });

  it('`skipDuplicates` en el `createMany`: dos sincronizaciones a la vez no se pisan', async () => {
    conArbolDeDrive([], [archivoDeDrive(1)]);

    await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('una fila que ya dice lo mismo que Drive NO se reescribe', async () => {
    conArbolDeDrive([], [archivoDeDrive(1)]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([filaGuardada(1)]);

    const result = await syncDocumentsWithGoogleDrive();

    // Antes reescribía cada fila en cada corrida: una sincronización repetida
    // hacía 50.000 updates para dejar todo igual.
    expect(mockPrisma.documentFromDrive.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
    });
  });

  it('una fila que cambió se actualiza, dentro de una `$transaction`', async () => {
    conArbolDeDrive([], [archivoDeDrive(1, { name: 'renombrado.pdf' })]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([filaGuardada(1)]);

    const result = await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.documentFromDrive.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-1' },
        data: expect.objectContaining({ fileName: 'renombrado.pdf' }),
      }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ updated: 1, unchanged: 0 });
  });

  it('las carpetas van en el mismo lote que los archivos', async () => {
    conArbolDeDrive(
      [
        {
          id: 'folder-1',
          name: 'INS-2026-001',
          path: [],
          parentId: 'centro-folder-id',
          createdTime: '2026-01-01T00:00:00.000Z',
          modifiedTime: '2026-01-01T00:00:00.000Z',
        },
      ],
      [archivoDeDrive(1)],
    );

    const result = await syncDocumentsWithGoogleDrive();

    // Un solo `findMany` para carpeta + archivo, y un solo `createMany`.
    expect(mockPrisma.documentFromDrive.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.documentFromDrive.createMany).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ folders: 1, created: 2, synced: 2 });
  });

  it('la carpeta guarda el nombre del centro al frente de la ruta', async () => {
    conArbolDeDrive(
      [
        {
          id: 'folder-1',
          name: 'INS-2026-001',
          path: ['INS-2026-001'],
          parentId: 'centro-folder-id',
          createdTime: '2026-01-01T00:00:00.000Z',
          modifiedTime: '2026-01-01T00:00:00.000Z',
        },
      ],
      [],
    );

    await syncDocumentsWithGoogleDrive();

    const { data } = mockPrisma.documentFromDrive.createMany.mock
      .calls[0][0] as {
      data: { folderPath: string[]; isFolder: boolean }[];
    };
    expect(data[0].folderPath[0]).toBe('Armonía');
    expect(data[0].isFolder).toBe(true);
  });
});

describe('syncDocumentsWithGoogleDrive — la regla de la ruta guardada', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    mockAuthenticateUser.mockResolvedValue({
      user: {
        id: ADMIN_USER.id,
        name: ADMIN_USER.name,
        email: ADMIN_USER.email,
        permissions: [P.VER_DOCUMENTOS],
      },
      tenantId: TENANT.id,
      tenantSlug: 'armonia',
    });
    mockPrisma.documentFromDrive.createMany.mockResolvedValue({ count: 0 });
  });

  it('respeta la ruta guardada si ya nombra el caso (con prefijo de centro)', async () => {
    // Drive dice otra ruta, pero la guardada ya identifica el expediente: se
    // conserva. Era la condición del `update` viejo, y acá queda a la vista.
    conArbolDeDrive([], [archivoDeDrive(1, { path: ['otra-carpeta'] })]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([
      filaGuardada(1, { folderPath: ['Armonía', 'INS-2026-001'] }),
    ]);

    const result = await syncDocumentsWithGoogleDrive();

    // Nada más cambió, así que la fila queda intacta.
    expect(mockPrisma.documentFromDrive.update).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ unchanged: 1 });
  });

  it('respeta la ruta guardada vieja, sin prefijo de centro', async () => {
    conArbolDeDrive([], [archivoDeDrive(1, { path: ['otra-carpeta'] })]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([
      filaGuardada(1, { folderPath: ['INS-2026-001', 'Solicitud'] }),
    ]);

    const result = await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.update).not.toHaveBeenCalled();
    expect(result.data).toMatchObject({ unchanged: 1 });
  });

  it('reescribe la ruta cuando la guardada está vacía', async () => {
    conArbolDeDrive([], [archivoDeDrive(1)]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([
      filaGuardada(1, { folderPath: [] }),
    ]);

    await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folderPath: ['Armonía', 'INS-2026-001'],
        }),
      }),
    );
  });

  it('reescribe la ruta cuando la guardada no nombra ningún caso', async () => {
    conArbolDeDrive([], [archivoDeDrive(1)]);
    mockPrisma.documentFromDrive.findMany.mockResolvedValue([
      filaGuardada(1, { folderPath: ['suelto', 'sin-caso'] }),
    ]);

    await syncDocumentsWithGoogleDrive();

    expect(mockPrisma.documentFromDrive.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folderPath: ['Armonía', 'INS-2026-001'],
        }),
      }),
    );
  });
});
