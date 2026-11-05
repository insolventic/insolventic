/**
 * Unit Tests: el límite de tamaño del comprobante es el que la plataforma aguanta.
 *
 * La UI y el manual prometían 10 MB y el servidor aceptaba hasta
 * `dataBase64.max(13_700_000)`, pero el archivo viajaba en base64 dentro de una
 * server action sin `bodySizeLimit`: Next corta en 1 MB, así que todo lo que
 * pasara de unos 760 KB reales rechazaba la promesa en el cliente y el usuario
 * veía "Error al registrar pago". Reproducido en local contra `next dev`.
 *
 * Subir `bodySizeLimit` solo no alcanza: Vercel corta el cuerpo en 4,5 MB. El
 * test de configuración sujeta las dos puntas.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
jest.mock('@/lib/google-drive', () => ({
  googleDriveService: {
    createFolderHierarchy: (...a: unknown[]) => mockCreateFolderHierarchy(...a),
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
    getFileUrl: (id: string) => `https://drive.google.com/file/d/${id}/view`,
  },
}));

// El mismo parser que usa Next para leer `bodySizeLimit` (action-handler.js).
const bytes: {
  parse: (v: string) => number;
} = require('next/dist/compiled/bytes');

import nextConfig from '../../../next.config';
import { authenticateUser } from '@/features/auth/actions';
import {
  markPaymentPaid,
  registerPayment,
  uploadPaymentReceipt,
} from '@/features/payment/actions';
import {
  errorDeTamanoDeComprobante,
  MAX_COMPROBANTE_BYTES,
  MAX_COMPROBANTE_MB,
} from '@/features/payment/constants';
import { P } from '@/lib/permissions';

/** Corte de Vercel: 4,5 MB. Se toma en base 1000, la lectura más estricta. */
const CORTE_DE_VERCEL_BYTES = 4_500_000;

/** Lo que el cuerpo lleva además del archivo: cabeceras multipart y campos. */
const HOLGURA_DEL_CUERPO_BYTES = 64 * 1024;

function pdfDe(tamano: number): File {
  return new File([new Uint8Array(tamano)], 'comprobante.pdf', {
    type: 'application/pdf',
  });
}

const acciones = [
  [
    'markPaymentPaid',
    (receipt: File) => markPaymentPaid({ paymentId: 'pago-1', receipt }),
  ],
  [
    'registerPayment',
    (receipt: File) =>
      registerPayment({
        caseId: 'caso-1',
        amount: 100_000,
        paymentDate: '2026-11-05',
        receipt,
      }),
  ],
  [
    'uploadPaymentReceipt',
    (receipt: File) => uploadPaymentReceipt({ paymentId: 'pago-1', receipt }),
  ],
] as const;

describe('límite de tamaño del comprobante', () => {
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
      driveFolderId: 'carpeta-caso',
    });
    mockCreateFolderHierarchy.mockResolvedValue('carpeta-comprobantes');
    mockUploadFile.mockResolvedValue('archivo-subido');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('next.config.ts', () => {
    const limite = nextConfig.experimental?.serverActions?.bodySizeLimit;

    it('deja pasar un comprobante del tamaño máximo con el resto del formulario', () => {
      expect(limite).toBeDefined();
      expect(bytes.parse(limite as string)).toBeGreaterThanOrEqual(
        MAX_COMPROBANTE_BYTES + HOLGURA_DEL_CUERPO_BYTES,
      );
    });

    it('no promete más de lo que Vercel deja entrar', () => {
      expect(bytes.parse(limite as string)).toBeLessThanOrEqual(
        CORTE_DE_VERCEL_BYTES,
      );
    });
  });

  describe('servidor', () => {
    it.each(acciones)(
      '%s acepta un archivo justo en el límite y lo sube íntegro',
      async (_nombre, accion) => {
        const resultado = await accion(pdfDe(MAX_COMPROBANTE_BYTES));

        expect(resultado).toEqual({ success: true });
        expect(mockUploadFile).toHaveBeenCalledTimes(1);
        const [nombre, contenido, tipo] = mockUploadFile.mock.calls[0];
        expect(nombre).toBe('comprobante.pdf');
        expect(tipo).toBe('application/pdf');
        expect(Buffer.isBuffer(contenido)).toBe(true);
        expect(contenido).toHaveLength(MAX_COMPROBANTE_BYTES);
      },
    );

    it.each(acciones)(
      '%s rechaza un byte de más explicando el tamaño, sin tocar Drive ni el pago',
      async (_nombre, accion) => {
        const resultado = await accion(pdfDe(MAX_COMPROBANTE_BYTES + 1));

        expect(resultado.success).toBe(false);
        expect(resultado.error).toBe(
          errorDeTamanoDeComprobante(MAX_COMPROBANTE_BYTES + 1),
        );
        expect(mockUploadFile).not.toHaveBeenCalled();
        expect(mockPaymentUpdate).not.toHaveBeenCalled();
        expect(mockPaymentCreate).not.toHaveBeenCalled();
      },
    );
  });

  describe('mensaje', () => {
    it('dice cuánto pesa el archivo y cuál es el máximo', () => {
      expect(errorDeTamanoDeComprobante(5.2 * 1024 * 1024)).toMatch(
        /pesa 5,2 MB y el máximo es 4 MB/,
      );
    });

    it('no dice "pesa 4 MB" de un archivo apenas por encima del máximo', () => {
      expect(errorDeTamanoDeComprobante(MAX_COMPROBANTE_BYTES + 1)).toMatch(
        /pesa 4,1 MB/,
      );
    });

    it('calla si el archivo cabe', () => {
      expect(errorDeTamanoDeComprobante(MAX_COMPROBANTE_BYTES)).toBeNull();
    });
  });

  it('el manual de usuario dice el mismo límite', () => {
    const manual = readFileSync(
      join(process.cwd(), 'docs/MANUAL_USUARIO.md'),
      'utf8',
    );
    expect(manual).toContain(
      `**Comprobante** (PDF / JPG / PNG, máx. ${MAX_COMPROBANTE_MB} MB)`,
    );
  });
});
