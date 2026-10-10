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
  /** El nombre A SECAS: "Constructores de Paz" / "Armonía Concertada". */
  nombre: string;
  /** El mismo nombre en mayúsculas. */
  nombreMayus: string;

  /**
   * EL RÓTULO DEL CENTRO, separado del nombre.
   *
   * El nombre no viaja solo: va pegado a un rótulo, y **ese rótulo es distinto
   * en cada centro**. Constructores es "Centro de Conciliación **y Arbitraje**";
   * Armonía es solo "Centro de Conciliación". Si el rótulo quedara como prosa
   * fija en la plantilla y solo se reemplazara el nombre, los documentos de
   * Armonía dirían "Centro de Conciliación y Arbitraje Armonía Concertada" — un
   * rótulo que no le corresponde.
   *
   * POR QUÉ RÓTULO + NOMBRE Y NO LA DENOMINACIÓN ENTERA. Se probó primero con
   * campos de denominación completa (incluida una con el nombre entre comillas)
   * y el golden lo rechazó: ese valor **contiene comillas**, el escapado del
   * punto de fusión las convierte en `&quot;` y el HTML renderizado dejaba de
   * ser idéntico — visualmente igual, bytes distintos. Separando rótulo y
   * nombre, las comillas se quedan en la plantilla, ningún valor las lleva, y
   * cada forma impresa se compone sin tocar el escapado.
   */
  /** "Centro de Conciliación y Arbitraje" / "Centro de Conciliación" */
  rotulo: string;
  /** Sin "y Arbitraje". Hoy es igual en los dos centros, pero Constructores usa las dos formas. */
  rotuloCorto: string;
  /** En mayúsculas y SIN TILDES, como está hoy: "CENTRO DE CONCILIACION Y ARBITRAJE" */
  rotuloMayus: string;
  /**
   * En mayúsculas y CON TILDE: "CENTRO DE CONCILIACIÓN Y ARBITRAJE".
   *
   * Coexiste con `rotuloMayus` porque el corpus trae las dos: 3 plantillas lo
   * escriben sin tilde y 4 con tilde. No se unifican por la misma razón que el
   * resto de las parejas de forma — la extracción es 1:1 y el golden exige que
   * el HTML de Constructores no cambie ni un byte.
   *
   * Esta forma fue la que se le escapó a #132: el chequeo de residuales buscaba
   * la variante sin tilde, así que las 4 con tilde quedaron como prosa fija.
   */
  rotuloMayusTilde: string;
  /** Con "arbitraje" en minúscula — preserva una errata de una plantilla. */
  rotuloErrata: string;
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
    rotulo: 'Centro de Conciliación y Arbitraje',
    rotuloCorto: 'Centro de Conciliación',
    rotuloMayus: 'CENTRO DE CONCILIACION Y ARBITRAJE',
    rotuloMayusTilde: 'CENTRO DE CONCILIACIÓN Y ARBITRAJE',
    rotuloErrata: 'Centro de Conciliación y arbitraje',
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
    // El nombre A SECAS. Hasta el 2026-10-10 este campo tenía la denominación
    // completa, porque era el único dato que había llegado; con el nombre corto
    // confirmado, eso era un error: `CENTRO_NOMBRE` se usa donde va el nombre
    // solo, y habría impreso "Centro de Conciliación Armonía Concertada" dentro
    // de frases que ya dicen "Centro de Conciliación".
    nombre: 'Armonía Concertada',
    nombreMayus: 'ARMONÍA CONCERTADA',
    // Armonía NO lleva "y Arbitraje": su rótulo es solo "Centro de
    // Conciliación". Las cuatro formas colapsan en la misma, incluida la de la
    // errata: no se replica un error de tipeo de la otra plantilla.
    rotulo: 'Centro de Conciliación',
    rotuloCorto: 'Centro de Conciliación',
    rotuloMayus: 'CENTRO DE CONCILIACION',
    rotuloMayusTilde: 'CENTRO DE CONCILIACIÓN',
    rotuloErrata: 'Centro de Conciliación',
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
    // UNA SOLA RESOLUCIÓN para los dos roles. Constructores tiene dos
    // habilitaciones distintas (centro de conciliación 1459/2003 y operador de
    // insolvencia 0001/2014); Armonía tiene una sola, la 0858 del 01/11/2016,
    // que cubre ambos. Confirmado el 2026-10-10 contra el sello físico y el
    // membrete oficial, que coinciden. Por eso los dos bloques de campos
    // apuntan a la misma resolución: no es un copiar-pegar por descuido.
    resolucionCentroNumero: '0858',
    resolucionCentroFecha: '01 de noviembre de 2016',
    resolucionCentroFechaCorta: '1 de noviembre de 2016',
    resolucionCentroEncabezado: 'RESOLUCIÓN 0858 DEL 1 DE NOVIEMBRE DE 2016',
    resolucionInsolvenciaNumero: '0858',
    resolucionInsolvenciaFecha: '01 de noviembre de 2016',
    resolucionInsolvenciaAnio: '2016',
    resolucionInsolvenciaNumeroCorto: '858',
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
/**
 * El membrete de un centro **tal como está**, con los `null` que tenga.
 *
 * No sirve para generar — para eso está `membreteDelCentro`, que devuelve
 * `null` si falta algo. Sirve para inspeccionarlo: qué datos ya llegaron y
 * cuáles no, sin que la respuesta sea todo-o-nada. Lo usan los tests para
 * afirmar valores de un centro que todavía está incompleto.
 */
export function membreteParcialDelCentro(
  tenantId?: string | null,
): Readonly<MembreteParcial> | null {
  if (!tenantId) return null;
  return MEMBRETE_POR_TENANT[tenantId as TenantId] ?? null;
}

export function membreteDelCentro(
  tenantId?: string | null,
): MembreteCentro | null {
  if (camposFaltantes(tenantId).length > 0) return null;
  return MEMBRETE_POR_TENANT[tenantId as TenantId] as MembreteCentro;
}
