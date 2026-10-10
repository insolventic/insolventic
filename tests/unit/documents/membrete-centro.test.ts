/**
 * Membrete por centro: los datos de identidad se eligen por tenant, y un
 * centro incompleto NO genera documentos.
 *
 * ANTES: el nombre del centro, su entidad promotora, la dirección, el
 * teléfono, la web, el correo, las dos resoluciones de habilitación y la
 * operadora estaban escritos a mano en las 65 plantillas — ~400 ocurrencias.
 * No había ninguna rama por tenant, así que todo documento de `armonia` salía
 * con los datos de Constructores de Paz. Hallazgo §1 de
 * `docs/BRANDING_POR_CENTRO_2026-09-30.md`, ítem 11 de
 * `docs/PENDIENTES_DECISION_LEGAL.md`.
 *
 * LO QUE ESTOS TESTS FIJAN, y no es lo mismo que en `branding-assets.test.ts`:
 * los assets de imagen tienen fallback a Constructores (una imagen equivocada
 * es un problema estético); el membrete **no**. Estas cadenas afirman ante un
 * juzgado que un centro está habilitado por una resolución concreta del
 * Ministerio de Justicia. Un centro con datos incompletos tiene que **fallar la
 * generación**, no caer a los datos del otro centro. Decisión del dueño del
 * producto, 2026-10-09.
 */

import fs from 'fs';
import path from 'path';

import { mapCaseToPlaceholders } from '@/features/document/placeholder-mapper';
import {
  mapMembreteCentro,
  CLAVES_MEMBRETE,
} from '@/features/document/placeholders/membrete';
import {
  CAMPOS_MEMBRETE,
  TENANTS_CON_MEMBRETE,
  camposFaltantes,
  membreteDelCentro,
  membreteParcialDelCentro,
} from '@/lib/membrete-centro';
import {
  esSlugDeCentroConocido,
  tenantSlugDelCaso,
  tieneFormaDeSlug,
} from '@/features/document/placeholders/tenant-slug';
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Caso base del golden, con overrides puntuales. */
function caso(overrides: Record<string, unknown> = {}): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return { ...base, ...overrides } as CaseWithRelations;
}

/** Un cuid como los que genera Prisma para `Tenant.id`. */
const CUID = 'cmluzsnr0000qwertyuiop123';

/**
 * Caso con la forma REAL de producción: `tenantId` es el cuid del tenant y el
 * slug viaja en la relación `tenant`.
 *
 * POR QUÉ IMPORTA. Verificado contra la base de producción el 2026-10-09: los
 * `Tenant.id` son cuids y no coinciden con el slug. Si estos tests usaran
 * `{ tenantId: 'constructores-paz' }` —un valor que producción nunca produce—
 * pasarían en verde mientras el membrete falla cerrado en producción para los
 * DOS centros, que con el fail-closed es un apagón de la generación. Es el
 * mismo error que dejó al branding por centro sin funcionar con sus tests
 * verdes.
 */
function casoComoEnProduccion(slug: string): CaseWithRelations {
  return caso({ tenantId: CUID, tenant: { slug } });
}

