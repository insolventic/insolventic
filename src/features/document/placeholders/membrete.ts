/**
 * Membrete por centro: sub-mapper de los datos de identidad del centro.
 *
 * Reemplaza las ~400 ocurrencias de nombre, entidad promotora, dirección,
 * teléfono, web, correo, resoluciones de habilitación y operadora que estaban
 * escritas a mano en las 65 plantillas. Los datos y el porqué del fail-closed
 * están en `src/lib/membrete-centro.ts`; el inventario y el plan, en
 * `docs/BRANDING_POR_CENTRO_2026-09-30.md` y
 * `docs/PENDIENTES_DECISION_LEGAL.md` §5.
 *
 * DIFERENCIA DELIBERADA CON `branding.ts`
 * =======================================
 * `mapBrandingAssets` tiene fallback: un tenant sin carpeta propia usa los
 * assets de Constructores, porque una imagen equivocada es un problema
 * estético. Acá **no hay fallback**. Estas cadenas afirman ante un juzgado que
 * un centro está habilitado por una resolución concreta del Ministerio de
 * Justicia; emitir las de Constructores en un documento de Armonía sería
 * afirmar algo falso sobre una habilitación.
 *
 * Si al centro le falta un dato, este sub-mapper **no emite ninguna clave**.
 * Las plantillas quedan con sus `{{...}}` sin resolver, y el gate de
 * `generate-documents.ts` corta la generación devolviendo al operador la lista
 * de campos que faltan — en vez de subir a Drive un PDF con el centro
 * equivocado.
 *
 * Los valores son texto plano sin caracteres especiales de HTML, así que el
 * escapado por defecto (`escapeAllUnlessHtml`) los deja intactos: NO hay que
 * agregarlos a `HTML_PLACEHOLDERS_ALLOWLIST`.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import { membreteDelCentro, type MembreteCentro } from '@/lib/membrete-centro';

import { tenantSlugDelCaso } from './tenant-slug';

/**
 * Qué placeholder emite cada campo del membrete.
 *
 * Las parejas `_MAYUS` / `_MINUS` / `_CORTA` existen porque las plantillas
 * imprimen el mismo dato con distinta capitalización o formato, y la
 * extracción es **1:1**: el golden master exige que el HTML renderizado de
 * Constructores no cambie ni un byte, así que no se normaliza nada.
 */
const CLAVE_POR_CAMPO: Record<keyof MembreteCentro, string> = {
  nombre: 'CENTRO_NOMBRE',
  nombreMayus: 'CENTRO_NOMBRE_MAYUS',
  rotulo: 'CENTRO_ROTULO',
  rotuloCorto: 'CENTRO_ROTULO_CORTO',
  rotuloMayus: 'CENTRO_ROTULO_MAYUS',
  rotuloErrata: 'CENTRO_ROTULO_ERRATA',
  entidadPromotora: 'CENTRO_ENTIDAD_PROMOTORA',
  direccion: 'CENTRO_DIRECCION',
  direccionMinus: 'CENTRO_DIRECCION_MINUS',
  ciudad: 'CENTRO_CIUDAD',
  edificio: 'CENTRO_EDIFICIO',
  telefono: 'CENTRO_TELEFONO',
  telefonoCompacto: 'CENTRO_TELEFONO_COMPACTO',
  web: 'CENTRO_WEB',
  email: 'CENTRO_EMAIL',
  resolucionCentroNumero: 'CENTRO_RESOLUCION_NUMERO',
  resolucionCentroFecha: 'CENTRO_RESOLUCION_FECHA',
  resolucionCentroFechaCorta: 'CENTRO_RESOLUCION_FECHA_CORTA',
  resolucionCentroEncabezado: 'CENTRO_RESOLUCION_ENCABEZADO',
  resolucionInsolvenciaNumero: 'CENTRO_RES_INSOLVENCIA_NUMERO',
  resolucionInsolvenciaFecha: 'CENTRO_RES_INSOLVENCIA_FECHA',
  resolucionInsolvenciaAnio: 'CENTRO_RES_INSOLVENCIA_ANIO',
  resolucionInsolvenciaNumeroCorto: 'CENTRO_RES_INSOLVENCIA_NUMERO_CORTO',
  operadorNombre: 'OPERADOR_NOMBRE',
  operadorNombreTilde: 'OPERADOR_NOMBRE_TILDE',
  operadorCargo: 'OPERADOR_CARGO',
  operadorCargoMayus: 'OPERADOR_CARGO_MAYUS',
};

/** Las claves que este sub-mapper emite cuando el centro está completo. */
export const CLAVES_MEMBRETE = Object.values(CLAVE_POR_CAMPO);

/**
 * El centro se identifica por su **slug**, no por `Case.tenantId`.
 *
 * `Case.tenantId` guarda el `Tenant.id`, que es un cuid: el JWT lleva el slug,
 * `authenticateUser()` resuelve el tenant por slug y devuelve `tenant.id`, y
 * eso es lo que `createCase` persiste. Verificado contra la base de producción
 * el 2026-10-09: los `Tenant.id` son cuids (`cmluzsnr…`) y no coinciden con el
 * slug. El recorrido completo está en `tenant-slug.ts`.
 *
 * Acá importa más que en el branding: con un cuid, `membreteDelCentro` no
 * encuentra la fila y, por el fail-closed, **no se generaría ningún documento
 * para ningún centro**. El branding solo caía a un default silencioso; esto
 * sería un apagón.
 */
export function mapMembreteCentro(caseData: CaseWithRelations): PlaceholderMap {
  const membrete = membreteDelCentro(tenantSlugDelCaso(caseData));

  // Centro incompleto o desconocido: no se emite NADA. El gate de placeholders
  // sin resolver corta la generación y nombra los campos que faltan. Ver el
  // docblock del módulo: es la diferencia a propósito con los assets.
  if (!membrete) return {};

  const out: PlaceholderMap = {};
  for (const [campo, clave] of Object.entries(CLAVE_POR_CAMPO)) {
    out[clave] = membrete[campo as keyof MembreteCentro];
  }
  return out;
}
