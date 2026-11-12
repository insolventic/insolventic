/**
 * Papelera de expedientes: la regla del filtro y las guardas que la sostienen.
 *
 * `conFiltroDePapelera` es la pieza que hace que un caso eliminado desaparezca
 * de toda la app. Es pura a propósito, para fijarla acá sin Prisma; el ciclo
 * completo contra Postgres real está en `tests/db/papelera-casos.db.test.ts`
 * (el mock de Prisma reemplaza el cliente y con él la extensión).
 */

import fs from 'fs';
import path from 'path';

import {
  AVISO_SIN_CASO_EN_PAPELERA,
  CASO_ACTIVO,
  OPERACIONES_CON_FILTRO,
  conFiltroDePapelera,
  incluyendoPapelera,
  soloPapelera,
} from '@/lib/papelera';
import { P } from '@/lib/permissions';

const RAIZ = process.cwd();
const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

describe('conFiltroDePapelera — la regla', () => {
  it.each([...OPERACIONES_CON_FILTRO])(
    '%s sin deletedAt recibe deletedAt: null',
    (operacion) => {
      const resultado = conFiltroDePapelera(operacion, {
        where: { tenantId: 't1' },
      });
      expect(resultado).toEqual({
        where: { tenantId: 't1', deletedAt: null },
      });
    },
  );

  it('cubre lecturas, conteos, agregados y escrituras con where', () => {
    for (const op of [
      'findUnique',
      'findFirst',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
      'update',
      'updateMany',
      'delete',
      'deleteMany',
    ]) {
      expect(OPERACIONES_CON_FILTRO.has(op)).toBe(true);
    }
  });

  it('agrega el where cuando la operación no trae args', () => {
    expect(conFiltroDePapelera('findMany', undefined)).toEqual({
      where: { deletedAt: null },
    });
    expect(conFiltroDePapelera('count', {})).toEqual({
      where: { deletedAt: null },
    });
  });

  it('no muta los args originales', () => {
    const args = { where: { tenantId: 't1' }, select: { id: true } };
    const resultado = conFiltroDePapelera('findMany', args);
    expect(args.where).toEqual({ tenantId: 't1' });
    expect(resultado).toEqual({
      where: { tenantId: 't1', deletedAt: null },
      select: { id: true },
    });
  });

  it.each([
    ['soloPapelera', soloPapelera],
    ['incluyendoPapelera', incluyendoPapelera],
    ['deletedAt: null explícito', CASO_ACTIVO],
  ])('respeta un deletedAt pedido explícitamente (%s)', (_nombre, filtro) => {
    const args = { where: { tenantId: 't1', ...filtro } };
    expect(conFiltroDePapelera('findMany', args)).toBe(args);
  });

  it('un deletedAt dentro de OR no cuenta como pedido: se filtra igual', () => {
    const args = { where: { OR: [{ deletedAt: { not: null } }] } };
    expect(conFiltroDePapelera('findMany', args)).toEqual({
      where: { OR: [{ deletedAt: { not: null } }], deletedAt: null },
    });
  });

  it.each(['create', 'createMany', 'upsert'])(
    '%s no se toca (sin where, o un upsert que chocaría con el número)',
    (operacion) => {
      const args = { where: { id: 'c1' }, data: {} };
      expect(conFiltroDePapelera(operacion, args)).toBe(args);
    },
  );

  it('incluyendoPapelera hace que Prisma no filtre por la columna', () => {
    // La clave existe (la extensión no agrega la suya) y vale undefined
    // (Prisma ignora el filtro).
    expect(
      Object.prototype.hasOwnProperty.call(incluyendoPapelera, 'deletedAt'),
    ).toBe(true);
    expect(incluyendoPapelera.deletedAt).toBeUndefined();
  });

  it('los avisos sin caso siguen visibles; los de un caso en la papelera no', () => {
    expect(AVISO_SIN_CASO_EN_PAPELERA).toEqual({
      OR: [{ caseId: null }, { case: { is: { deletedAt: null } } }],
    });
  });
});