describe('1. Constructores de Paz: completo, y con los valores exactos', () => {
  it('no le falta ningún campo', () => {
    expect(camposFaltantes('constructores-paz')).toEqual([]);
    expect(membreteDelCentro('constructores-paz')).not.toBeNull();
  });

  it('el mapper emite una clave por campo, sin faltar ninguna', () => {
    const map = mapMembreteCentro(casoComoEnProduccion('constructores-paz'));
    expect(Object.keys(map).sort()).toEqual([...CLAVES_MEMBRETE].sort());
    expect(CLAVES_MEMBRETE).toHaveLength(CAMPOS_MEMBRETE.length);
  });

  it('los valores son EXACTAMENTE las cadenas que estaban en las plantillas', () => {
    // Extracción 1:1. Si alguien "corrige" una de estas cadenas (la tilde de
    // LÓPEZ, la capitalización de "interior 1 Oficina 308"), el HTML renderizado
    // deja de ser idéntico al de antes y el golden master se mueve.
    const map = mapMembreteCentro(casoComoEnProduccion('constructores-paz'));
    expect(map.CENTRO_ENTIDAD_PROMOTORA).toBe(
      'Asociación Lonja de Propiedad Raíz y Avaluadores de Colombia',
    );
    expect(map.CENTRO_DIRECCION).toBe(
      'Calle 74 No. 15-80 interior 1 Oficina 308',
    );
    expect(map.CENTRO_DIRECCION_MINUS).toBe(
      'Calle 74 No. 15-80 interior 1 oficina 308',
    );
    expect(map.CENTRO_CIUDAD).toBe('Bogotá D.C.');
    expect(map.CENTRO_TELEFONO).toBe('311 811 7520');
    expect(map.CENTRO_TELEFONO_COMPACTO).toBe('3118117520');
    expect(map.CENTRO_WEB).toBe('www.constructoresdepaz.com.co');
    expect(map.CENTRO_EMAIL).toBe('contacto@constructoresdepaz.com.co');
    expect(map.CENTRO_RESOLUCION_ENCABEZADO).toBe(
      'RESOLUCIÓN 1459 DEL 5 DE SEPTIEMBRE DE 2003',
    );
    // Las dos habilitaciones son distintas y 21 plantillas afirman las dos.
    expect(map.CENTRO_RESOLUCION_NUMERO).toBe('1459');
    expect(map.CENTRO_RES_INSOLVENCIA_NUMERO).toBe('0001');
  });

  it('llega hasta el punto de fusión', () => {
    const map = mapCaseToPlaceholders(
      casoComoEnProduccion('constructores-paz'),
    );
    for (const clave of CLAVES_MEMBRETE) {
      expect(typeof map[clave]).toBe('string');
      expect(map[clave]).not.toBe('');
    }
  });
});

