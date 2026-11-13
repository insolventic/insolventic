/**
 * `resolveCaseFolder`: la carpeta de Drive de un caso se decide en un solo
 * lugar.
 *
 * Antes la generación del alta recalculaba la ruta y el job la guardaba
 * pisando la que hubiera, `/documents` usaba siempre la ruta v0, y los
 * adjuntos del alta creaban la v0 antes de que el job guardara la v1: un
 * expediente con documentos en dos carpetas.
 *
 * La base es un fake en memoria de UNA fila de `Case`, con el `updateMany`
 * condicional de verdad (`driveFolderId: null` en el `where`), para que la
 * concurrencia se pruebe contra la misma semántica que Postgres.
 */
const mockWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: (...a: unknown[]) => mockWarn(...a),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

interface FilaCaso {
  id: string;
  tenantId: string;
  caseNumber: string;
  type: string;
  createdDate: Date;
  debtorName: string | null;
  centroConciliacionNombre: string | null;
  driveFolderId: string | null;
  layoutVersion: number;
  debtor: { name: string } | null;
  tenant: { slug: string };
}

let fila: FilaCaso | null;

function coincide(where: Record<string, unknown>): boolean {
  if (!fila) return false;
  if (where.id !== fila.id || where.tenantId !== fila.tenantId) return false;
  if ('driveFolderId' in where && where.driveFolderId !== fila.driveFolderId) {
    return false;
  }
  return true;
}

const mockFindUnique = jest.fn(
  async ({ where }: { where: Record<string, unknown> }) =>
    coincide(where) ? { ...fila! } : null,
);
const mockUpdateMany = jest.fn(
  async ({
    where,
    data,
  }: {
    where: Record<string, unknown>;
    data: Partial<FilaCaso>;
  }) => {
    if (!coincide(where)) return { count: 0 };
    Object.assign(fila!, data);
    return { count: 1 };
  },
);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: {
      findUnique: (...a: unknown[]) =>
        mockFindUnique(...(a as [{ where: Record<string, unknown> }])),
      updateMany: (...a: unknown[]) =>
        mockUpdateMany(
          ...(a as [
            { where: Record<string, unknown>; data: Partial<FilaCaso> },
          ]),
        ),
    },
  },
}));

const mockCreateFolderHierarchy = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
  },
}));

import {
  anioDelCaso,
  resolveCaseFolder,
  rutaDeCarpetaV1,
} from '@/features/document/case-folder';

const RAIZ = 'raiz-de-drive';

function casoBase(cambios: Partial<FilaCaso> = {}): FilaCaso {
  return {
    id: 'caso-1',
    tenantId: 'tenant-cuid-1',
    caseNumber: 'INSOL-000003',
    type: 'INSOLVENCY',
    createdDate: new Date('2026-11-10T15:00:00Z'),
    debtorName: 'Ana María Pérez Gómez',
    centroConciliacionNombre: null,
    driveFolderId: null,
    layoutVersion: 0,
    debtor: { name: 'Ana María Pérez Gómez' },
    tenant: { slug: 'armonia' },
    ...cambios,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_DRIVE_FOLDER_ID = RAIZ;
  fila = casoBase();
  mockCreateFolderHierarchy.mockResolvedValue('carpeta-v1');
});

