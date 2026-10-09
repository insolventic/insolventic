/**
 * El historial de migraciones se puede replayear desde cero.
 *
 * POR QUÉ EXISTE. Nada verificaba esto. `e2e.yml` usa `prisma db push`, que
 * aplica el schema actual de una y NUNCA ejecuta las migraciones; `test:db`
 * corre sobre una base que ya tiene el schema pusheado. El resultado es que el
 * historial podía estar roto durante semanas sin que ningún check lo notara —
 * y lo estaba: `20260928010000_add_process_type_other_and_court_email` hacía
 * `ALTER TABLE "procesos_judiciales"` sobre una tabla que NINGUNA migración
 * crea (existía en producción porque un `db push` la había creado, nunca
 * capturado en una migración; se dropeó el 2026-10-02). Desde una base vacía,
 * la cadena moría ahí con `P3018 / relation does not exist`.
 *
 * Esto importa en dos escenarios reales, los dos fuera del camino feliz:
 * restaurar un backup a una base nueva (A-4, que sigue sin probarse) y levantar
 * un entorno desde cero.
 *
 * DOS DIRECCIONES, igual que `pendientes-conocidos.ts`: el test falla si la
 * cadena se rompe, y TAMBIÉN si la brecha de schema cambia de tamaño sin que
 * alguien actualice el inventario de abajo. Si se cierra la brecha, falla por
 * "ya no está roto"; si aparece deriva nueva, falla por "apareció algo".
 */

import { execFileSync } from 'child_process';
import prisma from '@/lib/prisma';

/**
 * Lo que el replay desde cero NO reconstruye hoy, medido el 2026-10-08.
 *
 * Son objetos que viven en `schema.prisma` y en la base real (los creó algún
 * `db push`) pero que ninguna migración crea. Misma clase de deriva que el
 * incidente de las 29 columnas `apoyo_*` (`CHECKPOINT_2026-09-09.md` §8), vista
 * desde el otro lado.
 *
 * Cerrar esta brecha NO se puede hacer sin decidir entre dos caminos, y los dos
 * necesitan acceso a Neon (fuera de alcance de este PR):
 *  - una migración de catch-up idempotente (IF NOT EXISTS en todo), que sea
 *    no-op en producción y rellene desde cero; o
 *  - un baseline/squash del historial, que es lo que Prisma recomienda para
 *    exactamente esta situación, y requiere `migrate resolve --applied`.
 *
 * Mientras tanto, este inventario deja la brecha medida en vez de intuida.
 */
const BRECHA_CONOCIDA = {
  tablasFaltantes: ['ConciliationCenter', 'audit_logs', 'payments'],
  statements: 30,
};

/** Nombre único por corrida: los tests no se pisan entre sí. */
const DB_REPLAY = `replay_${Date.now().toString(36)}`;

function urlConBase(base: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${base}`;
  return url.toString();
}

/**
 * Corre un comando de Prisma apuntando a la base del replay.
 *
 * Invoca el binario por `node` en vez de `npx`: `npx` en Windows necesita
 * `shell: true`, que concatena los argumentos sin escaparlos (DEP0190) y además
 * falla en esta máquina por el PATH con comillas (ver `.husky/pre-commit`).
 */
function prismaEnLaBaseDelReplay(args: string[]): string {
  return execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), ...args],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: urlConBase(DB_REPLAY),
        DIRECT_URL: urlConBase(DB_REPLAY),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

beforeAll(async () => {
  // `CREATE DATABASE` no corre dentro de una transacción, así que va por raw.
  await prisma.$executeRawUnsafe(`CREATE DATABASE "${DB_REPLAY}"`);
}, 60_000);

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB_REPLAY}"`);
  await prisma.$disconnect();
});

describe('replay del historial de migraciones contra una base vacía', () => {
  it('la cadena completa se aplica sin errores', () => {
    // Antes del fix de `ALTER TABLE IF EXISTS`, esto moría con P3018 en
    // 20260928010000 y las migraciones posteriores no llegaban a correr.
    const salida = prismaEnLaBaseDelReplay(['migrate', 'deploy']);
    expect(salida).toContain('All migrations have been successfully applied');
  }, 180_000);

  it('la brecha contra schema.prisma es exactamente la conocida', () => {
    // `migrate diff` emite el SQL que falta para llegar de la base replayeada
    // al schema actual. Vacío sería lo ideal; hoy no lo es, y el tamaño exacto
    // es el que está inventariado arriba.
    const sql = prismaEnLaBaseDelReplay([
      'migrate',
      'diff',
      '--from-url',
      urlConBase(DB_REPLAY),
      '--to-schema-datamodel',
      'src/prisma/schema.prisma',
      '--script',
    ]);

    const tablasFaltantes = [
      ...sql.matchAll(/CREATE TABLE "([^"]+)"/g),
    ]
      .map((m) => m[1])
      .sort();
    const statements = (sql.match(/^--/gm) ?? []).length;

    expect(tablasFaltantes).toEqual(
      [...BRECHA_CONOCIDA.tablasFaltantes].sort(),
    );
    expect(statements).toBe(BRECHA_CONOCIDA.statements);
  }, 180_000);
});