describe('2. FAIL-CLOSED: un centro incompleto no emite nada', () => {
  it('Armonía todavía le debe datos, y se sabe cuáles', () => {
    const faltan = camposFaltantes('armonia');
    expect(faltan.length).toBeGreaterThan(0);

    // Lo que bloquea hoy, anotado para que el día que llegue se vea en el diff.
    // La lista es EXACTA a propósito: si alguien llena uno sin actualizar el
    // test, falla; y si alguien pone un `null` nuevo, también.
    // Un solo campo, y se sabe cuál: la cuenta a la que consigna el deudor.
    // La lista es EXACTA a propósito: si alguien la llena sin actualizar el
    // test, falla; y si alguien pone un `null` nuevo, también.
    expect(faltan).toEqual(['cuentaConsignacion']);
  });

  it('los dos campos vacíos de Armonía son vacíos A PROPÓSITO, no por descuido', () => {
    // La distinción `SIN_DATO` ('') vs `null` no la impone el tipo: la impone
    // este test. Lista exacta de lo que está vacío queriendo; cualquier otro
    // campo con '' es un descuido y acá se cae.
    const vacios = (tenantId: string) => {
      const m = membreteParcialDelCentro(tenantId)!;
      return CAMPOS_MEMBRETE.filter((c) => m[c] === '').sort();
    };
    expect(vacios('armonia')).toEqual(['edificio', 'web']);
    expect(vacios('constructores-paz')).toEqual([]);
  });

  it('la operadora de insolvencia de Armonía es la MISMA persona, no un fallback', () => {
    // Confirmado el 2026-10-10: Beatriz Helena Malavera está habilitada en los
    // dos centros. Que los valores coincidan NO es el fallback que este módulo
    // prohíbe —es el mismo dato— y el test lo deja escrito para que nadie lo
    // "arregle" creyendo que es una fuga de Constructores.
    const ar = membreteParcialDelCentro('armonia')!;
    const cp = membreteParcialDelCentro('constructores-paz')!;
    expect(ar.operadorNombre).toBe(cp.operadorNombre);
    expect(ar.operadorCargoMayus).toBe('OPERADORA DE INSOLVENCIA');
  });

  it('la resolución de Armonía es UNA y cubre los dos roles', () => {
    // Constructores tiene dos habilitaciones distintas; Armonía una sola.
    // Confirmado el 2026-10-10 contra el sello físico y el membrete oficial.
    // Si alguien "corrige" esto creyendo que es un copiar-pegar, el test lo
    // frena.
    const cp = mapMembreteCentro(casoComoEnProduccion('constructores-paz'));
    expect(cp.CENTRO_RESOLUCION_NUMERO).toBe('1459');
    expect(cp.CENTRO_RES_INSOLVENCIA_NUMERO).toBe('0001');
    expect(cp.CENTRO_RESOLUCION_NUMERO).not.toBe(
      cp.CENTRO_RES_INSOLVENCIA_NUMERO,
    );

    const membrete = membreteParcialDelCentro('armonia')!;
    expect(membrete.resolucionCentroNumero).toBe('0858');
    expect(membrete.resolucionInsolvenciaNumero).toBe('0858');
  });

  it('el rótulo de Armonía NO lleva "y Arbitraje"', () => {
    // El motivo por el que rótulo y nombre son campos separados: si el rótulo
    // fuera prosa fija de plantilla, Armonía imprimiría un rótulo ajeno.
    const cp = mapMembreteCentro(casoComoEnProduccion('constructores-paz'));
    expect(cp.CENTRO_ROTULO).toBe('Centro de Conciliación y Arbitraje');
    expect(membreteParcialDelCentro('armonia')!.rotulo).toBe(
      'Centro de Conciliación',
    );
    expect(membreteParcialDelCentro('armonia')!.rotulo).not.toContain(
      'Arbitraje',
    );
  });

  it('REGRESIÓN: Armonía NO cae a los datos de Constructores', () => {
    const map = mapMembreteCentro(casoComoEnProduccion('armonia'));

    // Emite lo que tiene, y NO emite el único campo que le falta: la plantilla
    // que lo use queda sin resolver y el gate corta ESE documento.
    expect(map.CENTRO_CUENTA_CONSIGNACION).toBeUndefined();
    expect(map.CENTRO_NOMBRE).toBe('Armonía Concertada');
    expect(map.CENTRO_EMAIL).toBe('contacto@armoniaconcertada.co');

    // Y en el punto de fusión no aparece NINGÚN dato propio de Constructores.
    // Ojo con qué se chequea: `MALAVERA` y `OPERADORA DE INSOLVENCIA` ya no
    // sirven de canario, porque la operadora es la misma persona en los dos
    // centros. Lo que distingue de verdad es esto.
    const completo = mapCaseToPlaceholders(casoComoEnProduccion('armonia'));
    const serializado = JSON.stringify(completo);
    for (const ajeno of [
      'Constructores de Paz',
      'CONSTRUCTORES DE PAZ',
      'constructoresdepaz.com.co',
      'Lonja de Propiedad',
      'Osaka',
      '1459',
      '830.122.178-7',
      '2061 399 5617',
      'Arbitraje',
      'ARBITRAJE',
      '311 811 7520',
    ]) {
      expect(serializado).not.toContain(ajeno);
    }
  });

  it('un tenant desconocido tampoco cae al otro centro', () => {
    expect(camposFaltantes(undefined)).toEqual([...CAMPOS_MEMBRETE]);
    expect(camposFaltantes('tenant-que-no-existe')).toEqual([
      ...CAMPOS_MEMBRETE,
    ]);
    expect(membreteDelCentro('tenant-que-no-existe')).toBeNull();
    expect(
      mapMembreteCentro(casoComoEnProduccion('tenant-que-no-existe')),
    ).toEqual({});
  });

  it.each(TENANTS_CON_MEMBRETE)(
    '%s: emite exactamente una clave por campo que tiene, y ninguna más',
    (tenantId) => {
      // El invariante que reemplazó al todo-o-nada. Lo que importa no es
      // "todas o ninguna" sino que no se emita una clave sin dato detrás:
      // emitir `undefined` o `''` por un campo que falta sería resolver el
      // placeholder con nada y dejar pasar el documento.
      const map = mapMembreteCentro(casoComoEnProduccion(tenantId));
      const faltan = camposFaltantes(tenantId);
      expect(Object.keys(map)).toHaveLength(
        CLAVES_MEMBRETE.length - faltan.length,
      );
      for (const valor of Object.values(map)) {
        expect(typeof valor).toBe('string');
      }
    },
  );
});

