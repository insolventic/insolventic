import type { Config } from 'jest';

/**
 * Tests contra Postgres REAL con el cliente de Prisma sin mockear
 * (`npm run test:db`). Se mantienen fuera de `npm test` a propósito: necesitan
 * una base de prueba viva y crean/borran filas. Corren en CI dentro de
 * e2e.yml, que ya tiene el servicio de Postgres.
 *
 * `tests/db/setup.ts` es la guarda que impide correrlos contra una base que no
 * sea local y de prueba.
 *
 * El bloque `transform` / `moduleNameMapper` es el de jest.config.ts. No se
 * importa de allí porque el cargador de config TypeScript de Jest resuelve como
 * ESM y no encuentra `./jest.config` sin extensión: si cambias uno, cambia el
 * otro.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/db'],
  testMatch: ['**/*.db.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
          module: 'commonjs',
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
        },
        diagnostics: false,
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!jose)'],
  setupFiles: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/db/setup.ts'],
  // Una sola base compartida: los archivos no pueden correr en paralelo.
  maxWorkers: 1,
  testTimeout: 60_000,
  verbose: true,
};

export default config;
