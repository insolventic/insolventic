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
 * Si al centro le falta un dato, este sub-mapper **no emite esa clave**. Las
 * plantillas que la usan quedan con su `{{...}}` sin resolver, y el gate de
 * `generate-documents.ts` corta la generación de ESOS documentos devolviendo al
 * operador la lista de campos que faltan — en vez de subir a Drive un PDF con
 * el centro equivocado. Las plantillas que no usan el dato ausente se generan
 * normalmente: el corte es por campo, no por centro (el porqué, en
 * `membrete-centro.ts`).
 *
 * Un tenant **desconocido** sí es todo-o-nada: no hay fila de la que emitir.
 *
 * Los valores son texto plano sin caracteres especiales de HTML, así que el
 * escapado por defecto (`escapeAllUnlessHtml`) los deja intactos: NO hay que
 * agregarlos a `HTML_PLACEHOLDERS_ALLOWLIST`.
 */

import type { PlaceholderMap } from '../placeholder-mapper';
import type { CaseWithRelations } from '../../case/schemas';
import {
  membreteParcialDelCentro,
  type MembreteCentro,
} from '@/lib/membrete-centro';

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
  rotuloMayusTilde: 'CENTRO_ROTULO_MAYUS_TILDE',
  rotuloErrata: 'CENTRO_ROTULO_ERRATA',
  entidadPromotora: 'CENTRO_ENTIDAD_PROMOTORA',
  entidadPromotoraProsa: 'CENTRO_ENTIDAD_PROMOTORA_PROSA',
  entidadPromotoraMayus: 'CENTRO_ENTIDAD_PROMOTORA_MAYUS',
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
  cuentaConsignacion: 'CENTRO_CUENTA_CONSIGNACION',
};

/** Todas las claves que este sub-mapper puede emitir, una por campo. */
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
 * Acá importa más que en el branding: con un cuid no se encuentra la fila y,
 * por el fail-closed, **no se generaría ningún documento para ningún centro**.
 * El branding solo caía a un default silencioso; esto sería un apagón.
 */
export function mapMembreteCentro(caseData: CaseWithRelations): PlaceholderMap {
  const membrete = membreteParcialDelCentro(tenantSlugDelCaso(caseData));

  // Centro desconocido: no se emite NADA. Ver el docblock del módulo — es la
  // diferencia a propósito con los assets de imagen.
  if (!membrete) return {};

  // CAMPO POR CAMPO, no todo-o-nada. Un campo que falta (`null`) no se emite:
  // la plantilla que lo usa queda con su `{{...}}` sin resolver y el gate corta
  // ESE documento, no los 65. Un campo intencionalmente vacío (`SIN_DATO`) sí
  // se emite, como cadena vacía, y las plantillas lo envuelven en `{{#if}}`
  // para no dejar el separador colgando. El porqué del cambio de radio está en
  // el docblock de `membrete-centro.ts`.
  const out: PlaceholderMap = {};
  for (const [campo, clave] of Object.entries(CLAVE_POR_CAMPO)) {
    const valor = membrete[campo as keyof MembreteCentro];
    if (valor == null) continue;
    out[clave] = valor;
  }
  return out;
}
