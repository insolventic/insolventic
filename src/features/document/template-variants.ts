/**
 * Variantes de una plantilla: cuándo una plantilla produce MÁS de un documento.
 *
 * El pipeline era estrictamente "una plantilla = un documento". Eso no alcanza
 * para los oficios dirigidos a un tercero: `Suspension Juzgados Procesos
 * Judiciales.html` es un oficio a **un** juzgado, y un caso con procesos en tres
 * juzgados distintos necesita **tres** oficios, no uno.
 *
 * Antes de esto, el oficio se generaba una sola vez con los datos de
 * `legalProcesses[0]` (ver `mapExternalEntities`): con tres juzgados salía un
 * único documento dirigido al primero, y los otros dos procesos no se
 * suspendían porque nunca se les notificó.
 *
 * Una variante aporta dos cosas:
 *  - un `overlay` de placeholders, que pisa los del caso para ese documento;
 *  - un `suffix` para el nombre de archivo, que evita que N documentos de la
 *    misma plantilla se sobreescriban entre sí en Drive.
 *
 * Las plantillas que no declaran variantes devuelven una sola, sin overlay ni
 * sufijo: el comportamiento de siempre, byte por byte.
 */

import type { CaseWithRelations } from '@/features/case/schemas';
import { tipoProcesoLabel } from '@/features/case/proceso-judicial-tipos';
import type { DocumentTemplate } from './templates-config';

export interface TemplateVariant {
  /**
   * Sufijo del nombre de archivo. Vacío cuando la plantilla produce un solo
   * documento, que es el caso de todas menos las de esta lista.
   */
  suffix: string;
  /**
   * Nombre legible del ítem de esta variante —el juzgado, en el caso del
   * oficio— para distinguir las filas de `Document` en la UI. Las filas se
   * nombran con `templateName`, así que sin esto tres oficios de la misma
   * plantilla aparecen como tres «Suspension Juzgados» idénticos.
   * Vacío cuando la plantilla produce un solo documento.
   */
  label: string;
  /** Placeholders que esta variante pisa. Vacío = sin cambios. */
  overlay: Record<string, string>;
}

/** La variante única de una plantilla normal. */
const SIN_VARIANTES: readonly TemplateVariant[] = [
  { suffix: '', label: '', overlay: {} },
];

/**
 * Normaliza un nombre para usarlo en un nombre de archivo de Drive.
 *
 * Los nombres de juzgado traen puntos, comas y barras («Juzgado 3 Civil
 * Municipal - Sec. 2»), y la barra rompe la ruta. Se deja solo lo alfanumérico
 * y guiones bajos, sin tildes, y se recorta: el nombre completo ya lleva el
 * número de caso y el de la plantilla.
 */
function slugForFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Un oficio por juzgado distinto del caso.
 *
 * Se agrupa por **nombre de juzgado**, no por proceso: dos procesos en el mismo
 * juzgado se notifican con un solo oficio. Para los campos que son por proceso
 * —demandante, tipo de proceso— se usa el primer proceso de ese juzgado.
 *
 * LIMITACIÓN CONOCIDA: si un juzgado tiene dos procesos, el oficio nombra el
 * demandante y el tipo del primero. Es estrictamente mejor que antes —que
 * nombraba los del primer juzgado en el único oficio que salía— pero listar
 * varios procesos en un mismo oficio requiere tocar la plantilla, que hoy tiene
 * un solo juego de placeholders. Queda anotado en el PR.
 */
function variantesPorJuzgado(caseData: CaseWithRelations): TemplateVariant[] {
  const procesos = caseData.legalProcesses ?? [];

  // Primer proceso de cada juzgado, en el orden en que aparecen. Los procesos
  // sin juzgado no producen oficio: no hay a quién dirigirlo.
  const porJuzgado = new Map<string, (typeof procesos)[number]>();
  for (const proceso of procesos) {
    const juzgado = (proceso.court ?? '').trim();
    if (!juzgado) continue;
    if (!porJuzgado.has(juzgado)) porJuzgado.set(juzgado, proceso);
  }

  // Sin juzgados no se fuerza el caso a cero documentos: se devuelve la
  // variante única y el documento sale como antes, con los placeholders
  // vacíos que ya producía el mapper. Cambiar eso sería cambiar qué
  // documentos existen para un caso sin procesos, que es otra decisión.
  if (porJuzgado.size === 0) return [...SIN_VARIANTES];

  const varios = porJuzgado.size > 1;

  return [...porJuzgado.entries()].map(([juzgado, proceso], index) => ({
    // Con un solo juzgado el nombre de archivo no cambia: así un caso de un
    // juzgado sigue produciendo exactamente el archivo de antes.
    suffix: varios ? `_${index + 1}_${slugForFileName(juzgado)}` : '',
    // El label sí se pone siempre, incluso con un solo juzgado: la fila de
    // `Document` gana precisión sin que cambie ningún nombre de archivo.
    label: juzgado,
    overlay: {
      NOMBRE_JUZGADO: juzgado,
      NOMBRE_DEMANDANTE: proceso.plaintiff ?? '',
      // La etiqueta, no el valor guardado: el oficio lo lee un juzgado y
      // «RESTITUCION_INMUEBLE» o «OTROS» no son texto legible.
      TIPO_PROCESO: tipoProcesoLabel(
        proceso.processType,
        proceso.processTypeOther,
      ),
    },
  }));
}

/** Plantillas que producen un documento por ítem, por id. */
const POR_PLANTILLA: Record<
  string,
  (caseData: CaseWithRelations) => TemplateVariant[]
> = {
  'suspension-juzgados': variantesPorJuzgado,
};

/**
 * Las variantes de esta plantilla para este caso. Nunca devuelve una lista
 * vacía: una plantilla sin variantes declaradas produce su documento único.
 */
export function templateVariants(
  template: DocumentTemplate,
  caseData: CaseWithRelations,
): TemplateVariant[] {
  const fn = POR_PLANTILLA[template.id];
  if (!fn) return [...SIN_VARIANTES];
  const variantes = fn(caseData);
  return variantes.length > 0 ? variantes : [...SIN_VARIANTES];
}

/**
 * Clave única de un trabajo de generación.
 *
 * El lote de la Fase 2 indexa los buffers de PDF por esta clave. Antes usaba
 * `template.id`, que con variantes colisiona: dos oficios de la misma plantilla
 * habrían compartido entrada y el segundo habría subido el PDF del primero.
 */
export function jobKey(
  template: DocumentTemplate,
  variant: TemplateVariant,
): string {
  return `${template.id}${variant.suffix}`;
}
