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
import type { CaseWithRelations } from '@/features/case/schemas';
import { SCENARIOS } from '../../helpers/mapper-scenarios';

/** Caso base del golden, con overrides puntuales. */
function caso(overrides: Record<string, unknown> = {}): CaseWithRelations {
  const base = SCENARIOS[
    'insolvencia-completa'
  ].build() as unknown as CaseWithRelations;
  return { ...base, ...overrides } as CaseWithRelations;
}

describe('1. Constructores de Paz: completo, y con los valores exactos', () => {
  it('no le falta ningún campo', () => {
    expect(camposFaltantes('constructores-paz')).toEqual([]);
    expect(membreteDelCentro('constructores-paz')).not.toBeNull();
  });

  it('el mapper emite las 23 claves', () => {
    const map = mapMembreteCentro(caso({ tenantId: 'constructores-paz' }));
    expect(Object.keys(map).sort()).toEqual([...CLAVES_MEMBRETE].sort());
    expect(CLAVES_MEMBRETE).toHaveLength(CAMPOS_MEMBRETE.length);
  });

  it('los valores son EXACTAMENTE las cadenas que estaban en las plantillas', () => {
    // Extracción 1:1. Si alguien "corrige" una de estas cadenas (la tilde de
    // LÓPEZ, la capitalización de "interior 1 Oficina 308"), el HTML renderizado
    // deja de ser idéntico al de antes y el golden master se mueve.
    const map = mapMembreteCentro(caso({ tenantId: 'constructores-paz' }));
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
    const map = mapCaseToPlaceholders(caso({ tenantId: 'constructores-paz' }));
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
    const map = mapMembreteCentro(caso({ tenantId: 'armonia' }));
    // Cero claves: el gate de placeholders sin resolver corta la generación.
    expect(map).toEqual({});

    // Y en el punto de fusión tampoco aparecen con los valores del otro centro.
    const completo = mapCaseToPlaceholders(caso({ tenantId: 'armonia' }));
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
      mapMembreteCentro(caso({ tenantId: 'tenant-que-no-existe' })),
    ).toEqual({});
  });

  it.each(TENANTS_CON_MEMBRETE)(
    '%s: o está completo, o no emite ninguna clave (nunca a medias)',
    (tenantId) => {
      const map = mapMembreteCentro(caso({ tenantId }));
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
