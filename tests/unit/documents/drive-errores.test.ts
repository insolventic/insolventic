/**
 * Unit Tests: los errores de Google Drive conservan su causa (R-1).
 *
 * Las 13 rutas de error de `src/lib/google-drive.ts` seguían todas el mismo
 * patrón:
 *
 * ```ts
 * } catch (error) {
 *   console.error('Error subiendo archivo a Google Drive:', error);
 *   throw new Error('Error al subir archivo a Google Drive');
 * }
 * ```
 *
 * El `Error` nuevo no llevaba `cause`, así que a Sentry y al operador les
 * llegaba el mismo texto para un token expirado, una cuota agotada, un 429 y
 * una carpeta borrada a mano — cuatro incidentes con cuatro procedimientos
 * distintos en `docs/RUNBOOK.md` §3.4, que pide diagnosticar justo lo que el
 * código acababa de borrar (hallazgo R-1 de
 * `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * Y sin la causa no se puede clasificar el error, así que los reintentos que ya
 * existían en la generación de documentos gastaban tres intentos con backoff
 * sobre un 404.
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFilesCreate = jest.fn();
const mockSetCredentials = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials = mockSetCredentials;
      },
    },
    drive: () => ({
      files: {
        create: (...args: unknown[]) => mockFilesCreate(...args),
      },
    }),
  },
}));

import { logger } from '@/lib/logger';
import { isRetryableDriveError, statusDeDrive } from '@/lib/drive-errors';

/** Un error como los que devuelve `googleapis`. */
function errorDeApi(status: number, reason?: string) {
  return Object.assign(new Error(`Drive respondió ${status}`), {
    code: status,
    response: { status },
    ...(reason ? { errors: [{ reason }] } : {}),
  });
}

describe('statusDeDrive', () => {
  it('lo saca de `code`, de `status` o de `response.status`', () => {
    expect(statusDeDrive({ code: 429 })).toBe(429);
    expect(statusDeDrive({ status: 503 })).toBe(503);
    expect(statusDeDrive({ response: { status: 404 } })).toBe(404);
    // `googleapis` a veces lo manda como string.
    expect(statusDeDrive({ code: '500' })).toBe(500);
  });

  it('devuelve undefined cuando no hay nada de donde sacarlo', () => {
    expect(statusDeDrive(new Error('boom'))).toBeUndefined();
    expect(statusDeDrive(null)).toBeUndefined();
    expect(statusDeDrive('texto')).toBeUndefined();
  });
});

describe('isRetryableDriveError', () => {
  it('reintenta lo transitorio: 408, 429 y los 5xx', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(isRetryableDriveError(errorDeApi(status))).toBe(true);
    }
  });

  it('NO reintenta lo permanente: 400, 401, 403 y 404', () => {
    // Es el caso que gastaba tres intentos con backoff (~1,5 s del
    // presupuesto de la función) para terminar en el mismo error.
    for (const status of [400, 401, 403, 404]) {
      expect(isRetryableDriveError(errorDeApi(status))).toBe(false);
    }
  });

  it('un 403 por cuota SÍ se reintenta: lo dice el `reason`, no el status', () => {
    // Drive devuelve 403 para "rateLimitExceeded", que es exactamente lo que
    // un backoff resuelve.
    expect(isRetryableDriveError(errorDeApi(403, 'rateLimitExceeded'))).toBe(
      true,
    );
    expect(
      isRetryableDriveError(errorDeApi(403, 'userRateLimitExceeded')),
    ).toBe(true);
    // Pero un 403 de permisos no.
    expect(
      isRetryableDriveError(errorDeApi(403, 'insufficientFilePermissions')),
    ).toBe(false);
  });

  it('reintenta los errores de red de Node', () => {
    for (const code of ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']) {
      expect(
        isRetryableDriveError(Object.assign(new Error('red'), { code })),
      ).toBe(true);
    }
  });

  it('sin status ni reason reintenta: es el default que ya había', () => {
    expect(isRetryableDriveError(new Error('algo raro'))).toBe(true);
  });

  it('clasifica por la CAUSA cuando el error viene envuelto', () => {
    // Esta es la razon de ser del `cause`: el error que ve `withRetry` es el
    // envuelto por google-drive.ts, no el de la API.
    const envuelto = new Error('Error al subir archivo a Google Drive', {
      cause: errorDeApi(404),
    });

    expect(isRetryableDriveError(envuelto)).toBe(false);

    const envuelto429 = new Error('Error al subir archivo a Google Drive', {
      cause: errorDeApi(429),
    });
    expect(isRetryableDriveError(envuelto429)).toBe(true);
  });
});

describe('googleDriveService.uploadFile — el error llega con su causa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'root';
  });

  it('preserva el error de la API en `cause` y no cambia el mensaje al usuario', async () => {
    const original = errorDeApi(429, 'rateLimitExceeded');
    mockFilesCreate.mockRejectedValue(original);

    const { googleDriveService } = await import('@/lib/google-drive');

    await expect(
      googleDriveService.uploadFile(
        'documento.pdf',
        Buffer.from('x'),
        'application/pdf',
        'folder-1',
      ),
    ).rejects.toMatchObject({
      // El mensaje de cara al usuario no cambia...
      message: 'Error al subir archivo a Google Drive',
      // ...y la causa, que antes se perdía, viaja con él.
      cause: original,
    });
  });

  it('registra el status y si era reintentable, con su `action`', async () => {
    mockFilesCreate.mockRejectedValue(errorDeApi(404));

    const { googleDriveService } = await import('@/lib/google-drive');

    await googleDriveService
      .uploadFile('doc.pdf', Buffer.from('x'), 'application/pdf', 'folder-1')
      .catch(() => undefined);

    // `action: 'drive-upload'` es el patrón que CLAUDE.md documentaba y que
    // no existía en el código.
    expect(logger.error).toHaveBeenCalledWith(
      'Error al subir archivo a Google Drive',
      expect.anything(),
      expect.objectContaining({
        action: 'drive-upload',
        fileName: 'doc.pdf',
        folderId: 'folder-1',
        driveStatus: 404,
        retryable: false,
      }),
    );
  });

  it('el error de "sin carpeta" sigue siendo el suyo, no uno de Drive', async () => {
    const { googleDriveService } = await import('@/lib/google-drive');

    await expect(
      googleDriveService.uploadFile(
        'doc.pdf',
        Buffer.from('x'),
        'application/pdf',
        undefined,
      ),
    ).rejects.toMatchObject({
      message: 'Error al subir archivo a Google Drive',
    });
    // La causa es el error de validación, que nombra el archivo.
    const lanzado = await googleDriveService
      .uploadFile('doc.pdf', Buffer.from('x'), 'application/pdf', undefined)
      .catch((e) => e as Error);
    expect((lanzado.cause as Error).message).toContain('doc.pdf');
    expect(mockFilesCreate).not.toHaveBeenCalled();
  });
});
