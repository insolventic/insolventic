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

  it('el mapper emite las 23 claves', () => {
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
    expect(faltan).toContain('resolucionCentroNumero');
    expect(faltan).toContain('resolucionInsolvenciaNumero');
    expect(faltan).toContain('operadorNombre');
    expect(faltan).toContain('web');
    expect(faltan).toContain('email');
    // Lo que SÍ llegó el 2026-10-09 no figura como faltante.
    expect(faltan).not.toContain('nombre');
    expect(faltan).not.toContain('entidadPromotora');
    expect(faltan).not.toContain('direccion');
    expect(faltan).not.toContain('telefono');
  });

  it('REGRESIÓN: Armonía NO cae a los datos de Constructores', () => {
    const map = mapMembreteCentro(casoComoEnProduccion('armonia'));
    // Cero claves: el gate de placeholders sin resolver corta la generación.
    expect(map).toEqual({});

    // Y en el punto de fusión tampoco aparecen con los valores del otro centro.
    const completo = mapCaseToPlaceholders(casoComoEnProduccion('armonia'));
    for (const clave of CLAVES_MEMBRETE) {
      expect(completo[clave]).toBeUndefined();
    }
    const serializado = JSON.stringify(completo);
    expect(serializado).not.toContain('Constructores de Paz');
    expect(serializado).not.toContain('constructoresdepaz.com.co');
    expect(serializado).not.toContain('MALAVERA');
    expect(serializado).not.toContain('1459');
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
    '%s: o está completo, o no emite ninguna clave (nunca a medias)',
    (tenantId) => {
      const map = mapMembreteCentro(casoComoEnProduccion(tenantId));
      const claves = Object.keys(map).length;
      expect(claves === 0 || claves === CLAVES_MEMBRETE.length).toBe(true);
    },
  );
});

describe('3. GUARDIÁN: las plantillas ya no tienen estos datos a mano', () => {
  /** Los literales extraídos en este PR. Si alguien los vuelve a escribir, falla. */
  const YA_NO_VAN_A_MANO = [
    'Asociación Lonja de Propiedad Raíz y Avaluadores de Colombia',
    'Calle 74 No. 15-80 interior 1 Oficina 308',
    'Calle 74 No. 15-80 interior 1 oficina 308',
    'www.constructoresdepaz.com.co',
    'contacto@constructoresdepaz.com.co',
    'RESOLUCIÓN 1459 DEL 5 DE SEPTIEMBRE DE 2003',
    '311 811 7520',
    '3118117520',
  ];

  function plantillas(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) plantillas(p, out);
      else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  }

  const TODAS = plantillas(path.join(process.cwd(), 'templates'));

  it('hay plantillas que recorrer (si esto falla, el guardián no prueba nada)', () => {
    expect(TODAS.length).toBeGreaterThan(60);
  });

  it.each(YA_NO_VAN_A_MANO)('ninguna plantilla escribe %s', (literal) => {
    const culpables = TODAS.filter((f) =>
      fs.readFileSync(f, 'utf8').includes(literal),
    ).map((f) => path.relative(process.cwd(), f));
    expect(culpables).toEqual([]);
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
