/**
 * Guarda y contraseña del seed (`src/prisma/seed.ts`).
 *
 * Por qué existe: hasta 1.0.0-rc.2 el seed creaba los 5 usuarios demo con la
 * contraseña literal `'123456'` (bcrypt de costo 10), el repositorio es
 * público, y el seed llegó a correr contra la base de producción: quedaron
 * cuentas reales con una contraseña publicada. Este módulo impide las dos
 * cosas:
 *
 *  1. **Destino.** El seed aborta si `DATABASE_URL`/`DIRECT_URL` no apuntan
 *     inequívocamente a una base de PRUEBA local, con el mismo criterio que
 *     `tests/db/db-guard.ts`: host localhost / 127.0.0.1 / ::1 y nombre de base
 *     con `e2e`, `test` o `smoke`. Ojo: `prisma.config.ts` carga el `.env`, así
 *     que sin esta guarda un `npm run db:seed` en una máquina con el `.env` de
 *     Vercel escribe en Neon. La única salida es un opt-in explícito
 *     (`SEED_PERMITIR_BASE_REAL=1`), y aun así las cuentas quedan con
 *     `mustChangePassword: true`, o sea inutilizables hasta que alguien pase
 *     por "¿Olvidaste tu contraseña?".
 *  2. **Contraseña.** No hay literal: se lee de `SEED_PASSWORD` y, si falta, se
 *     genera una aleatoria que el seed imprime una sola vez. Costo 12, el de la
 *     aplicación.
 *
 * Sin `'use server'` ni imports de Prisma: es lógica pura, probada en
 * `tests/unit/config/seed-guard.test.ts` sin necesitar ninguna base.
 */

import { randomBytes } from 'node:crypto';

/** El mismo costo que usa la aplicación al crear o cambiar contraseñas. */
export const SEED_BCRYPT_COST = 12;

/** Opt-in para correr el seed contra una base que no es de prueba local. */
export const SEED_OPT_IN_VAR = 'SEED_PERMITIR_BASE_REAL';

/** Contraseña de los usuarios demo; si falta, se genera una aleatoria. */
export const SEED_PASSWORD_VAR = 'SEED_PASSWORD';

/** Mínimo para una `SEED_PASSWORD` explícita: evita repetir el `123456`. */
export const SEED_PASSWORD_MIN_LENGTH = 12;

const SAFE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SAFE_DB_NAME = /(e2e|test|smoke)/i;
const URL_VARS = ['DATABASE_URL', 'DIRECT_URL'] as const;

export interface DestinoSeed {
  /** `true` si todas las URLs apuntan a una base de prueba local. */
  esBaseDePrueba: boolean;
  /** Por qué no es de prueba (solo si `esBaseDePrueba` es `false`). */
  motivo?: string;
}

/**
 * Evalúa a qué base escribiría el seed. No lanza: devuelve el veredicto y, si
 * no es una base de prueba, el motivo.
 */
export function evaluarDestinoSeed(
  env: NodeJS.ProcessEnv = process.env,
): DestinoSeed {
  if (!env.DATABASE_URL) {
    return { esBaseDePrueba: false, motivo: 'DATABASE_URL no está definida' };
  }

  for (const name of URL_VARS) {
    const value = env[name];
    if (!value) continue;

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return { esBaseDePrueba: false, motivo: `${name} no es una URL válida` };
    }

    if (!SAFE_HOSTS.has(url.hostname)) {
      return {
        esBaseDePrueba: false,
        motivo: `${name} apunta a "${url.hostname}", que no es local`,
      };
    }

    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!SAFE_DB_NAME.test(dbName)) {
      return {
        esBaseDePrueba: false,
        motivo: `${name} apunta a la base "${dbName}", cuyo nombre no contiene "e2e", "test" ni "smoke"`,
      };
    }
  }

  return { esBaseDePrueba: true };
}

function optInActivo(env: NodeJS.ProcessEnv): boolean {
  const value = env[SEED_OPT_IN_VAR]?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/**
 * Aborta (lanza) si el seed no debe correr contra el destino configurado.
 * Devuelve el destino evaluado para que el seed decida `mustChangePassword`.
 */
export function assertSeedPuedeCorrer(
  env: NodeJS.ProcessEnv = process.env,
): DestinoSeed {
  const destino = evaluarDestinoSeed(env);
  if (destino.esBaseDePrueba) return destino;

  if (!env.DATABASE_URL) {
    // Sin URL no hay nada que habilitar: el opt-in no aplica.
    throw new Error(
      'El seed necesita DATABASE_URL. Abortado sin escribir nada.',
    );
  }

  if (optInActivo(env)) return destino;

  throw new Error(
    `El seed solo corre contra una base de PRUEBA local: ${destino.motivo}. ` +
      'Abortado sin escribir nada. Ojo: prisma.config.ts carga el .env, que ' +
      'puede tener la URL real de Neon. Para una base de prueba, apuntá ' +
      'DATABASE_URL (y DIRECT_URL) a localhost con un nombre que contenga ' +
      `"e2e", "test" o "smoke". Si de verdad querés escribir en otra base, ` +
      `${SEED_OPT_IN_VAR}=1 (las cuentas quedan con mustChangePassword: true). ` +
      'Ver docs/RUNBOOK.md §7.2.',
  );
}

export interface ContrasenaSeed {
  password: string;
  /** `true` si no vino de `SEED_PASSWORD` y se generó en esta corrida. */
  generada: boolean;
}

/** 18 bytes → 24 caracteres base64url (~144 bits). */
export function generarContrasenaAleatoria(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * Contraseña de los usuarios demo: `SEED_PASSWORD` si está, o una aleatoria.
 * Una `SEED_PASSWORD` explícita más corta que `SEED_PASSWORD_MIN_LENGTH` se
 * rechaza.
 */
export function resolverContrasenaSeed(
  env: NodeJS.ProcessEnv = process.env,
  generar: () => string = generarContrasenaAleatoria,
): ContrasenaSeed {
  const explicita = env[SEED_PASSWORD_VAR];
  if (explicita !== undefined && explicita !== '') {
    if (explicita.length < SEED_PASSWORD_MIN_LENGTH) {
      throw new Error(
        `${SEED_PASSWORD_VAR} debe tener al menos ${SEED_PASSWORD_MIN_LENGTH} ` +
          'caracteres. Abortado sin escribir nada.',
      );
    }
    return { password: explicita, generada: false };
  }
  return { password: generar(), generada: true };
}
