import { toast } from 'sonner';

import { uploadCaseDocument } from '@/features/document/actions';
import { errorDeTamanoDeArchivo } from '@/lib/limite-archivos';

export interface FalloDeSubida {
  fileName: string;
  motivo: string;
}

export interface ResultadoDeSubida {
  subidos: number;
  fallos: FalloDeSubida[];
}

const TIPO_POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/**
 * Algunos sistemas no declaran el tipo de un archivo. La pestaña de documentos
 * lo acepta por su extensión; el servidor exige el tipo, y sin él el navegador
 * lo enviaría como `application/octet-stream`.
 */
function conTipoDeclarado(file: File): File {
  if (file.type) return file;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const tipo = TIPO_POR_EXTENSION[extension];
  return tipo ? new File([file], file.name, { type: tipo }) : file;
}

/**
 * Sube los documentos elegidos, un archivo por llamada y de a uno.
 *
 * Por llamada, porque el cuerpo de una server action tiene tope y así el total
 * del caso no lo tiene. De a uno, porque cada llamada busca o crea la carpeta de
 * adjuntos en Drive, y dos a la vez podrían duplicarla.
 *
 * Nunca rechaza: un archivo que falla queda en `fallos` y se sigue con el
 * siguiente. El rechazo de la promesa es lo que llega ante un corte de red o de
 * cuerpo, antes de que la acción corra.
 */
export async function subirDocumentosDelCaso(
  caseId: string,
  seleccion: ReadonlyArray<{ docName: string; files: File[] }>,
): Promise<ResultadoDeSubida> {
  const resultado: ResultadoDeSubida = { subidos: 0, fallos: [] };

  for (const { docName, files } of seleccion) {
    for (const file of files) {
      const errorDeTamano = errorDeTamanoDeArchivo(file.size);
      if (errorDeTamano) {
        resultado.fallos.push({ fileName: file.name, motivo: errorDeTamano });
        continue;
      }

      try {
        const respuesta = await uploadCaseDocument({
          caseId,
          docName,
          file: conTipoDeclarado(file),
        });
        if (respuesta.success) {
          resultado.subidos++;
        } else {
          resultado.fallos.push({
            fileName: file.name,
            motivo: respuesta.error ?? 'Error desconocido',
          });
        }
      } catch {
        resultado.fallos.push({
          fileName: file.name,
          motivo:
            'No se pudo enviar el archivo. Revisa tu conexión e inténtalo de nuevo.',
        });
      }
    }
  }

  return resultado;
}

/**
 * El aviso al terminar. Con fallos no se cierra solo: el caso ya quedó guardado
 * y el diálogo se cerró, así que este es el único lugar donde se ve qué archivo
 * falta volver a adjuntar.
 */
export function avisarResultadoDeSubida(
  accion: 'Caso creado' | 'Caso actualizado',
  { subidos, fallos }: ResultadoDeSubida,
) {
  if (fallos.length === 0) {
    toast.success(`${accion} y ${subidos} documento(s) subido(s) exitosamente`);
    return;
  }

  toast.warning(
    `${accion}, pero ${fallos.length} de ${subidos + fallos.length} documentos no se subieron`,
    {
      duration: Infinity,
      description: (
        <>
          <ul className="my-1 list-disc pl-4">
            {fallos.map(({ fileName, motivo }, i) => (
              <li key={`${fileName}-${i}`}>
                {fileName}: {motivo}
              </li>
            ))}
          </ul>
          <p>Puedes adjuntarlos otra vez desde Editar caso, en Documentos.</p>
        </>
      ),
    },
  );
}