describe('guardas — que el filtro siga aplicándose', () => {
  it('src/lib/prisma.ts extiende Case con conFiltroDePapelera', () => {
    const fuente = leer('src/lib/prisma.ts');
    expect(fuente).toMatch(/\$extends\(/);
    expect(fuente).toMatch(/case:\s*\{\s*\$allOperations/);
    expect(fuente).toContain('conFiltroDePapelera(operation, args)');
  });

  it('ninguna action lee `cases` anidados sin filtrar', () => {
    // Las lecturas anidadas (debtor → cases) no pasan por la extensión.
    // `cases: true` en un include o un _count traería los de la papelera.
    const dir = path.join(RAIZ, 'src', 'features');
    const ofensores: string[] = [];
    const recorrer = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/actions[^/\\]*\.ts$/.test(e.name)) {
          const lineas = fs.readFileSync(p, 'utf8').split('\n');
          lineas.forEach((l, i) => {
            if (/\bcases:\s*true\b/.test(l)) {
              ofensores.push(`${path.relative(RAIZ, p)}:${i + 1}`);
            }
          });
        }
      }
    };
    recorrer(dir);
    expect(ofensores).toEqual([]);
  });

  it('los listados de pagos y las alertas filtran el caso activo', () => {
    // Son las lecturas de todo el centro sobre un modelo hijo; las acotadas a
    // un caso pasan antes por una lectura de Case, que sí filtra la extensión.
    // Pagos: el filtro de papelera viaja junto con la visibilidad por
    // expediente en `filtroDeCasoVisible` (N-B-01), que usan el reporte, la
    // exportación y el conteo de vencidos.
    const pagos = leer('src/features/payment/actions.ts');
    expect(pagos).toMatch(
      /return \{ \.\.\.CASO_ACTIVO, \.\.\.caseWhereOrNothing\(visibilidad\) \}/,
    );
    expect(pagos).toMatch(
      /where\.case = await filtroDeCasoVisible\(user, tenantId\)/,
    );
    expect(pagos).toMatch(/case: await filtroDeCasoVisible\(user, tenantId\)/);
    expect(leer('src/features/notification/alerts.ts')).toMatch(
      /case: CASO_ACTIVO/,
    );
    expect(leer('src/features/report/actions.ts')).toMatch(
      /case: \{ tenantId, \.\.\.caseScope, \.\.\.CASO_ACTIVO \}/,
    );
  });

  it('la numeración de casos incluye los de la papelera', () => {
    const fuente = leer('src/features/case/actions.ts');
    const i = fuente.indexOf('caseNumber: { startsWith: `${prefix}-` }');
    expect(i).toBeGreaterThan(-1);
    expect(fuente.slice(i, i + 200)).toContain('...incluyendoPapelera');
  });
});

describe('permiso de eliminación definitiva', () => {
  const migracion = leer(
    'src/prisma/migrations/20261109000000_case_papelera/migration.sql',
  );

  it('la migración crea el permiso con el mismo nombre que P', () => {
    expect(P.ELIMINAR_CASOS_DEFINITIVAMENTE).toBe(
      'Eliminar casos definitivamente',
    );
    expect(migracion).toContain(`'${P.ELIMINAR_CASOS_DEFINITIVAMENTE}'`);
  });

  it('se asigna solo al rol Administrador', () => {
    expect(migracion).toMatch(/WHERE r\."name" = 'Administrador'/);
    expect(migracion).not.toMatch(/Operadora|Abogado|Secretaria/);
  });

  it('la parte de datos es idempotente', () => {
    expect(migracion.match(/ON CONFLICT/g)).toHaveLength(2);
  });

  it('el seed lo da al Administrador', () => {
    const seed = leer('src/prisma/seed.ts');
    const i = seed.indexOf('const adminPermissions');
    const j = seed.indexOf('];', i);
    expect(seed.slice(i, j)).toContain("'Eliminar casos definitivamente'");
  });
});
