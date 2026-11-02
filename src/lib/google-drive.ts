import { google } from 'googleapis';
import { Readable } from 'stream';

import { logger } from '@/lib/logger';
import { isRetryableDriveError, statusDeDrive } from '@/lib/drive-errors';

/**
 * Sanitizes a value for use in Google Drive API query strings.
 * Escapes backslashes and single quotes to prevent query injection.
 */
function sanitizeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Envuelve un error de Drive **sin perder la causa**.
 *
 * Los 13 `catch` de este archivo hacían
 * `console.error(...); throw new Error('Error al …')`: el `Error` nuevo no
 * llevaba `cause`, así que a Sentry y al operador les llegaba el mismo texto
 * para un token expirado, una cuota agotada, un 429 y una carpeta borrada a
 * mano — cuatro incidentes con cuatro procedimientos distintos en
 * `docs/RUNBOOK.md` §3.4, que pide diagnosticar justo lo que el código acababa
 * de borrar (hallazgo R-1 de `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * El mensaje de cara al usuario no cambia: lo que se agrega es la causa, el
 * status y el contexto para el log.
 */
function errorDeDrive(
  mensaje: string,
  error: unknown,
  contexto: { action: string } & Record<string, unknown>,
): Error {
  const status = statusDeDrive(error);
  logger.error(mensaje, error, {
    ...contexto,
    driveStatus: status,
    retryable: isRetryableDriveError(error),
  });
  return new Error(mensaje, { cause: error });
}

class GoogleDriveService {
  private drive;
  private auth;

  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      // GOOGLE_DRIVE_REDIRECT_URI es INERTE en runtime. google-auth-library solo
      // usa el redirect URI en generateAuthUrl() y getToken() (intercambio
      // código → tokens); la renovación con refresh_token —lo único que hace
      // esta app— envía client_id, client_secret y refresh_token, nunca el
      // redirect. Nada en el código llama a esos métodos, y la ruta de callback
      // del .env.example (/api/auth/google/callback) no existe.
      // El refresh token se emite FUERA de la app con OAuth Playground, que usa
      // su propio redirect fijo (https://developers.google.com/oauthplayground)
      // y no lee esta variable.
      // Se conserva porque es parte de la firma del cliente OAuth2, está
      // documentada en .env.example y sería necesaria —debe coincidir con un
      // "Authorized redirect URI" del cliente en Google Cloud— si algún día se
      // implementa el consentimiento dentro de la app. Dejarla sin definir hoy
      // es inocuo; antes de borrarla, revisar esos dos puntos.
      process.env.GOOGLE_DRIVE_REDIRECT_URI,
    );

    this.auth.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
    folderId?: string,
  ): Promise<string> {
    try {
      if (!folderId) {
        throw new Error(
          `No se proporcionó un ID de carpeta válido para subir el archivo ${fileName}`,
        );
      }

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType,
        body: Readable.from(fileBuffer),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id',
      });

      if (!response.data.id) {
        throw new Error('No se pudo obtener el ID del archivo subido');
      }

      return response.data.id;
    } catch (error) {
      throw errorDeDrive('Error al subir archivo a Google Drive', error, {
        action: 'drive-upload',
        fileName,
        folderId,
      });
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const timestamp = Date.now();
      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
          acknowledgeAbuse: false,
        },
        {
          responseType: 'stream',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'If-None-Match': '*',
          },
          params: {
            _: timestamp,
          },
        },
      );

      if (!response.data) {
        throw new Error('No se pudo descargar el archivo');
      }

      const chunks: Buffer[] = [];
      const stream = response.data;

      return new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        stream.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error) {
      throw errorDeDrive('Error al descargar archivo de Google Drive', error, {
        action: 'drive-download',
        fileId,
      });
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId,
      });
    } catch (error) {
      throw errorDeDrive('Error al eliminar archivo de Google Drive', error, {
        action: 'drive-delete',
        fileId,
      });
    }
  }

  async getFileInfo(fileId: string) {
    try {
      const timestamp = Date.now();
      const response = await this.drive.files.get(
        {
          fileId,
          fields: 'id,name,mimeType,size,createdTime,modifiedTime',
        },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
            'If-None-Match': '*',
          },
          params: {
            _: timestamp,
          },
        },
      );

      return response.data;
    } catch (error) {
      throw errorDeDrive('Error al obtener información del archivo', error, {
        action: 'drive-get-file',
        fileId,
      });
    }
  }

  async createFolder(name: string, parentFolderId?: string): Promise<string> {
    try {
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId
          ? [parentFolderId]
          : [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });

      if (!response.data.id) {
        throw new Error('No se pudo crear la carpeta');
      }

      return response.data.id;
    } catch (error) {
      throw errorDeDrive('Error al crear carpeta en Google Drive', error, {
        action: 'drive-create-folder',
        folderName: name,
        parentFolderId,
      });
    }
  }

  async updateFile(
    fileId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    try {
      const fileMetadata = {
        name: fileName,
      };

      const media = {
        mimeType,
        body: Readable.from(fileBuffer),
      };

      await this.drive.files.update({
        fileId,
        requestBody: fileMetadata,
        media,
      });
    } catch (error) {
      throw errorDeDrive('Error al actualizar archivo en Google Drive', error, {
        action: 'drive-update-file',
        fileId,
      });
    }
  }

  /**
   * Move a file/folder to a new parent. Optionally rename it.
   * Uses Drive's `addParents` / `removeParents` to swap parents atomically.
   */
  async moveFile(
    fileId: string,
    newParentId: string,
    newName?: string,
  ): Promise<void> {
    try {
      // Fetch current parents so we can detach them in the same call.
      const meta = await this.drive.files.get({
        fileId,
        fields: 'parents',
      });
      const previousParents = (meta.data.parents ?? []).join(',');

      await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents || undefined,
        requestBody: newName ? { name: newName } : undefined,
        fields: 'id, parents',
      });
    } catch (error) {
      throw errorDeDrive('Error al mover archivo en Google Drive', error, {
        action: 'drive-move-file',
        fileId,
      });
    }
  }

  getFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  async listFoldersAndFiles(parentFolderId?: string) {
    try {
      const folderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID!;

      const foldersResponse = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime)',
        orderBy: 'name',
      });

      const filesResponse = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents)',
        orderBy: 'name',
      });

      return {
        folders: foldersResponse.data.files || [],
        files: filesResponse.data.files || [],
      };
    } catch (error) {
      throw errorDeDrive('Error al listar contenido de Google Drive', error, {
        action: 'drive-list',
        folderId: parentFolderId,
      });
    }
  }

  async listAllFoldersAndFilesRecursively(parentFolderId?: string): Promise<{
    folders: Array<{
      id: string;
      name: string;
      path: string[];
      parentId: string;
      createdTime?: string;
      modifiedTime?: string;
    }>;
    files: Array<{
      id: string;
      name: string;
      mimeType?: string;
      size?: string;
      path: string[];
      parentId: string;
      createdTime?: string;
      modifiedTime?: string;
    }>;
  }> {
    const allFolders: Array<{
      id: string;
      name: string;
      path: string[];
      parentId: string;
      createdTime?: string;
      modifiedTime?: string;
    }> = [];
    const allFiles: Array<{
      id: string;
      name: string;
      mimeType?: string;
      size?: string;
      path: string[];
      parentId: string;
      createdTime?: string;
      modifiedTime?: string;
    }> = [];

    const processFolder = async (
      folderId: string,
      currentPath: string[] = [],
    ) => {
      try {
        const { folders, files } = await this.listFoldersAndFiles(folderId);

        for (const file of files) {
          if (file.id && file.name) {
            allFiles.push({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType || undefined,
              size: file.size || undefined,
              path: [...currentPath],
              parentId: folderId,
              createdTime: file.createdTime || undefined,
              modifiedTime: file.modifiedTime || undefined,
            });
          }
        }

        for (const folder of folders) {
          if (folder.id && folder.name) {
            const folderPath = [...currentPath, folder.name];
            allFolders.push({
              id: folder.id,
              name: folder.name,
              path: folderPath,
              parentId: folderId,
              createdTime: folder.createdTime || undefined,
              modifiedTime: folder.modifiedTime || undefined,
            });

            await processFolder(folder.id, folderPath);
          }
        }
      } catch (error) {
        // Se absorbe a propósito: un subarbol que falla no debe tirar el
        // listado entero. Pero el resultado queda INCOMPLETO, y eso la
        // sincronización lo interpreta como "esos archivos no existen", así
        // que tiene que verse en algún lado.
        logger.warn('No se pudo listar una carpeta de Drive; se omite', {
          action: 'drive-list-recursive',
          folderId,
          driveStatus: statusDeDrive(error),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const rootFolderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID!;
    await processFolder(rootFolderId);

    return {
      folders: allFolders,
      files: allFiles,
    };
  }

  async getFolderPath(folderId: string): Promise<string[]> {
    try {
      const path: string[] = [];
      let currentFolderId = folderId;
      const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

      while (currentFolderId && currentFolderId !== rootFolderId) {
        const response = await this.drive.files.get({
          fileId: currentFolderId,
          fields: 'name,parents',
        });

        if (response.data.name) {
          path.unshift(response.data.name);
        }

        if (response.data.parents && response.data.parents.length > 0) {
          currentFolderId = response.data.parents[0];
        } else {
          break;
        }
      }

      return path;
    } catch (error) {
      // Devuelve [] y el llamador lo lee como "sin ruta": conviene que el log
      // distinga eso de una carpeta que de verdad está en la raíz.
      logger.warn('No se pudo resolver la ruta de una carpeta de Drive', {
        action: 'drive-folder-path',
        folderId,
        driveStatus: statusDeDrive(error),
        reason: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async findOrCreateCaseFolder(
    caseNumber: string,
    casesFolderId: string,
  ): Promise<string> {
    try {
      const existingFolders = await this.drive.files.list({
        q: `'${sanitizeDriveQueryValue(casesFolderId)}' in parents and mimeType='application/vnd.google-apps.folder' and name='${sanitizeDriveQueryValue(caseNumber)}' and trashed=false`,
        fields: 'files(id,name)',
      });

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        return existingFolders.data.files[0].id!;
      }

      return await this.createFolder(caseNumber, casesFolderId);
    } catch (error) {
      throw errorDeDrive('Error al crear carpeta del caso', error, {
        action: 'drive-case-folder',
        caseNumber,
      });
    }
  }

  async createFolderHierarchy(
    folderPath: string[],
    parentFolderId: string,
  ): Promise<string> {
    try {
      let currentParentId = parentFolderId;

      for (const folderName of folderPath) {
        const existingFolders = await this.drive.files.list({
          q: `'${sanitizeDriveQueryValue(currentParentId)}' in parents and mimeType='application/vnd.google-apps.folder' and name='${sanitizeDriveQueryValue(folderName)}' and trashed=false`,
          fields: 'files(id,name)',
        });

        if (
          existingFolders.data.files &&
          existingFolders.data.files.length > 0
        ) {
          currentParentId = existingFolders.data.files[0].id!;
        } else {
          currentParentId = await this.createFolder(
            folderName,
            currentParentId,
          );
        }
      }

      return currentParentId;
    } catch (error) {
      throw errorDeDrive('Error al crear jerarquía de carpetas', error, {
        action: 'drive-folder-hierarchy',
        ruta: folderPath.join('/'),
      });
    }
  }

  async uploadDocumentToCase(
    fileName: string,
    fileBuffer: Buffer,
    caseFolderId: string,
  ): Promise<{ fileId: string; fileUrl: string }> {
    try {
      // Detect MIME type from file extension instead of hardcoding DOCX
      const ext = fileName.toLowerCase().split('.').pop();
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        html: 'text/html',
      };
      const mimeType = mimeTypes[ext || ''] || 'application/pdf';

      const fileId = await this.uploadFile(
        fileName,
        fileBuffer,
        mimeType,
        caseFolderId,
      );

      const fileUrl = this.getFileUrl(fileId);

      return { fileId, fileUrl };
    } catch (error) {
      throw errorDeDrive('Error al subir documento al caso', error, {
        action: 'drive-upload',
        fileName,
      });
    }
  }

  getFolderUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }
}

export const googleDriveService = new GoogleDriveService();
