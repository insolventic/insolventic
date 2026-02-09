import { google } from 'googleapis';
import { Readable } from 'stream';

class GoogleDriveService {
  private drive;
  private auth;

  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
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
      console.error('Error subiendo archivo a Google Drive:', error);
      throw new Error('Error al subir archivo a Google Drive');
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
      console.error('Error descargando archivo de Google Drive:', error);
      throw new Error('Error al descargar archivo de Google Drive');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId,
      });
    } catch (error) {
      console.error('Error eliminando archivo de Google Drive:', error);
      throw new Error('Error al eliminar archivo de Google Drive');
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
      console.error('Error obteniendo información del archivo:', error);
      throw new Error('Error al obtener información del archivo');
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
      console.error('Error creando carpeta en Google Drive:', error);
      throw new Error('Error al crear carpeta en Google Drive');
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
      console.error('Error actualizando archivo en Google Drive:', error);
      throw new Error('Error al actualizar archivo en Google Drive');
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
      console.error(
        'Error listando carpetas y archivos de Google Drive:',
        error,
      );
      throw new Error('Error al listar contenido de Google Drive');
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
        console.error(`Error processing folder ${folderId}:`, error);
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
      console.error('Error obteniendo ruta de carpeta:', error);
      return [];
    }
  }

  async findOrCreateCaseFolder(
    caseNumber: string,
    casesFolderId: string,
  ): Promise<string> {
    try {
      const existingFolders = await this.drive.files.list({
        q: `'${casesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${caseNumber}' and trashed=false`,
        fields: 'files(id,name)',
      });

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        return existingFolders.data.files[0].id!;
      }

      return await this.createFolder(caseNumber, casesFolderId);
    } catch (error) {
      console.error('Error finding or creating case folder:', error);
      throw new Error('Error al crear carpeta del caso');
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
          q: `'${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
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
      console.error('Error creating folder hierarchy:', error);
      throw new Error('Error al crear jerarquía de carpetas');
    }
  }

  async uploadDocumentToCase(
    fileName: string,
    fileBuffer: Buffer,
    caseFolderId: string,
  ): Promise<{ fileId: string; fileUrl: string }> {
    try {
      const fileId = await this.uploadFile(
        fileName,
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        caseFolderId,
      );

      const fileUrl = this.getFileUrl(fileId);

      return { fileId, fileUrl };
    } catch (error) {
      console.error('Error uploading document to case folder:', error);
      throw new Error('Error al subir documento al caso');
    }
  }

  getFolderUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }
}

export const googleDriveService = new GoogleDriveService();
