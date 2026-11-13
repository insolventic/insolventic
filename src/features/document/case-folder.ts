/**
 * La carpeta de Google Drive de un caso: un solo lugar que la decide.
 *
 * Antes cada módulo la resolvía por su cuenta, y no coincidían:
 *
 *  - La generación del alta recalculaba la ruta v1 con el año y el apellido
 *    del momento, aunque el caso ya tuviera carpeta, y el job la guardaba
 *    pisando la que hubiera.
 *  - `/documents` usaba siempre la ruta v0 (`documentos-generados/{centro}/{N°}`)
 *    e ignoraba la carpeta guardada.
 *  - Los adjuntos del alta llegaban antes que el job, creaban la carpeta v0 y
 *    después el job guardaba encima la v1.
 *
 * Resultado: un mismo expediente con documentos repartidos en dos carpetas.
 *
 * LA REGLA. Si el caso tiene `driveFolderId`, esa es su carpeta, tal cual, con
 * su `layoutVersion` (un caso v0 conserva la suya: no se recalcula, no se
 * mueve, no se migra). Si no tiene, se crea la carpeta v1 y se guardan
 * `driveFolderId` y `layoutVersion = 1` juntos, con un `update` condicional
 * (`driveFolderId = null`): dos peticiones a la vez guardan un solo id y la
 * que pierde usa el de la que ganó.
 *
 * Sin `'use server'`: lo importan las acciones de documentos y de casos.
 */
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';
import { isRetryableDriveError } from '@/lib/drive-errors';
import { resolveCenterFolderName } from '@/lib/centro-conciliacion';

/** Versión del layout que crea `resolveCaseFolder`. */
export const LAYOUT_SECCIONADO = 1;

export interface CarpetaDelCaso {
  /** Id de la carpeta del caso en Drive: siempre la guardada en `driveFolderId`. */
  folderId: string;
  /** `layoutVersion` guardado: 0 (legacy) o 1 (seccionado). */
  layoutVersion: number;
  /** `true` solo si esta llamada creó y guardó la carpeta. */
  creada: boolean;
}

type TipoDeCaso = 'INSOLVENCY' | 'CONCILIATION' | 'SUPPORT_AGREEMENT';

/** Nombre de la carpeta del tipo de trámite en el layout v1. */
export function caseTypeFolderLabel(
  caseType: string | null | undefined,
): string {
  switch (caseType as TipoDeCaso) {
    case 'CONCILIATION':
      return 'Conciliación';
    case 'SUPPORT_AGREEMENT':
      return 'Acuerdos de Apoyo';
    case 'INSOLVENCY':
    default:
      return 'Insolvencia';
  }
}

/** Apellidos del deudor (los dos últimos tokens), sin caracteres que Drive rechace. */
export function extractSurname(debtorName: string | null | undefined): string {
  const cleaned = (debtorName || '').trim().replace(/[\\/\0]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return parts.slice(-2).join(' ').substring(0, 40);
}

/**
 * Año del caso en hora de Colombia, a partir de su fecha de creación. No el
 * año del momento en que se resuelve: un reintento en enero, o una generación
 * entre las 19:00 y las 24:00 del 31 de diciembre (ya otro año en UTC), no
 * debe caer en la carpeta de otro año.
 */
export function anioDelCaso(createdDate: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
  }).format(createdDate);
}

/**
 * Ruta v1 de la carpeta del caso, relativa a `GOOGLE_DRIVE_FOLDER_ID`:
 * `Insolventic/{Centro}/{Tipo}/{Año}/{N° - Apellidos}`.
 */
export function rutaDeCarpetaV1(caso: {
  caseNumber: string;
  type: string | null;
  createdDate: Date;
  nombreDelDeudor: string | null;
  centro: string;
}): string[] {
  const apellidos = extractSurname(caso.nombreDelDeudor);
  return [
    'Insolventic',
    caso.centro,
    caseTypeFolderLabel(caso.type),
    anioDelCaso(caso.createdDate),
    apellidos ? `${caso.caseNumber} - ${apellidos}` : caso.caseNumber,
  ];
}

