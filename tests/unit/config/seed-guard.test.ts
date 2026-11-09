/**
 * Unit Tests: guarda y contraseña del seed (src/prisma/seed-guard.ts).
 *
 * Hasta 1.0.0-rc.2 el seed creaba los usuarios demo con `'123456'` (bcrypt de
 * costo 10) y llegó a correr contra producción: el repositorio es público, así
 * que quedaron cuentas reales con una contraseña publicada. Estos tests fijan
 * las dos defensas —el seed solo escribe en una base de prueba local salvo
 * opt-in, y no hay contraseña literal— y corren en la suite normal, sin base.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertSeedPuedeCorrer,
  evaluarDestinoSeed,
  generarContrasenaAleatoria,
  resolverContrasenaSeed,
  SEED_BCRYPT_COST,
  SEED_OPT_IN_VAR,
  SEED_PASSWORD_MIN_LENGTH,
} from '@/prisma/seed-guard';

const E2E =
  'postgresql://insolventic_e2e:insolventic_e2e@localhost:5432/insolventic_e2e';
const NEON =
  'postgresql://neondb_owner:secret@ep-cool-1234-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_DIRECT =
  'postgresql://neondb_owner:secret@ep-cool-1234.us-east-2.aws.neon.tech/neondb?sslmode=require';

const env = (vars: Record<string, string | undefined>) =>
  vars as NodeJS.ProcessEnv;

describe('evaluarDestinoSeed / assertSeedPuedeCorrer', () => {
  describe('acepta sin opt-in una base de prueba local', () => {
    it.each([
      ['el Postgres de e2e.yml', E2E],
      [
        'un contenedor local en otro puerto',
        'postgresql://u:p@127.0.0.1:54329/insolventic_e2e',
      ],
      ['IPv6 loopback', 'postgresql://u:p@[::1]:5432/insolventic_test'],
      ['nombre con "smoke"', 'postgresql://u:p@localhost/insolventic_smoke'],
    ])('%s', (_label, url) => {
      const e = env({ DATABASE_URL: url, DIRECT_URL: url });
      expect(evaluarDestinoSeed(e)).toEqual({ esBaseDePrueba: true });
      expect(assertSeedPuedeCorrer(e)).toEqual({ esBaseDePrueba: true });
    });
  });

  describe('aborta sin opt-in', () => {
    it.each([
      ['Neon (producción)', NEON, /no es local/],
      [
        'un host remoto con nombre de prueba',
        'postgresql://u:p@db.example.com/insolventic_test',
        /no es local/,
      ],
      [
        'localhost con un nombre que no es de prueba',
        'postgresql://u:p@localhost:5432/insolventic',
        /no contiene "e2e", "test" ni "smoke"/,
      ],
      ['una URL inválida', 'no-es-una-url', /no es una URL válida/],
    ])('%s', (_label, url, motivo) => {
      const e = env({ DATABASE_URL: url });
      expect(evaluarDestinoSeed(e).esBaseDePrueba).toBe(false);
      expect(() => assertSeedPuedeCorrer(e)).toThrow(motivo);
      expect(() => assertSeedPuedeCorrer(e)).toThrow(/Abortado/);
    });

    it('si DIRECT_URL apunta a Neon aunque DATABASE_URL sea local', () => {
      const e = env({ DATABASE_URL: E2E, DIRECT_URL: NEON_DIRECT });
      expect(() => assertSeedPuedeCorrer(e)).toThrow(/DIRECT_URL.*no es local/);
    });

    it('sin DATABASE_URL, aun con el opt-in', () => {
      expect(() => assertSeedPuedeCorrer(env({}))).toThrow(
        /necesita DATABASE_URL/,
      );
      expect(() =>
        assertSeedPuedeCorrer(env({ [SEED_OPT_IN_VAR]: '1' })),
      ).toThrow(/necesita DATABASE_URL/);
    });

    it.each(['0', 'false', 'yes', 'si', ''])(
      'con %p en el opt-in (solo valen "1" y "true")',
      (value) => {
        const e = env({ DATABASE_URL: NEON, [SEED_OPT_IN_VAR]: value });
        expect(() => assertSeedPuedeCorrer(e)).toThrow(/Abortado/);
      },
    );
  });

  describe('con opt-in explícito', () => {
    it.each(['1', 'true', 'TRUE', ' 1 '])('%p deja correr', (value) => {
      const e = env({ DATABASE_URL: NEON, [SEED_OPT_IN_VAR]: value });
      const destino = assertSeedPuedeCorrer(e);
      // Corre, pero NO como base de prueba: el seed fuerza mustChangePassword.
      expect(destino.esBaseDePrueba).toBe(false);
      expect(destino.motivo).toMatch(/no es local/);
    });
  });
});

describe('resolverContrasenaSeed', () => {
  it('usa SEED_PASSWORD si está', () => {
    expect(
      resolverContrasenaSeed(env({ SEED_PASSWORD: 'una-contrasena-larga' })),
    ).toEqual({ password: 'una-contrasena-larga', generada: false });
  });

  it.each([undefined, ''])(
    'sin SEED_PASSWORD (%p) genera una aleatoria',
    (value) => {
      const generar = jest.fn(() => 'generada-en-el-test');
      expect(
        resolverContrasenaSeed(env({ SEED_PASSWORD: value }), generar),
      ).toEqual({ password: 'generada-en-el-test', generada: true });
      expect(generar).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['123456', 'x'.repeat(SEED_PASSWORD_MIN_LENGTH - 1)])(
    'rechaza una SEED_PASSWORD corta (%p)',
    (value) => {
      expect(() =>
        resolverContrasenaSeed(env({ SEED_PASSWORD: value })),
      ).toThrow(/al menos/);
    },
  );

  it('la aleatoria es larga y distinta en cada corrida', () => {
    const a = generarContrasenaAleatoria();
    const b = generarContrasenaAleatoria();
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).not.toBe(b);
  });
});

describe('src/prisma/seed.ts no tiene contraseña literal', () => {
  const source = readFileSync(
    join(process.cwd(), 'src', 'prisma', 'seed.ts'),
    'utf8',
  );

  it('no hashea ningún string literal', () => {
    expect(source).not.toMatch(/bcrypt\.hash\(\s*['"`]/);
  });

  it('ningún campo password recibe un literal', () => {
    expect(source).not.toMatch(/password\s*:\s*['"`]/i);
  });

  it("no contiene '123456' como valor suelto", () => {
    // Las cédulas del seed (p. ej. '52123456') contienen la secuencia; lo que
    // no debe aparecer es el literal exacto.
    expect(source).not.toMatch(/['"`]123456['"`]/);
  });

  it('hashea con el costo de la aplicación (12), no con un número suelto', () => {
    expect(SEED_BCRYPT_COST).toBe(12);
    const llamadas = source.match(/bcrypt\.hash\([^)]*\)/g) ?? [];
    expect(llamadas.length).toBeGreaterThan(0);
    for (const llamada of llamadas) {
      expect(llamada).toMatch(/SEED_BCRYPT_COST/);
    }
  });

  it('corre la guarda antes de escribir y marca mustChangePassword', () => {
    expect(source).toMatch(/assertSeedPuedeCorrer\(/);
    expect(source).toMatch(/mustChangePassword: !destino\.esBaseDePrueba/);
    // Los 5 usuarios demo reciben el flag.
    expect(source.match(/^\s+mustChangePassword,$/gm)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// main() de punta a punta, con Prisma y bcrypt simulados: la guarda corre
// antes de la primera escritura y las credenciales llegan a los 5 usuarios.
// ---------------------------------------------------------------------------

jest.mock('bcrypt', () => ({
  hash: jest.fn(
    async (password: string, cost: number) => `hash(${cost}):${password}`,
  ),
}));

jest.mock('@/lib/prisma', () => {
  // Cada modelo es un proxy: cualquier método resuelve a un registro con id.
  // Lo que el seed haga después de los usuarios puede fallar con estos datos
  // de mentira; main() atrapa el error por centro y sigue, y aquí no importa.
  const calls: Array<{ model: string; method: string; args: unknown[] }> = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) =>
          jest.fn(async (...args: unknown[]) => {
            calls.push({ model: name, method, args });
            return { id: `${name}-id`, name: `${name}-name` };
          }),
      },
    );
  const client = new Proxy(
    { __calls: calls },
    {
      get: (target, prop: string) =>
        prop === '__calls'
          ? target.__calls
          : prop.startsWith('$')
            ? jest.fn(async () => undefined)
            : model(prop),
    },
  );
  return { __esModule: true, default: client };
});

describe('main() del seed', () => {
  type Call = { model: string; method: string; args: unknown[] };
  const llamadas = (): Call[] =>
    (jest.requireMock('@/lib/prisma') as { default: { __calls: Call[] } })
      .default.__calls;

  const usuariosCreados = () =>
    llamadas()
      .filter((c) => c.model === 'user' && c.method === 'upsert')
      .map(
        (c) =>
          (
            c.args[0] as {
              create: { password: string; mustChangePassword: boolean };
            }
          ).create,
      );

  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    llamadas().length = 0;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const correr = async (vars: Record<string, string>) => {
    const { main } = await import('@/prisma/seed');
    return main(env(vars));
  };

  it('contra Neon aborta sin tocar la base', async () => {
    await expect(correr({ DATABASE_URL: NEON })).rejects.toThrow(/Abortado/);
    expect(llamadas()).toHaveLength(0);
  });

  it('con una SEED_PASSWORD corta aborta sin tocar la base', async () => {
    await expect(
      correr({ DATABASE_URL: E2E, SEED_PASSWORD: '123456' }),
    ).rejects.toThrow(/al menos/);
    expect(llamadas()).toHaveLength(0);
  });

  it('en la base de prueba usa SEED_PASSWORD con costo 12 y deja entrar', async () => {
    await correr({
      DATABASE_URL: E2E,
      SEED_PASSWORD: 'contrasena-de-prueba-ci',
    });

    const usuarios = usuariosCreados();
    // 5 usuarios demo × 2 centros.
    expect(usuarios).toHaveLength(10);
    for (const u of usuarios) {
      expect(u.password).toBe('hash(12):contrasena-de-prueba-ci');
      expect(u.mustChangePassword).toBe(false);
    }
    // Una contraseña explícita no se imprime.
    const impreso = logSpy.mock.calls.flat().join('\n');
    expect(impreso).not.toContain('contrasena-de-prueba-ci');
  });

  it('sin SEED_PASSWORD genera una y la imprime una sola vez', async () => {
    await correr({ DATABASE_URL: E2E });

    const usuarios = usuariosCreados();
    expect(usuarios).toHaveLength(10);
    const hashes = new Set(usuarios.map((u) => u.password));
    expect(hashes.size).toBe(1); // la misma para todos, hasheada una vez
    const [hash] = hashes;
    const password = hash.replace(/^hash\(12\):/, '');
    expect(password.length).toBeGreaterThanOrEqual(24);

    const impresiones = logSpy.mock.calls
      .flat()
      .filter((l) => String(l).includes(password));
    expect(impresiones).toHaveLength(1);
  });

  it('con opt-in contra una base real fuerza mustChangePassword', async () => {
    await correr({
      DATABASE_URL: NEON,
      [SEED_OPT_IN_VAR]: '1',
      SEED_PASSWORD: 'contrasena-larga-de-un-solo-uso',
    });

    const usuarios = usuariosCreados();
    expect(usuarios).toHaveLength(10);
    for (const u of usuarios) {
      expect(u.mustChangePassword).toBe(true);
      expect(u.password).toBe('hash(12):contrasena-larga-de-un-solo-uso');
    }
  });
});