describe('resolveCaseFolder', () => {
  it('(a) con carpeta v1 guardada la usa tal cual, sin tocar Drive', async () => {
    fila = casoBase({ driveFolderId: 'carpeta-guardada', layoutVersion: 1 });

    const carpeta = await resolveCaseFolder('caso-1', 'tenant-cuid-1');

    expect(carpeta).toEqual({
      folderId: 'carpeta-guardada',
      layoutVersion: 1,
      creada: false,
    });
    expect(mockCreateFolderHierarchy).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('(b) un caso v0 conserva su carpeta y su layout: no se recalcula ni se migra', async () => {
    fila = casoBase({ driveFolderId: 'carpeta-v0', layoutVersion: 0 });

    const carpeta = await resolveCaseFolder('caso-1', 'tenant-cuid-1');

    expect(carpeta).toEqual({
      folderId: 'carpeta-v0',
      layoutVersion: 0,
      creada: false,
    });
    expect(mockCreateFolderHierarchy).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(fila).toMatchObject({
      driveFolderId: 'carpeta-v0',
      layoutVersion: 0,
    });
  });

  it('(c) sin carpeta crea la v1 y guarda driveFolderId y layoutVersion juntos, con update condicional', async () => {
    const carpeta = await resolveCaseFolder('caso-1', 'tenant-cuid-1');

    expect(carpeta).toEqual({
      folderId: 'carpeta-v1',
      layoutVersion: 1,
      creada: true,
    });
    expect(mockCreateFolderHierarchy).toHaveBeenCalledWith(
      [
        'Insolventic',
        'Armonía',
        'Insolvencia',
        '2026',
        'INSOL-000003 - Pérez Gómez',
      ],
      RAIZ,
    );
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'caso-1', tenantId: 'tenant-cuid-1', driveFolderId: null },
      data: { driveFolderId: 'carpeta-v1', layoutVersion: 1 },
    });
    expect(fila).toMatchObject({
      driveFolderId: 'carpeta-v1',
      layoutVersion: 1,
    });
  });

  it('es idempotente: la segunda llamada devuelve la misma carpeta sin volver a Drive', async () => {
    const primera = await resolveCaseFolder('caso-1', 'tenant-cuid-1');
    const segunda = await resolveCaseFolder('caso-1', 'tenant-cuid-1');

    expect(segunda.folderId).toBe(primera.folderId);
    expect(segunda).toEqual({
      folderId: 'carpeta-v1',
      layoutVersion: 1,
      creada: false,
    });
    expect(mockCreateFolderHierarchy).toHaveBeenCalledTimes(1);
  });

  it('el centro sale del tenant del caso, no de quien llama', async () => {
    fila = casoBase({ tenant: { slug: 'constructores-paz' } });

    await resolveCaseFolder('caso-1', 'tenant-cuid-1');

    expect(mockCreateFolderHierarchy.mock.calls[0][0][1]).toBe(
      'Constructores de Paz',
    );
  });

  it('no encuentra un caso de otro tenant', async () => {
    await expect(resolveCaseFolder('caso-1', 'otro-tenant')).rejects.toThrow(
      'Caso no encontrado',
    );
    expect(mockCreateFolderHierarchy).not.toHaveBeenCalled();
  });

  it('sin GOOGLE_DRIVE_FOLDER_ID falla sin crear ni guardar nada', async () => {
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;

    await expect(resolveCaseFolder('caso-1', 'tenant-cuid-1')).rejects.toThrow(
      'GOOGLE_DRIVE_FOLDER_ID',
    );
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(fila?.driveFolderId).toBeNull();
  });

  it('si Drive falla no guarda nada', async () => {
    mockCreateFolderHierarchy.mockRejectedValue(new Error('Drive caído'));

    await expect(resolveCaseFolder('caso-1', 'tenant-cuid-1')).rejects.toThrow(
      'Drive caído',
    );
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(fila?.driveFolderId).toBeNull();
  });

  describe('(e) dos peticiones a la vez', () => {
    /** Drive responde a las dos solo cuando ambas preguntaron. */
    function driveQueEsperaALasDos(ids: [string, string]) {
      const pendientes: Array<() => void> = [];
      let llamada = 0;
      mockCreateFolderHierarchy.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            const id = ids[llamada++];
            pendientes.push(() => resolve(id));
            if (pendientes.length === 2) pendientes.forEach((r) => r());
          }),
      );
    }

    it('si encuentran la misma carpeta, las dos devuelven ese id y no hay huérfana', async () => {
      driveQueEsperaALasDos(['carpeta-v1', 'carpeta-v1']);

      const [a, b] = await Promise.all([
        resolveCaseFolder('caso-1', 'tenant-cuid-1'),
        resolveCaseFolder('caso-1', 'tenant-cuid-1'),
      ]);

      expect(a.folderId).toBe('carpeta-v1');
      expect(b.folderId).toBe('carpeta-v1');
      expect([a.creada, b.creada].sort()).toEqual([false, true]);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('si cada una creó la suya, se guarda una sola y la perdedora usa la de la ganadora', async () => {
      driveQueEsperaALasDos(['carpeta-ganadora', 'carpeta-perdedora']);

      const [a, b] = await Promise.all([
        resolveCaseFolder('caso-1', 'tenant-cuid-1'),
        resolveCaseFolder('caso-1', 'tenant-cuid-1'),
      ]);

      expect(a.folderId).toBe('carpeta-ganadora');
      expect(b.folderId).toBe('carpeta-ganadora');
      expect(b.layoutVersion).toBe(1);
      expect(fila?.driveFolderId).toBe('carpeta-ganadora');
      // La huérfana se registra para limpiarla a mano; no se borra.
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('duplicada por concurrencia'),
        expect.objectContaining({
          caseId: 'caso-1',
          carpetaGuardada: 'carpeta-ganadora',
          carpetaHuerfana: 'carpeta-perdedora',
        }),
      );
    });
  });
});

describe('ruta v1', () => {
  it('el año es el de la creación del caso en hora de Colombia', () => {
    // 1 de enero 03:00 UTC = 31 de diciembre 22:00 en Colombia.
    expect(anioDelCaso(new Date('2027-01-01T03:00:00Z'))).toBe('2026');
    expect(anioDelCaso(new Date('2027-01-01T06:00:00Z'))).toBe('2027');
  });

  it('sin apellidos, la carpeta lleva solo el número', () => {
    expect(
      rutaDeCarpetaV1({
        caseNumber: 'CONC-000001',
        type: 'CONCILIATION',
        createdDate: new Date('2026-05-01T15:00:00Z'),
        nombreDelDeudor: '',
        centro: 'Armonia',
      }),
    ).toEqual([
      'Insolventic',
      'Armonia',
      'Conciliación',
      '2026',
      'CONC-000001',
    ]);
  });
});