describe('3. GUARDIÁN: las plantillas ya no tienen estos datos a mano', () => {
  /**
   * ANTES ESTE GUARDIÁN ERA UNA LISTA A MANO, Y POR ESO FALLÓ.
   *
   * Listaba 8 literales elegidos de memoria — el nombre, las resoluciones, la
   * dirección, el teléfono, la web, el correo — y no incluía el rótulo, la
   * entidad promotora ni el edificio. Resultado: dos PRs de extracción cerraron
   * en verde dejando 28 ocurrencias todavía escritas a mano, incluidas las 10
   * del rótulo "y Arbitraje", que es lo único que distingue a los dos centros.
   *
   * Ahora recorre **todos** los campos del membrete de Constructores y busca su
   * valor en las plantillas. No hay nada que recordar agregar: un campo nuevo
   * entra al guardián solo. Lo que queda a mano es lo contrario — una lista de
   * EXCEPCIONES, cada una con su razón, que es un lugar incómodo donde estar.
   */
  const EXCEPCIONES: Record<string, string> = {
    rotuloCorto:
      'Prosa genérica ("ante el Centro de Conciliación", "en este Centro de ' +
      'Conciliación"): los DOS centros son "Centro de Conciliación", así que ' +
      'no afirma nada ajeno. Lo que sí distinguía era "y Arbitraje", y eso ya ' +
      'no queda a mano.',
    ciudad:
      'Los dos centros están en Bogotá D.C. El día que se sume uno de otra ' +
      'ciudad, esta excepción hay que cerrarla: son 15 plantillas.',
    resolucionInsolvenciaNumeroCorto:
      '"001" es demasiado corto para buscarlo por substring: coincide con ' +
      '"Ley 640 del 2001" en 3 plantillas, que no tienen nada que ver. Las ' +
      'formas largas de la misma resolución sí están cubiertas por este ' +
      'guardián, y son las que se imprimen como habilitación.',
    operadorNombre:
      'Beatriz Helena Malavera es la operadora de insolvencia de los DOS ' +
      'centros (confirmado 2026-10-10), así que el nombre a mano no afirma ' +
      'nada falso. Extraerlo o no es decisión del PR de normalización del ' +
      'cargo, que es el que toca estas 41 plantillas.',
    operadorNombreTilde:
      'La misma persona y la misma razón que operadorNombre, en la forma con ' +
      'tilde: 6 plantillas.',
    operadorCargo:
      'Ídem: la normalización del cargo a una sola forma va en su propio PR ' +
      '(16 plantillas con esta forma, 27 con la de mayúsculas).',
    operadorCargoMayus:
      'La misma razón que operadorCargo, en la forma en mayúsculas: es la ' +
      'forma canónica a la que apunta la normalización, 27 plantillas.',
  };

  /**
   * Variantes tipográficas que NO son el valor de ningún campo, y que por eso
   * el barrido automático no ve. Son las formas que había en las plantillas
   * antes de normalizarlas; si vuelven, vuelve el problema.
   */
  const VARIANTES_QUE_NO_VUELVEN = [
    'Edificio Osaka Trade center', // con "center" en minúscula, 3 plantillas
    'calle 74 No. 15-80 Interior 1 Oficina 308', // con "calle" en minúscula
    'Calle 74 No. 15-80 Interior 1 Oficina 308', // con "Interior" en mayúscula
    'ASOCIACION LONJA DE PROPIEDAD RAIZ', // sin tildes, la de la cuenta
    'Centro de Conciliación y Arbitraje',
    'CENTRO DE CONCILIACIÓN Y ARBITRAJE',
    'Centro de Conciliación y arbitraje',
  ];

  function plantillas(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) plantillas(p, out);
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  }

  const TODAS = plantillas(path.join(process.cwd(), 'templates')).map((f) => ({
    rel: path.relative(process.cwd(), f),
    texto: fs.readFileSync(f, 'utf8'),
  }));

  it('hay plantillas que recorrer (si esto falla, el guardián no prueba nada)', () => {
    expect(TODAS.length).toBeGreaterThan(60);
  });

  const CP = membreteDelCentro('constructores-paz')! as unknown as Record<
    string,
    string
  >;

  it.each(CAMPOS_MEMBRETE)(
    'ninguna plantilla escribe a mano el valor de %s',
    (campo) => {
      const razon = EXCEPCIONES[campo];
      const culpables = TODAS.filter((t) => t.texto.includes(CP[campo])).map(
        (t) => t.rel,
      );
      if (razon) {
        // Excepción declarada: se exige que SIGA apareciendo. Si alguien la
        // extrae y se olvida de sacarla de acá, el test lo avisa — así la
        // lista de excepciones no se vuelve folklore.
        expect(culpables.length).toBeGreaterThan(0);
        expect(razon.length).toBeGreaterThan(40);
        return;
      }
      expect(culpables).toEqual([]);
    },
  );

  it.each(VARIANTES_QUE_NO_VUELVEN)('ninguna plantilla escribe %s', (lit) => {
    const culpables = TODAS.filter((t) => t.texto.includes(lit)).map(
      (t) => t.rel,
    );
    expect(culpables).toEqual([]);
  });

  it('todo campo del membrete es o guardado o excepción explícita', () => {
    // Cierra la puerta de atrás: un campo nuevo no puede quedar fuera de los
    // dos lados. Si no está excepcionado, el it.each de arriba lo exige en 0
    // plantillas; si está excepcionado, tiene que tener razón escrita.
    const excepcionados = Object.keys(EXCEPCIONES);
    for (const e of excepcionados) {
      expect(CAMPOS_MEMBRETE as unknown as string[]).toContain(e);
    }
  });
});

