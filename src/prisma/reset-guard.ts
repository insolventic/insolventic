/**
 * Guarda de destino de `npm run db:reset` / `db:reset:seed`
 * (`src/prisma/reset.ts`).
 *
 * Por qué existe: el reset hace `deleteMany({})` sobre todas las tablas (o
 * sobre todas las de un centro con `--tenant=`) y no miraba a qué base estaba
 * conectado. `prisma.config.ts` carga el `.env`, que en una máquina con el
 * `.env` de Vercel tiene la URL real de Neon: un `db:reset` "suelto" vaciaba
 * la base de producción, con expedientes reales.
 *
 * El criterio de destino es el MISMO del seed y de `tests/db/db-guard.ts`
 * (`evaluarDestinoSeed`): `DATABASE_URL` y `DIRECT_URL` en localhost /
 * 127.0.0.1 / ::1 y con un nombre de base que contenga `e2e`, `test` o
 * `smoke`. Una sola regla para decidir qué base es de prueba.
 *
 * LO QUE NO SE COMPARTE CON EL SEED: el opt-in. `SEED_PERMITIR_BASE_REAL`
 * existe para poblar una base que no es de prueba, y ahí el daño está acotado
 * (las cuentas quedan con `mustChangePassword: true`). Borrar no tiene
 * mitigación posible, así que el reset no tiene salida: fuera de una base de
 * prueba local se niega siempre, también con el opt-in del seed activo —
 * justamente el caso de `db:reset:seed` contra una base real.
 *
 * Sin `'use server'` ni imports de Prisma: lógica pura, probada en
 * `tests/unit/config/reset-guard.test.ts` sin necesitar ninguna base.
 */

import { evaluarDestinoSeed, SEED_OPT_IN_VAR } from './seed-guard';

/**
 * Lanza si el reset no debe correr contra el destino configurado. Se llama
 * antes de la primera consulta.
 */
export function assertResetPuedeCorrer(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const destino = evaluarDestinoSeed(env);
  if (destino.esBaseDePrueba) return;

  throw new Error(
    `db:reset borra datos y solo corre contra una base de PRUEBA local: ${destino.motivo}. ` +
      'Abortado sin borrar nada. Ojo: prisma.config.ts carga el .env, que ' +
      'puede tener la URL real de Neon. Apuntá DATABASE_URL (y DIRECT_URL) a ' +
      'localhost con un nombre de base que contenga "e2e", "test" o "smoke". ' +
      `${SEED_OPT_IN_VAR} no habilita el reset. Ver docs/RUNBOOK.md §7.2.`,
  );
}
