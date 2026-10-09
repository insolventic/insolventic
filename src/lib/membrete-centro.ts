/**
 * Membrete por centro: los datos de identidad que las plantillas imprimen.
 *
 * ANTES de este módulo, el nombre del centro, su entidad promotora, la
 * dirección, el teléfono, la web, el correo, las dos resoluciones de
 * habilitación y el nombre de la operadora estaban **escritos a mano** en las
 * 65 plantillas — ~400 ocurrencias. Igual que pasaba con los assets de imagen
 * antes de `branding-assets.ts`, no había ninguna rama por tenant: todo
 * documento generado para `armonia` salía con los datos de Constructores de
 * Paz. Inventario y plan: `docs/BRANDING_POR_CENTRO_2026-09-30.md`,
 * `docs/PENDIENTES_DECISION_LEGAL.md` §5 (ítem 11).
 *
 * POR QUÉ FALLA EN VEZ DE CAER AL OTRO CENTRO
 * ============================================
 * Los assets de imagen tienen un fallback a Constructores (`brandingRef`): una
 * imagen equivocada es un problema estético. El membrete **no**: estas cadenas
 * afirman ante un juzgado que un centro está habilitado por una resolución
 * concreta del Ministerio de Justicia. Un documento de Armonía que declare la
 * Resolución 1459/2003 de Constructores afirma algo falso sobre una
 * habilitación.
 *
 * Por eso un centro con datos incompletos **no emite los placeholders**. El
 * gate de placeholders sin resolver (`generate-documents.ts`) corta la
 * generación y devuelve al operador qué campos faltan, en vez de producir un
 * PDF con el centro equivocado y subirlo a Drive. Decisión del dueño del
 * producto, 2026-10-09: "prefiero un error visible a un documento con el centro
 * equivocado".
 *
 * CÓMO COMPLETAR UN CENTRO
 * ========================
 * Llenar su fila con los datos reales y borrar los `null`. El test
 * `membrete-centro.test.ts` recorre el mapa y verifica, para cada centro
 * completo, que no queda ningún campo vacío; y para cada centro incompleto, que
 * el sub-mapper no emite nada.
 */

import type { TenantId } from './prisma';

/**
 * Los datos de membrete de un centro.
 *
 * Varios campos existen en **dos formas** porque las plantillas los imprimen
 * así y la extracción es 1:1 — no se normaliza nada: el golden master exige que
 * el HTML renderizado de Constructores no cambie ni un byte. Cuando se agregue
 * un centro hay que decidir sus dos formas igual.
 */
export interface MembreteCentro {
  /** "Constructores de Paz" — el nombre tal como va en prosa. */
  nombre: string;
  /** "CONSTRUCTORES DE PAZ" — el mismo nombre en mayúsculas. */
  nombreMayus: string;
  /** La asociación que promueve el centro. */
  entidadPromotora: string;
  /** Dirección sin ciudad: "Calle 74 No. 15-80 interior 1 Oficina 308". */
  direccion: string;
  /** Igual que `direccion` pero con "oficina" en minúscula, como la imprimen algunas plantillas. */
  direccionMinus: string;
  /** "Bogotá D.C." */
  ciudad: string;
  /** "Edificio Osaka Trade Center" */
  edificio: string;
  /** "311 811 7520" */
  telefono: string;
  /** "3118117520" — el mismo número sin separar. */
  telefonoCompacto: string;
  /** "www.constructoresdepaz.com.co" */
  web: string;
  /** "contacto@constructoresdepaz.com.co" */
  email: string;
  /** Resolución que habilita al CENTRO DE CONCILIACIÓN. Número solo: "1459". */
  resolucionCentroNumero: string;
  /** "05 de septiembre de 2003" */
  resolucionCentroFecha: string;
  /** "5 de septiembre de 2003" — la misma fecha sin cero a la izquierda. */
  resolucionCentroFechaCorta: string;
  /** "RESOLUCIÓN 1459 DEL 5 DE SEPTIEMBRE DE 2003" — la línea de encabezado. */
  resolucionCentroEncabezado: string;
  /**
   * Resolución que habilita al centro como OPERADOR DE INSOLVENCIA.
   *
   * Es una habilitación DISTINTA de la del centro de conciliación y 21
   * plantillas afirman las dos en la misma oración. Número solo: "0001".
   */
  resolucionInsolvenciaNumero: string;
  /** "02 de enero de 2014" */
  resolucionInsolvenciaFecha: string;
  /** "2014" — el año solo, para la forma corta "Resolución 001 de 2014". */
  resolucionInsolvenciaAnio: string;
  /** "001" — el número sin ceros, para esa misma forma corta. */
  resolucionInsolvenciaNumeroCorto: string;
  /** Nombre de quien firma como operador: "BEATRIZ HELENA MALAVERA LOPEZ". */
  operadorNombre: string;
  /** El mismo nombre con tilde, como lo imprimen algunas plantillas. */
  operadorNombreTilde: string;
  /** "Operadora de Insolvencia" */
  operadorCargo: string;
  /** "OPERADORA DE INSOLVENCIA" */
  operadorCargoMayus: string;
}

/** Un centro cuyos datos todavía no llegaron completos. `null` = falta. */
type MembreteParcial = {
  [K in keyof MembreteCentro]: MembreteCentro[K] | null;
};

