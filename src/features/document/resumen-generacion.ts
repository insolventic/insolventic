/**
 * Cómo se le cuenta al usuario el resultado de una generación de documentos.
 *
 * Las dos pantallas que generan (Gestión de Casos y /documents) decían
 * "generados" a cosas que no se generaron: el aviso de Gestión de Casos
 * contaba `documents.length`, fallidos incluidos, y /documents titulaba
 * "Generación Completada" con 0 de 8. Este módulo es el único lugar donde se
 * decide qué es un éxito, un fallo y un omitido, y con qué palabras se dice.
 *
 * Archivo sin `'use server'` y sin dependencias de servidor: lo importan
 * componentes cliente.
 */

/** Lo mínimo de un resultado por documento que comparten las dos rutas. */
export interface ResultadoDeDocumento {
  status: 'success' | 'error' | 'skipped';
  error?: string;
  templateName: string;
  displayName?: string;
}

export interface ConteoDeGeneracion {
  total: number;
  generados: number;
  fallidos: number;
  /** Bloqueados por datos incompletos: no son fallos técnicos. */
  omitidos: number;
}

/**
 * - `completa`: todo lo pedido se generó.
 * - `parcial`: se generó algo, y algo falló o quedó omitido.
 * - `fallida`: no se generó nada.
 */
export type EstadoDeGeneracion = 'completa' | 'parcial' | 'fallida';

export interface ResumenDeGeneracion extends ConteoDeGeneracion {
  estado: EstadoDeGeneracion;
  /** Los que no se generaron, con su motivo, en el orden en que llegaron. */
  problemas: Array<{ nombre: string; motivo: string; omitido: boolean }>;
}

export function estadoDeGeneracion(
  conteo: ConteoDeGeneracion,
): EstadoDeGeneracion {
  if (conteo.generados === 0) return 'fallida';
  if (conteo.generados < conteo.total) return 'parcial';
  return 'completa';
}

export function resumirGeneracion(
  documentos: ReadonlyArray<ResultadoDeDocumento>,
): ResumenDeGeneracion {
  const conteo: ConteoDeGeneracion = {
    total: documentos.length,
    generados: documentos.filter((d) => d.status === 'success').length,
    fallidos: documentos.filter((d) => d.status === 'error').length,
    omitidos: documentos.filter((d) => d.status === 'skipped').length,
  };
  return {
    ...conteo,
    estado: estadoDeGeneracion(conteo),
    problemas: documentos
      .filter((d) => d.status !== 'success')
      .map((d) => ({
        nombre: d.displayName ?? d.templateName,
        motivo:
          d.error ??
          (d.status === 'skipped' ? 'Faltan datos del expediente' : 'Error'),
        omitido: d.status === 'skipped',
      })),
  };
}

/**
 * Título del resultado: nunca "Completada" si no se generó todo. Va en el
 * mismo estilo de los encabezados de /documents ("Generación de Documentos").
 */
export function tituloDeGeneracion(estado: EstadoDeGeneracion): string {
  switch (estado) {
    case 'completa':
      return 'Generación Completada';
    case 'parcial':
      return 'Generación Incompleta';
    case 'fallida':
      return 'Ningún Documento Generado';
  }
}

export interface AvisoDeGeneracion {
  tipo: 'success' | 'warning' | 'error';
  titulo: string;
  descripcion?: string;
}

/** Cuántos problemas se nombran en el aviso antes de resumir el resto. */
const MAX_PROBLEMAS_EN_AVISO = 3;

/**
 * El aviso (toast) que sigue a una generación.
 *
 * `etapa` completa la frase: "documentos iniciales", "documentos de
 * admisión"… La descripción nombra los primeros documentos que no se
 * generaron y por qué, para que el operador no tenga que ir a los logs.
 */
export function avisoDeGeneracion(
  resumen: ResumenDeGeneracion,
  etapa: string,
): AvisoDeGeneracion {
  const { estado, generados, total, fallidos, omitidos, problemas } = resumen;

  if (total === 0) {
    return {
      tipo: 'warning',
      titulo: `No había ${etapa} para generar`,
    };
  }

  const titulo =
    estado === 'completa'
      ? `Se generaron ${generados} ${etapa}`
      : estado === 'parcial'
        ? `Se generaron ${generados} de ${total} ${etapa}`
        : `No se generó ningún documento (${total} ${etapa})`;

  if (problemas.length === 0) {
    return { tipo: 'success', titulo };
  }

  const cuenta = [
    fallidos > 0 ? `${fallidos} con error` : '',
    omitidos > 0 ? `${omitidos} por datos incompletos` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const detalle = problemas
    .slice(0, MAX_PROBLEMAS_EN_AVISO)
    .map((p) => `• ${p.nombre}: ${p.motivo}`)
    .join('\n');
  const resto =
    problemas.length > MAX_PROBLEMAS_EN_AVISO
      ? `\n…y ${problemas.length - MAX_PROBLEMAS_EN_AVISO} más.`
      : '';

  return {
    tipo: estado === 'fallida' ? 'error' : 'warning',
    titulo,
    descripcion: `No generados: ${cuenta}.\n${detalle}${resto}`,
  };
}
