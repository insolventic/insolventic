/**
 * Unit Tests: el comprobante de pago se sube a la carpeta `Comprobantes` del caso.
 *
 * `uploadReceiptToDrive` destructuraba como arreglo el resultado de
 * `createFolderHierarchy`, que es un `string`:
 *
 * ```ts
 * const [comprobantesFolderId] = await googleDriveService.createFolderHierarchy(...)
 * ```
 *
 * Un string es iterable, así que TypeScript lo acepta y lo que queda es el
 * primer carácter del id. Ese carácter llegaba a `uploadFile` como carpeta.
 */

jest.mock('next/headers', () => require('../../__mocks__/next-headers'));
jest.mock('next/cache', () => require('../../__mocks__/next-cache'));
jest.mock('next/navigation', () => require('../../__mocks__/next-navigation'));

const mockPaymentFindUnique = jest.fn();
const mockPaymentUpdate = jest.fn();
const mockPaymentCreate = jest.fn();
const mockCaseFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    payment: {
      findUnique: (...a: unknown[]) => mockPaymentFindUnique(...a),
      update: (...a: unknown[]) => mockPaymentUpdate(...a),
      create: (...a: unknown[]) => mockPaymentCreate(...a),
    },
    case: {
      findUnique: (...a: unknown[]) => mockCaseFindUnique(...a),
    },
  },
}));

jest.mock('@/features/auth/actions', () => ({
  authenticateUser: jest.fn(),
}));

jest.mock('@/features/audit-log/actions', () => ({
  createAuditLog: jest.fn(),
}));

const mockCreateFolderHierarchy = jest.fn();
const mockUploadFile = jest.fn();
const mockFindOrCreateCaseFolder = jest.fn();
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    findOrCreateCaseFolder: (...a: unknown[]) =>
      mockFindOrCreateCaseFolder(...a),
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
    getFileUrl: (id: string) => `https://drive.google.com/file/d/${id}/view`,
  },
}));

import { authenticateUser } from '@/features/auth/actions';
import {
  markPaymentPaid,
  registerPayment,
  uploadPaymentReceipt,
} from '@/features/payment/actions';
import { P } from '@/lib/permissions';

const ID_CARPETA_CASO = '1CarpetaDelCaso';
const ID_CARPETA_COMPROBANTES = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const ID_ARCHIVO = 'archivo-subido';

const archivo = new File(['%PDF-1.4'], 'comprobante.pdf', {
  type: 'application/pdf',
});

const acciones = [
  [
    'markPaymentPaid',
    () => markPaymentPaid({ paymentId: 'pago-1', receipt: archivo }),
  ],
  [
    'registerPayment',
    () =>
      registerPayment({
        caseId: 'caso-1',
        amount: 100_000,
        paymentDate: '2026-11-05',
        receipt: archivo,
      }),
  ],
  [
    'uploadPaymentReceipt',
    () => uploadPaymentReceipt({ paymentId: 'pago-1', receipt: archivo }),
  ],
] as const;

describe('comprobante de pago en Drive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    (authenticateUser as jest.Mock).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Operador',
        professionalCard: '123',
        permissions: [P.REGISTRAR_PAGOS],
      },
      tenantId: 'tenant-1',
    });
    mockPaymentFindUnique.mockResolvedValue({
      id: 'pago-1',
      caseId: 'caso-1',
      paymentNumber: 1,
      case: { id: 'caso-1', caseNumber: 'C-1', debtorName: 'Deudor' },
    });
    mockCaseFindUnique.mockResolvedValue({
      id: 'caso-1',
      caseNumber: 'C-1',
      debtorName: 'Deudor',
      debtorId: 'deudor-1',
      driveFolderId: ID_CARPETA_CASO,
    });
    mockCreateFolderHierarchy.mockResolvedValue(ID_CARPETA_COMPROBANTES);
    mockUploadFile.mockResolvedValue(ID_ARCHIVO);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(acciones)(
    '%s sube el archivo a la carpeta Comprobantes con su id completo',
    async (_nombre, accion) => {
      const resultado = await accion();

      expect(resultado).toEqual({ success: true });
      expect(mockCreateFolderHierarchy).toHaveBeenCalledWith(
        ['Comprobantes'],
        ID_CARPETA_CASO,
      );
      expect(mockUploadFile).toHaveBeenCalledTimes(1);
      expect(mockUploadFile.mock.calls[0][3]).toBe(ID_CARPETA_COMPROBANTES);
    },
  );

  // Lo que ve el usuario cuando Drive falla con el comprobante: un mensaje
  // fijo que dice qué pasó, sin el detalle interno, y el pago sin registrar
  // (la subida va antes de escribir el pago). El fallo original viaja como
  // `cause`; google-drive.ts ya lo registró con logger.error → Sentry.
  const MENSAJE =
    'No se pudo subir el comprobante a Google Drive. Intente nuevamente.';
  const DETALLE_INTERNO = 'fetch failed: ECONNRESET www.googleapis.com:443';

  const fallos = [
    [
      'la subida del archivo',
      () => mockUploadFile.mockRejectedValue(new Error(DETALLE_INTERNO)),
    ],
    [
      'la carpeta Comprobantes',
      () =>
        mockCreateFolderHierarchy.mockRejectedValue(new Error(DETALLE_INTERNO)),
    ],
    [
      'la carpeta del caso',
      () => {
        mockCaseFindUnique.mockResolvedValue({
          id: 'caso-1',
          caseNumber: 'C-1',
          debtorName: 'Deudor',
          debtorId: 'deudor-1',
          driveFolderId: null,
        });
        mockFindOrCreateCaseFolder.mockRejectedValue(
          new Error(DETALLE_INTERNO),
        );
      },
    ],
  ] as const;

  describe.each(acciones)('%s, si Drive falla', (_nombre, accion) => {
    it.each(fallos)(
      'en %s: mensaje fijo, sin detalle y sin tocar el pago',
      async (_paso, provocarFallo) => {
        provocarFallo();

        const resultado = await accion();

        expect(resultado).toEqual({ success: false, error: MENSAJE });
        expect(JSON.stringify(resultado)).not.toContain('ECONNRESET');
        expect(mockPaymentUpdate).not.toHaveBeenCalled();
        expect(mockPaymentCreate).not.toHaveBeenCalled();
      },
    );
  });
});
