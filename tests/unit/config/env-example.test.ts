/**
 * Unit Tests: .env.example debe funcionar copiado tal cual.
 *
 * `prisma.config.ts` carga el `.env` con `dotenv/config`, y dotenv NO expande
 * `${VAR}`: una línea como `DATABASE_URL="${DATABASE_URL_ARMONIA}"` llega a la
 * CLI de Prisma (migrate, generate, seed) como el texto literal
 * "${DATABASE_URL_ARMONIA}", no como una URL. (Next.js sí expande, así que la app
 * anda y el fallo aparece solo al migrar: por eso conviene fijarlo en un test.)
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'dotenv';

const parsed = parse(
  fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8'),
);

describe('.env.example', () => {
  it('ningún valor depende de expansión ${VAR} (dotenv no la hace)', () => {
    const interpolated = Object.entries(parsed)
      .filter(([, value]) => /\$\{[^}]*\}/.test(value))
      .map(([key]) => key);

    expect(interpolated).toEqual([]);
  });

  it.each(['DATABASE_URL', 'DIRECT_URL'])(
    '%s es una URL de PostgreSQL válida tal como se copia',
    (key) => {
      expect(parsed[key]).toBeDefined();

      const url = new URL(parsed[key]);
      expect(['postgresql:', 'postgres:']).toContain(url.protocol);
    },
  );
});
