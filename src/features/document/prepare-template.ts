/**
 * Fase 1 de la generación de documentos, compartida por las dos rutas.
 *
 * Había dos implementaciones del mismo trabajo, en archivos distintos:
 *
 *   - la automática, `generateFromTemplates` → `prepareDocument`
 *     (creación del caso, admisión, acuerdo, fracaso);
 *   - la manual de `/documents`, `batchGenerateDocuments`, con su propio
 *     ciclo de 3 fases.
 *
 * No era duplicación accidental: las Fases 2 y 3 difieren por razones
 * legítimas (la manual produce DOCX además de PDF, sube con otro método y
 * persiste fila por fila en vez de en lote). Pero la Fase 1 —leer la
 * plantilla, aplicar el overlay de la variante, renderizar y medir cobertura—
 * es idéntica, y estaba escrita dos veces. Se notó al agregar el oficio por
 * juzgado: el mismo cambio hubo que hacerlo en los dos lugares, incluido el
 * string del nombre a mostrar.
 *
 * Lo que este módulo NO comparte, a propósito: **la política de validación**.
 * La ruta automática corta por `validateDocumentRequirements` y por el gate de
 * placeholders sin resolver; la manual corta por `collectMissingData`. Son
 * criterios distintos, cada uno con su mensaje y su estado de salida, y
 * unificarlos sería cambiar el comportamiento de las dos rutas en un refactor
 * que no debería cambiar nada. Cada llamador conserva el suyo y recibe de acá
 * lo que necesita para aplicarlo (`unresolved`, `placeholders`, `htmlContent`).
 *
 * Es un archivo sin `'use server'`, como `persistence.ts` o
 * `generation-request.ts`: lo importan una server action y un módulo normal.
 */

import path from 'path';
import { promises as fs } from 'fs';

import { logger } from '@/lib/logger';

import {
  renderDocumentHtml,
  validatePlaceholderCoverage,
} from './placeholder-mapper';
import { getTemplatePath, type DocumentTemplate } from './templates-config';
import type { TemplateVariant } from './template-variants';

/**
 * La variante vacía: una plantilla que produce un solo documento.
 *
 * La usan las rutas que no manejan variantes (regenerar un documento suelto),
 * para no tener que escribir el literal en cada llamada.
 */
export const SIN_VARIANTE: TemplateVariant = {
  suffix: '',
  label: '',
  overlay: {},
};

/** Lo que la Fase 1 deja listo para la Fase 2. */
export interface PreparedTemplate {
  /** La plantilla sin rellenar, que `collectMissingData` necesita. */
  htmlContent: string;
  /** La plantilla ya rellenada. */
  html: string;
  /** Placeholders del caso con el overlay de la variante ya aplicado. */
  placeholders: Record<string, string>;
  /** Claves que la plantilla referencia y el mapper no produjo. */
  unresolved: string[];
  coveragePercentage: number;
  /** Claves que la plantilla usa y el mapper no produjo. */
  missing: string[];
  /** Claves que el mapper produjo, pero vacías. */
  empty: string[];
}

/**
 * Nombre con el que mostrar un documento cuando su plantilla produjo varios.
 *
 * Único lugar donde se arma. Antes se construía en las dos rutas por separado,
 * así que el formato podía divergir sin que nada avisara.
 */
export function variantDisplayName(
  template: DocumentTemplate,
  variant: TemplateVariant,
): string {
  return variant.label ? `${template.name} — ${variant.label}` : template.name;
}

/**
 * Lee la plantilla del disco.
 *
 * Las dos rutas resolvían la misma ruta de la misma forma
 * (`path.join(process.cwd(), getTemplatePath(template))`), una con un helper
 * privado y la otra a mano.
 */
export async function readTemplateFile(
  template: DocumentTemplate,
): Promise<string> {
  const templatePath = getTemplatePath(template);
  try {
    return await fs.readFile(path.join(process.cwd(), templatePath), 'utf-8');
  } catch (error) {
    logger.error('Error reading template', error, {
      action: 'prepare-template',
      templatePath,
    });
    throw new Error(`No se pudo leer la plantilla: ${templatePath}`);
  }
}

/**
 * Fase 1: leer, aplicar el overlay de la variante, renderizar y medir.
 *
 * No valida ni decide si el documento sigue adelante: eso es política de cada
 * ruta. Tampoco atrapa el error de lectura — el llamador ya tiene su propio
 * manejo, con su propio formato de resultado.
 *
 * El overlay se aplica ANTES de medir cobertura y de renderizar, para que las
 * dos cosas vean exactamente el mismo contexto que el documento final. Es lo
 * que hace que el oficio N vaya dirigido al juzgado N y no siempre al primero.
 */
export async function prepareTemplate(
  template: DocumentTemplate,
  placeholders: Record<string, string>,
  extraContext: Record<string, unknown> | undefined,
  variant: TemplateVariant,
): Promise<PreparedTemplate> {
  const htmlContent = await readTemplateFile(template);

  const variantPlaceholders =
    Object.keys(variant.overlay).length > 0
      ? { ...placeholders, ...variant.overlay }
      : placeholders;

  const coverage = validatePlaceholderCoverage(
    htmlContent,
    variantPlaceholders,
  );
  const { html, unresolved } = renderDocumentHtml(
    htmlContent,
    variantPlaceholders,
    extraContext,
  );

  return {
    htmlContent,
    html,
    placeholders: variantPlaceholders,
    unresolved,
    coveragePercentage: coverage.coveragePercentage,
    missing: coverage.missing,
    empty: coverage.empty,
  };
}
