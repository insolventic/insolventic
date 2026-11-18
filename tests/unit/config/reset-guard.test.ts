/**
 * Unit Tests: guarda de destino de `db:reset` (src/prisma/reset-guard.ts).
 *
 * `src/prisma/reset.ts` hace `deleteMany({})` sobre todas las tablas y no
 * miraba a qué base estaba conectado; con el `.env` de Vercel cargado, un
 * `npm run db:reset` vaciaba Neon. Estos tests fijan que solo corre contra una
 * base de prueba local (el criterio del seed y de `tests/db/db-guard.ts`) y
 * que el opt-in del seed NO lo habilita. No se conectan a nada.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assertResetPuedeCorrer } from '@/prisma/reset-guard';
import { SEED_OPT_IN_VAR } from '@/prisma/seed-guard';

const E2E =
  'postgresql://insolventic_e2e:insolventic_e2e@localhost:5432/insolventic_e2e';
const NEON =
  'postgresql://neondb_owner:secret@ep-cool-1234-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_DIRECT =
  'postgresql://neondb_owner:secret@ep-cool-1234.us-east-2.aws.neon.tech/neondb?sslmode=require';

const env = (vars: Record<string, string | undefined>) =>
  vars as NodeJS.ProcessEnv;

describe('assertResetPuedeCorrer — acepta una base de prueba local', () => {
  it.each([
    ['el Postgres de e2e.yml', E2E],
    [
      'un contenedor local en otro puerto',
      'postgresql://u:p@127.0.0.1:54329/insolventic_e2e',
    ],
    ['IPv6 local', 'postgresql://u:p@[::1]:5432/insolventic_test'],
    ['base de smoke', 'postgresql://u:p@localhost:5432/smoke_db'],
  ])('%s', (_nombre, url) => {
    expect(() =>
      assertResetPuedeCorrer(env({ DATABASE_URL: url })),
    ).not.toThrow();
  });

  it('con DIRECT_URL también local y de prueba', () => {
    expect(() =>
      assertResetPuedeCorrer(env({ DATABASE_URL: E2E, DIRECT_URL: E2E })),
    ).not.toThrow();
  });
});

describe('assertResetPuedeCorrer — se niega ante cualquier otro destino', () => {
  it.each([
    ['Neon (pooler)', NEON, /no es local/],
    ['Neon (directa)', NEON_DIRECT, /no es local/],
    [
      'un host remoto aunque el nombre diga "test"',
      'postgresql://u:p@db.example.com:5432/insolventic_test',
      /no es local/,
    ],
    [
      'producción en cualquier proveedor',
      'postgresql://u:p@prod-db.internal:5432/insolventic',
      /no es local/,
    ],
    [
      'una base local de desarrollo sin nombre de prueba',
      'postgresql://u:p@localhost:5432/insolventic',
      /"insolventic"/,
    ],
    ['una URL inválida', 'no-es-una-url', /no es una URL válida/],
  ])('%s', (_nombre, url, motivo) => {
    expect(() => assertResetPuedeCorrer(env({ DATABASE_URL: url }))).toThrow(
      motivo,
    );
  });

  it('sin DATABASE_URL', () => {
    expect(() => assertResetPuedeCorrer(env({}))).toThrow(
      /DATABASE_URL no está definida/,
    );
  });

  it('DATABASE_URL local pero DIRECT_URL en Neon: se mira cada URL', () => {
    expect(() =>
      assertResetPuedeCorrer(
        env({ DATABASE_URL: E2E, DIRECT_URL: NEON_DIRECT }),
      ),
    ).toThrow(/DIRECT_URL apunta a ".*neon\.tech"/);
  });

  it.each(['1', 'true', 'TRUE'])(
    `${SEED_OPT_IN_VAR}=%s NO habilita el reset (el opt-in es solo del seed)`,
    (valor) => {
      expect(() =>
        assertResetPuedeCorrer(
          env({ DATABASE_URL: NEON, [SEED_OPT_IN_VAR]: valor }),
        ),
      ).toThrow(new RegExp(`${SEED_OPT_IN_VAR} no habilita el reset`));
    },
  );

  it('el mensaje dice que no se borró nada y no expone la contraseña', () => {
    let mensaje = '';
    try {
      assertResetPuedeCorrer(env({ DATABASE_URL: NEON }));
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toContain('Abortado sin borrar nada');
    expect(mensaje).not.toContain('secret');
  });
});

describe('reset.ts evalúa la guarda antes de borrar', () => {
  const fuente = readFileSync(
    join(__dirname, '../../../src/prisma/reset.ts'),
    'utf8',
  );
  const cuerpoDeMain = fuente.slice(fuente.indexOf('async function main()'));

  it('la guarda es lo primero que hace main(), antes de resetDatabase', () => {
    const guarda = cuerpoDeMain.indexOf('assertResetPuedeCorrer()');
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(cuerpoDeMain.indexOf('resetDatabase('));
    expect(guarda).toBeLessThan(cuerpoDeMain.indexOf('assertSeedPuedeCorrer'));
  });

  it('no hay consultas fuera de resetDatabase/main que corran al importar', () => {
    const antesDeMain = fuente.slice(
      0,
      fuente.indexOf('async function main()'),
    );
    const fueraDeResetDatabase = antesDeMain.slice(
      0,
      antesDeMain.indexOf('async function resetDatabase'),
    );
    expect(fueraDeResetDatabase).not.toMatch(/prisma\.\w+\./);
  });
});