describe('4. GUARDIÁN DE PERTENENCIA: el centro se identifica por un slug conocido', () => {
  /**
   * El mismo guardián que `tenant-slug.test.ts`, aplicado al membrete — y acá
   * con más consecuencia que en el branding.
   *
   * Si el valor que el mapper usa para identificar el centro no es un slug que
   * el mapa conoce, `membreteDelCentro` devuelve `null`, el sub-mapper no emite
   * nada y el gate corta la generación. Para los DOS centros. Con el branding
   * eso era un default silencioso; acá es un apagón.
   *
   * La forma sola no alcanza para detectarlo: un cuid es minúsculas y
   * alfanumérico, y un identificador inventado como `tenant-golden` tiene forma
   * de slug perfecta. Lo que lo detecta es la pertenencia al mapa.
   */
  it('el valor que el mapper usa con la forma de producción es un slug CONOCIDO', () => {
    for (const slug of TENANTS_CON_MEMBRETE) {
      const usado = tenantSlugDelCaso(casoComoEnProduccion(slug));
      expect(tieneFormaDeSlug(usado)).toBe(true);
      expect(esSlugDeCentroConocido(usado)).toBe(true);
      // Y explícitamente: NO es el cuid que está en Case.tenantId.
      expect(usado).not.toBe(CUID);
    }
  });

  it('REGRESIÓN: un cuid no identifica a ningún centro, así que no emite nada', () => {
    // Esto es lo que habría apagado la generación en producción si el mapper
    // hubiera seguido leyendo `Case.tenantId`.
    expect(esSlugDeCentroConocido(CUID)).toBe(false);
    expect(camposFaltantes(CUID)).toEqual([...CAMPOS_MEMBRETE]);

    const sinRelacion = caso({ tenantId: CUID }) as Record<string, unknown>;
    delete sinRelacion.tenant;
    expect(
      mapMembreteCentro(sinRelacion as unknown as CaseWithRelations),
    ).toEqual({});
  });

  // Sintéticos SIN dígitos: pasan el filtro de forma, así que solo los frena la
  // pertenencia al mapa. Son los peligrosos, los que podrían colarse.
  it.each(['tenant-golden', 'tenant-test-id', 'prueba-smoke'])(
    'el identificador sintético %p no se cuela por tener forma de slug',
    (sintetico) => {
      expect(tieneFormaDeSlug(sintetico)).toBe(true);
      expect(esSlugDeCentroConocido(sintetico)).toBe(false);
      expect(mapMembreteCentro(casoComoEnProduccion(sintetico))).toEqual({});
    },
  );

  // Sintéticos CON dígitos (los tags de `tests/db`, tipo `e2edocs-m2k3j4`):
  // los frena ya el filtro de forma, antes de la pertenencia. Se fija aparte
  // para que quede claro cuál de los dos niveles actúa en cada caso.
  it.each(['e2edocs-m2k3j4', 'smoke-1a2b3c', 'cmluzsnr0000qwertyuiop123'])(
    'el identificador %p lo rechaza ya la forma, sin llegar a la pertenencia',
    (sintetico) => {
      expect(tieneFormaDeSlug(sintetico)).toBe(false);
      expect(esSlugDeCentroConocido(sintetico)).toBe(false);
      expect(mapMembreteCentro(casoComoEnProduccion(sintetico))).toEqual({});
    },
  );
});
