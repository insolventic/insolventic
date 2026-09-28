/**
 * Guarda de seguridad de los tests contra Postgres REAL (`npm run test:db`).
 *
 * Estos tests CREAN y BORRAN filas. `tests/db/setup.ts` la ejecuta como
 * `setupFiles`, antes de que se importe el cliente de Prisma, y aborta si `DATABASE_URL` no apunta
 * inequívocamente a una base de prueba local:
 *
 *  - Sin `DATABASE_URL` explícita se aborta. No hay fallback: el cliente de
 *    Prisma cargaría el `.env`, y en CI (pr.yml) ese `.env` es el de Vercel con
 *    la URL real de Neon.
 *  - El host debe ser localhost / 127.0.0.1 / ::1.
 *  - El nombre de la base debe contener `e2e`, `test` o `smoke`.
 *
 * Si algo de esto no se cumple es un error de configuración, no algo que haya
 * que "saltarse": el test no debe correr.
 */

const SAFE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SAFE_DB_NAME = /(e2e|test|smoke)/i;

export function assertSafeTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const variables = ['DATABASE_URL', 'DIRECT_URL'] as const;

  const raw = env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'test:db necesita DATABASE_URL apuntando a una base de PRUEBA local ' +
        '(p. ej. postgresql://insolventic_e2e:insolventic_e2e@127.0.0.1:54329/insolventic_e2e). ' +
        'No se usa el .env a propósito. Ver docs/TESTS.md.',
    );
  }

  for (const name of variables) {
    const value = env[name];
    if (!value) continue;

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} no es una URL válida; test:db aborta.`);
    }

    if (!SAFE_HOSTS.has(url.hostname)) {
      throw new Error(
        `${name} apunta a "${url.hostname}", que no es local. test:db borra ` +
          'datos y solo corre contra localhost/127.0.0.1. Abortado.',
      );
    }

    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!SAFE_DB_NAME.test(dbName)) {
      throw new Error(
        `${name} apunta a la base "${dbName}": su nombre debe contener ` +
          '"e2e", "test" o "smoke". Abortado.',
      );
    }
  }
}