/**
 * Datos por centro.
 *
 * **Constructores de Paz** está completo: cada valor es **exactamente** la
 * cadena que hoy está escrita a mano en las plantillas. No se corrigió ni se
 * normalizó nada (ni "LOPEZ" sin tilde, ni "interior 1 Oficina 308" con esa
 * capitalización) porque la extracción es 1:1 y el golden master lo verifica.
 *
 * **Armonía** tiene los 4 datos que llegaron confirmados el 2026-10-09 y
 * `null` en el resto. Mientras haya un `null`, sus documentos **no se generan**
 * (ver el docblock de arriba). Lo que falta, y por qué no se puede derivar:
 *
 *  - Las **dos resoluciones**. Llegó una sola ("0858 del 01 de noviembre de
 *    2016") y las plantillas afirman dos habilitaciones distintas: la del
 *    centro de conciliación y la de operador de insolvencia. No se sabe cuál de
 *    las dos es la 0858, ni cuál es la otra. Además `PENDIENTES_DECISION_LEGAL`
 *    §5 registra que el sello de Armonía menciona "656/2016", que no coincide.
 *  - El **operador**: nombre y cargo de quien firma por Armonía. Es el ítem 12
 *    de `PENDIENTES_DECISION_LEGAL.md`, todavía abierto. Hoy las plantillas
 *    nombran a la operadora de Constructores en 86 lugares.
 *  - **Web y correo** propios del centro.
 *  - **Edificio**: la dirección de Armonía es el mismo edificio que la de
 *    Constructores (Calle 74 #15-80, oficina 306 vs. 308), pero no se asume que
 *    el rótulo "Edificio Osaka Trade Center" aplique sin confirmarlo.
 */
const MEMBRETE_POR_TENANT: Record<TenantId, MembreteParcial> = {
  'constructores-paz': {
    nombre: 'Constructores de Paz',
    nombreMayus: 'CONSTRUCTORES DE PAZ',
    entidadPromotora:
      'Asociación Lonja de Propiedad Raíz y Avaluadores de Colombia',
    direccion: 'Calle 74 No. 15-80 interior 1 Oficina 308',
    direccionMinus: 'Calle 74 No. 15-80 interior 1 oficina 308',
    ciudad: 'Bogotá D.C.',
    edificio: 'Edificio Osaka Trade Center',
    telefono: '311 811 7520',
    telefonoCompacto: '3118117520',
    web: 'www.constructoresdepaz.com.co',
    email: 'contacto@constructoresdepaz.com.co',
    resolucionCentroNumero: '1459',
    resolucionCentroFecha: '05 de septiembre de 2003',
    resolucionCentroFechaCorta: '5 de septiembre de 2003',
    resolucionCentroEncabezado: 'RESOLUCIÓN 1459 DEL 5 DE SEPTIEMBRE DE 2003',
    resolucionInsolvenciaNumero: '0001',
    resolucionInsolvenciaFecha: '02 de enero de 2014',
    resolucionInsolvenciaAnio: '2014',
    resolucionInsolvenciaNumeroCorto: '001',
    operadorNombre: 'BEATRIZ HELENA MALAVERA LOPEZ',
    operadorNombreTilde: 'BEATRIZ HELENA MALAVERA LÓPEZ',
    operadorCargo: 'Operadora de Insolvencia',
    operadorCargoMayus: 'OPERADORA DE INSOLVENCIA',
  },
  armonia: {
    nombre: 'Centro de Conciliación Armonía Concertada',
    nombreMayus: 'CENTRO DE CONCILIACIÓN ARMONÍA CONCERTADA',
    entidadPromotora:
      'Asociación para el Fomento de la Cultura la Justicia y la Conciliación',
    direccion: 'Calle 74 #15-80 Interior 1 oficina 306',
    direccionMinus: 'Calle 74 #15-80 Interior 1 oficina 306',
    ciudad: 'Bogotá D.C.',
    edificio: null,
    telefono: '313 290 4984',
    telefonoCompacto: '3132904984',
    web: null,
    email: null,
    resolucionCentroNumero: null,
    resolucionCentroFecha: null,
    resolucionCentroFechaCorta: null,
    resolucionCentroEncabezado: null,
    resolucionInsolvenciaNumero: null,
    resolucionInsolvenciaFecha: null,
    resolucionInsolvenciaAnio: null,
    resolucionInsolvenciaNumeroCorto: null,
    operadorNombre: null,
    operadorNombreTilde: null,
    operadorCargo: null,
    operadorCargoMayus: null,
  },
};

/** Todos los campos que un centro tiene que tener para poder generar. */
export const CAMPOS_MEMBRETE = Object.keys(
  MEMBRETE_POR_TENANT['constructores-paz'],
) as Array<keyof MembreteCentro>;

/** Los tenants que este mapa conoce, para que los tests los recorran. */
export const TENANTS_CON_MEMBRETE = Object.keys(
  MEMBRETE_POR_TENANT,
) as TenantId[];

/**
 * Los campos que le faltan a un centro, en orden estable.
 *
 * Vacío = el centro está completo y puede generar documentos. Un tenant
 * desconocido devuelve **todos** los campos como faltantes: no hay fallback a
 * otro centro a propósito (ver el docblock del módulo).
 */
export function camposFaltantes(
  tenantId?: string | null,
): Array<keyof MembreteCentro> {
  const membrete = tenantId
    ? MEMBRETE_POR_TENANT[tenantId as TenantId]
    : undefined;
  if (!membrete) return [...CAMPOS_MEMBRETE];
  return CAMPOS_MEMBRETE.filter((campo) => membrete[campo] == null);
}

/**
 * El membrete de un centro, o `null` si está incompleto.
 *
 * Devolver `null` en vez de un objeto con huecos es deliberado: obliga a quien
 * llame a decidir qué hace, y lo que hace el sub-mapper es no emitir ninguna
 * clave, para que el gate de placeholders sin resolver corte la generación.
 */
export function membreteDelCentro(
  tenantId?: string | null,
): MembreteCentro | null {
  if (camposFaltantes(tenantId).length > 0) return null;
  return MEMBRETE_POR_TENANT[tenantId as TenantId] as MembreteCentro;
}
