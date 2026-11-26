'use server';

/**
 * Aceptación de los términos de uso y lectura de la política de privacidad
 * (N-G-07). La tabla solo recibe inserts: no hay ninguna acción que edite o
 * borre una aceptación, y no tiene que haberla.
 *
 * Las tres primeras actions son del propio usuario y no piden un permiso
 * aparte: cualquier cuenta autenticada tiene que poder ver qué le falta
 * aceptar, aceptarlo y ver su historial. La vista del centro exige
 * `P.VER_USUARIOS`.
 */

import { z } from 'zod';

import { authenticateUser } from '@/features/auth/actions';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { P } from '@/lib/permissions';
import { getRequestId } from '@/lib/request-context';

import {
  DOCUMENTOS_LEGALES,
  VERSIONES_VIGENTES,
  cubreVersionVigente,
  documentosPendientes,
  estadoDelDocumento,
  type DocumentoLegal,
  type EstadoDocumentoLegal,
  type VersionDocumentoLegal,
} from './documentos';

type Resultado<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const SESION_INVALIDA = 'Sesión inválida. Inicie sesión nuevamente.';

async function sesion() {
  try {
    return await authenticateUser();
  } catch (error) {
    // Esperado (token vencido, logout en curso): no va a Sentry.
    logger.info('Aceptación legal sin sesión válida', {
      action: 'aceptacion-legal',
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

/**
 * Qué documentos le falta aceptar al usuario en su versión vigente.
 *
 * El diálogo bloquea mientras esta lista no esté vacía, y **falla abierto**: si
 * la consulta falla, devuelve `success: false` y el cliente no bloquea. Una
 * caída de la base no puede dejar a un centro sin poder trabajar en sus casos.
 */
export async function getAceptacionesPendientes(): Promise<
  Resultado<VersionDocumentoLegal[]>
> {
  const s = await sesion();
  if (!s) return { success: false, error: SESION_INVALIDA };

  try {
    const aceptaciones = await prisma.aceptacionDocumentoLegal.findMany({
      where: {
        userId: s.user.id,
        tenantId: s.tenantId,
        documento: { in: [...DOCUMENTOS_LEGALES] },
      },
      select: { documento: true, version: true, sha256: true },
    });
    return {
      success: true,
      data: documentosPendientes(aceptaciones).map(
        (d) => VERSIONES_VIGENTES[d],
      ),
    };
  } catch (error) {
    logger.error('No se pudo consultar la aceptación de términos', error, {
      action: 'aceptacion-legal-pendientes',
      userId: s.user.id,
    });
    return { success: false, error: 'No se pudo consultar la aceptación.' };
  }
}

const aceptarSchema = z.object({
  aceptados: z
    .array(
      z.object({
        documento: z.enum(DOCUMENTOS_LEGALES),
        version: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * Registra que el usuario aceptó (términos) o leyó (privacidad) la versión
 * vigente de cada documento. El cliente manda la versión que mostró: si no es
 * la vigente, el texto cambió mientras el usuario lo leía y no se registra
 * nada.
 *
 * Idempotente: aceptar dos veces la misma versión no duplica la fila.
 * Devuelve lo que le queda pendiente.
 */
export async function aceptarDocumentosLegales(
  input: unknown,
): Promise<Resultado<VersionDocumentoLegal[]>> {
  const parsed = aceptarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Solicitud inválida.' };
  }

  const s = await sesion();
  if (!s) return { success: false, error: SESION_INVALIDA };

  const desactualizado = parsed.data.aceptados.find(
    (a) => a.version !== VERSIONES_VIGENTES[a.documento].version,
  );
  if (desactualizado) {
    return {
      success: false,
      error: `${VERSIONES_VIGENTES[desactualizado.documento].titulo} cambió mientras lo leía. Recargue la página y vuelva a leerlo.`,
    };
  }

  const documentos = [
    ...new Set(parsed.data.aceptados.map((a) => a.documento)),
  ];
  const requestId = getRequestId() ?? null;

  try {
    await prisma.aceptacionDocumentoLegal.createMany({
      data: documentos.map((documento) => ({
        tenantId: s.tenantId,
        userId: s.user.id,
        userName: s.user.name,
        userEmail: s.user.email,
        documento,
        version: VERSIONES_VIGENTES[documento].version,
        sha256: VERSIONES_VIGENTES[documento].sha256,
        requestId,
      })),
      skipDuplicates: true,
    });

    logger.info('Aceptación de documentos legales registrada', {
      action: 'aceptacion-legal-registrar',
      userId: s.user.id,
      documentos: documentos.join(','),
    });
  } catch (error) {
    logger.error('No se pudo registrar la aceptación de términos', error, {
      action: 'aceptacion-legal-registrar',
      userId: s.user.id,
    });
    return {
      success: false,
      error: 'No se pudo registrar la aceptación. Intente de nuevo.',
    };
  }

  return getAceptacionesPendientes();
}

export interface AceptacionDelUsuario {
  id: string;
  documento: DocumentoLegal;
  titulo: string;
  version: string;
  aceptadoEn: Date;
  /** Si cubre la versión vigente (misma versión y mismo hash). */
  vigente: boolean;
}

/** Historial propio, de la más reciente a la más vieja. Para /profile. */
export async function getMisAceptaciones(): Promise<
  Resultado<AceptacionDelUsuario[]>
> {
  const s = await sesion();
  if (!s) return { success: false, error: SESION_INVALIDA };

  try {
    const filas = await prisma.aceptacionDocumentoLegal.findMany({
      where: { userId: s.user.id, tenantId: s.tenantId },
      orderBy: { aceptadoEn: 'desc' },
      select: {
        id: true,
        documento: true,
        version: true,
        sha256: true,
        aceptadoEn: true,
      },
    });
    return {
      success: true,
      data: filas
        .filter((f) => f.documento in VERSIONES_VIGENTES)
        .map((f) => ({
          id: f.id,
          documento: f.documento as DocumentoLegal,
          titulo: VERSIONES_VIGENTES[f.documento as DocumentoLegal].titulo,
          version: f.version,
          aceptadoEn: f.aceptadoEn,
          vigente: cubreVersionVigente(f),
        })),
    };
  } catch (error) {
    logger.error('No se pudo leer el historial de aceptaciones', error, {
      action: 'aceptacion-legal-historial',
      userId: s.user.id,
    });
    return { success: false, error: 'No se pudo leer el historial.' };
  }
}

export interface EstadoDocumentoDeUsuario {
  estado: EstadoDocumentoLegal;
  /** Última aceptación de ese documento, si hay alguna. */
  version: string | null;
  aceptadoEn: Date | null;
}

export type EstadoAceptacionUsuario = Record<
  DocumentoLegal,
  EstadoDocumentoDeUsuario
> & { alDia: boolean };

/**
 * Estado de cada usuario del centro, por `userId`. Un usuario que no aparece
 * no aceptó nada todavía. Para la columna de /users.
 */
export async function getEstadoAceptacionesDelCentro(): Promise<
  Resultado<Record<string, EstadoAceptacionUsuario>>
> {
  const s = await sesion();
  if (!s) return { success: false, error: SESION_INVALIDA };
  if (!s.user.permissions.includes(P.VER_USUARIOS)) {
    return {
      success: false,
      error: `No tiene permisos para: ${P.VER_USUARIOS}`,
    };
  }

  try {
    const filas = await prisma.aceptacionDocumentoLegal.findMany({
      where: { tenantId: s.tenantId },
      orderBy: { aceptadoEn: 'desc' },
      select: {
        userId: true,
        documento: true,
        version: true,
        sha256: true,
        aceptadoEn: true,
      },
    });

    const porUsuario = new Map<string, typeof filas>();
    for (const f of filas) {
      const lista = porUsuario.get(f.userId) ?? [];
      lista.push(f);
      porUsuario.set(f.userId, lista);
    }

    const data: Record<string, EstadoAceptacionUsuario> = {};
    for (const [userId, lista] of porUsuario) {
      data[userId] = estadoDeUsuario(lista);
    }
    return { success: true, data };
  } catch (error) {
    logger.error('No se pudo leer el estado de aceptaciones', error, {
      action: 'aceptacion-legal-centro',
    });
    return { success: false, error: 'No se pudo leer el estado.' };
  }
}

function estadoDeUsuario(
  // Ordenadas de la más reciente a la más vieja.
  lista: {
    documento: string;
    version: string;
    sha256: string;
    aceptadoEn: Date;
  }[],
): EstadoAceptacionUsuario {
  const porDocumento = {} as Record<DocumentoLegal, EstadoDocumentoDeUsuario>;
  for (const documento of DOCUMENTOS_LEGALES) {
    const ultima = lista.find((a) => a.documento === documento);
    porDocumento[documento] = {
      estado: estadoDelDocumento(documento, lista),
      version: ultima?.version ?? null,
      aceptadoEn: ultima?.aceptadoEn ?? null,
    };
  }
  return {
    ...porDocumento,
    alDia: DOCUMENTOS_LEGALES.every((d) => porDocumento[d].estado === 'al-dia'),
  };
}
