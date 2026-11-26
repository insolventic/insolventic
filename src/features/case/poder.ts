/**
 * El Poder del apoderado, en dos piezas que se suben por separado.
 *
 * Antes era un único anexo, "Poder (notariado o prueba de envío desde correo
 * del deudor)" (id `poder`). Ahora el operador carga dos archivos, cada uno con
 * su zona de carga y su estado:
 *   - la captura de pantalla del correo enviado al centro de conciliación;
 *   - el poder firmado, con los requisitos notariales.
 *
 * Reglas (aprobadas el 2026-11-26):
 *   - "Completo" = las dos piezas cargadas. Es solo un indicador.
 *   - Para CREAR el caso basta con una pieza, igual que antes bastaba el anexo
 *     único: no se endurece el requisito sin validación del abogado.
 *   - Un anexo `poder` ya subido con el nombre anterior cuenta como "poder
 *     firmado" y sigue visible; no se migra ni se renombra ningún archivo.
 *   - El Check List (`SI_DOC_PODER`) sigue manual: su automatización espera la
 *     validación del abogado.
 *
 * Este archivo no lleva `'use server'`: lo importan componentes cliente.
 */

/** Id del requisito de grupo (CONDITIONAL_DOCUMENTS) y nombre del anexo único anterior. */
export const ID_PODER = 'poder';
export const NOMBRE_PODER_ANEXO_UNICO =
  'Poder (notariado o prueba de envío desde correo del deudor)';

export const ID_PODER_CAPTURA_CORREO = 'poder_captura_correo';
export const ID_PODER_FIRMADO = 'poder_firmado';

export interface PiezaPoder {
  readonly id: typeof ID_PODER_CAPTURA_CORREO | typeof ID_PODER_FIRMADO;
  /** Nombre del documento: es también el `Document.name` con que se guarda. */
  readonly nombre: string;
  /** Texto de ayuda bajo la zona de carga. */
  readonly ayuda: string;
}

/**
 * Los textos de ayuda son neutros a propósito. Los marcados
 * [VALIDAR CON ABOGADO] esperan la redacción del abogado: no se inventan
 * requisitos legales.
 */
export const PIEZAS_PODER: readonly PiezaPoder[] = [
  {
    id: ID_PODER_CAPTURA_CORREO,
    nombre: 'Poder: captura del correo enviado al centro de conciliación',
    ayuda:
      'Captura de pantalla del correo con el que se envió el poder al centro de conciliación, donde se vean el remitente, el destinatario y la fecha. [VALIDAR CON ABOGADO]',
  },
  {
    id: ID_PODER_FIRMADO,
    nombre: 'Poder firmado con requisitos notariales',
    ayuda:
      'Documento del poder firmado. [VALIDAR CON ABOGADO: requisitos notariales que debe cumplir]',
  },
] as const;

export function esPiezaPoder(id: string): boolean {
  return PIEZAS_PODER.some((p) => p.id === id);
}

/**
 * ¿Los anexos elegidos (por clave) cumplen el requisito "poder" para crear el
 * caso? Basta una pieza, o el anexo único anterior.
 */
export function cumpleRequisitoPoder(
  clavesCargadas: readonly string[],
): boolean {
  return (
    clavesCargadas.includes(ID_PODER) ||
    PIEZAS_PODER.some((p) => clavesCargadas.includes(p.id))
  );
}

export interface DocumentoDelCaso {
  name: string;
  url?: string | null;
}

export interface EstadoPoder<D extends DocumentoDelCaso = DocumentoDelCaso> {
  capturaCorreo: D[];
  firmado: D[];
  /** Anexos subidos con el nombre del anexo único anterior (cuentan como firmado). */
  firmadoAnterior: D[];
  tieneCaptura: boolean;
  tieneFirmado: boolean;
  completo: boolean;
}

/** Estado del Poder a partir de los documentos ya subidos al caso (por nombre). */
export function estadoDelPoder<D extends DocumentoDelCaso>(
  documentos: readonly D[],
): EstadoPoder<D> {
  const [captura, firmado] = PIEZAS_PODER;
  const capturaCorreo = documentos.filter((d) => d.name === captura.nombre);
  const firmadoNuevo = documentos.filter((d) => d.name === firmado.nombre);
  const firmadoAnterior = documentos.filter(
    (d) => d.name === NOMBRE_PODER_ANEXO_UNICO,
  );
  const tieneCaptura = capturaCorreo.length > 0;
  const tieneFirmado = firmadoNuevo.length + firmadoAnterior.length > 0;
  return {
    capturaCorreo,
    firmado: firmadoNuevo,
    firmadoAnterior,
    tieneCaptura,
    tieneFirmado,
    completo: tieneCaptura && tieneFirmado,
  };
}