const SELECT_CASO = {
  id: true,
  caseNumber: true,
  type: true,
  createdDate: true,
  debtorName: true,
  centroConciliacionNombre: true,
  driveFolderId: true,
  layoutVersion: true,
  debtor: { select: { name: true } },
  tenant: { select: { slug: true } },
} as const;

/**
 * La carpeta del caso en Drive, creándola si todavía no tiene.
 *
 * Es la única función que decide la carpeta raíz de un caso (lo vigila
 * `tests/unit/documents/carpeta-del-caso-unica.test.ts`). Quien suba algo a un
 * caso pide la carpeta aquí y arma sus subcarpetas debajo según
 * `layoutVersion`.
 *
 * @throws si el caso no existe en el tenant, si falta `GOOGLE_DRIVE_FOLDER_ID`
 *   o si Drive falla al crear la carpeta tras los reintentos.
 */
export async function resolveCaseFolder(
  caseId: string,
  tenantId: string,
): Promise<CarpetaDelCaso> {
  const caso = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: SELECT_CASO,
  });
  if (!caso) {
    throw new Error('Caso no encontrado al resolver su carpeta de Drive');
  }

  if (caso.driveFolderId) {
    return {
      folderId: caso.driveFolderId,
      layoutVersion: caso.layoutVersion,
      creada: false,
    };
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID no esta configurado');
  }

  // El centro sale del tenant DEL CASO, no de la sesión: así todos los módulos
  // calculan el mismo nombre para el mismo caso.
  const centro = resolveCenterFolderName(
    caso.tenant?.slug ?? tenantId,
    caso.centroConciliacionNombre,
  );
  const ruta = rutaDeCarpetaV1({
    caseNumber: caso.caseNumber,
    type: caso.type,
    createdDate: caso.createdDate,
    nombreDelDeudor: caso.debtor?.name ?? caso.debtorName,
    centro,
  });

  const { googleDriveService } = await import('@/lib/google-drive');
  // find-or-create en cada nivel: dos peticiones a la vez casi siempre
  // encuentran la misma carpeta. Con reintento, como el resto de las llamadas
  // a Drive de la generación.
  const creadaAqui = await withRetry(
    () => googleDriveService.createFolderHierarchy(ruta, rootFolderId),
    {
      label: `case-folder:${caso.caseNumber}`,
      isRetryable: isRetryableDriveError,
    },
  );

  const { count } = await prisma.case.updateMany({
    where: { id: caseId, tenantId, driveFolderId: null },
    data: { driveFolderId: creadaAqui, layoutVersion: LAYOUT_SECCIONADO },
  });

  if (count === 1) {
    return {
      folderId: creadaAqui,
      layoutVersion: LAYOUT_SECCIONADO,
      creada: true,
    };
  }

  // Otra petición guardó primero: manda la suya.
  const guardado = await prisma.case.findUnique({
    where: { id: caseId, tenantId },
    select: { driveFolderId: true, layoutVersion: true },
  });
  if (!guardado?.driveFolderId) {
    throw new Error('No se pudo guardar la carpeta de Drive del caso');
  }

  if (guardado.driveFolderId !== creadaAqui) {
    // Solo pasa si las dos consultaron Drive antes de que cualquiera creara la
    // carpeta. La de esta petición queda vacía: no se subió nada a ella. No se
    // borra (nada se borra en Drive desde aquí); queda registrada para
    // limpiarla a mano.
    logger.warn(
      'Carpeta de caso duplicada por concurrencia; se usa la guardada',
      {
        action: 'resolve-case-folder',
        caseId,
        carpetaGuardada: guardado.driveFolderId,
        carpetaHuerfana: creadaAqui,
      },
    );
  }

  return {
    folderId: guardado.driveFolderId,
    layoutVersion: guardado.layoutVersion,
    creada: false,
  };
}
