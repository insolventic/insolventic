/**
 * Unit Tests: guarda de seguridad de `npm run test:db` (tests/db/db-guard.ts).
 *
 * Los tests contra Postgres real crean y borran filas. Esta guarda es lo único
 * que impide que corran contra una base equivocada —en particular contra Neon,
 * cuyas URLs llegan al `.env` en CI vía `vercel pull`—, así que se prueba en la
 * suite normal, que corre en cada PR sin necesitar ninguna base.
 */

import { assertSafeTestDatabase } from '../../db/db-guard';

const LOCAL = 'postgresql://insolventic_e2e:insolventic_e2e@127.0.0.1:54329';

const check = (env: Record<string, string | undefined>) =>
  assertSafeTestDatabase(env as NodeJS.ProcessEnv);

describe('assertSafeTestDatabase', () => {
  describe('acepta', () => {
    it.each([
      [
        'el servicio de e2e.yml',
        'postgresql://insolventic_e2e:insolventic_e2e@localhost:5432/insolventic_e2e',
      ],
      ['un contenedor local en otro puerto', `${LOCAL}/insolventic_e2e`],
      ['IPv6 loopback', 'postgresql://u:p@[::1]:5432/insolventic_test'],
      ['nombre con "smoke"', `${LOCAL}/insolventic_smoke`],
    ])('%s', (_label, url) => {
      expect(() => check({ DATABASE_URL: url, DIRECT_URL: url })).not.toThrow();
    });
  });

  describe('rechaza', () => {
    it('la ausencia de DATABASE_URL (no hay fallback al .env)', () => {
      expect(() => check({})).toThrow(/necesita DATABASE_URL/);
    });

    it.each([
      [
        'Neon con pooler',
        'postgresql://neondb_owner:secret@ep-cool-1234-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      ],
      [
        'Neon aunque la base se llame como una de prueba',
        'postgresql://u:p@ep-cool-1234.us-east-2.aws.neon.tech/insolventic_e2e',
      ],
      ['una IP remota', 'postgresql://u:p@10.0.0.5:5432/insolventic_e2e'],
      [
        'un host que solo empieza como local',
        'postgresql://u:p@localhost.evil.com/insolventic_e2e',
      ],
    ])('un host que no es local: %s', (_label, url) => {
      expect(() => check({ DATABASE_URL: url })).toThrow(/no es local/);
    });

    it.each([
      ['neondb', `${LOCAL}/neondb`],
      ['postgres', `${LOCAL}/postgres`],
      ['insolventic_prod', `${LOCAL}/insolventic_prod`],
    ])('una base local cuyo nombre no es de prueba: %s', (_label, url) => {
      expect(() => check({ DATABASE_URL: url })).toThrow(
        /"e2e", "test" o "smoke"/,
      );
    });

    it('una DIRECT_URL insegura aunque DATABASE_URL sea correcta', () => {
      expect(() =>
        check({
          DATABASE_URL: `${LOCAL}/insolventic_e2e`,
          DIRECT_URL: 'postgresql://u:p@ep-x.aws.neon.tech/neondb',
        }),
      ).toThrow(/DIRECT_URL/);
    });

    it('una URL que no se puede parsear', () => {
      expect(() => check({ DATABASE_URL: 'esto no es una url' })).toThrow(
        /no es una URL válida/,
      );
    });
  });
});
