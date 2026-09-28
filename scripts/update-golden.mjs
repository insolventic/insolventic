#!/usr/bin/env node
/**
 * Regenera el golden master del mapper de placeholders
 * (tests/unit/documents/golden/). Multiplataforma: no depende de `cross-env`.
 *
 *   npm run test:golden:update
 *
 * Después revisá `git diff tests/unit/documents/golden/`: una clave por línea.
 * Ese diff es lo que se revisa en el PR; no lo commitees sin leerlo.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jest = path.join(here, '..', 'node_modules', 'jest', 'bin', 'jest.js');

const result = spawnSync(
  process.execPath,
  [jest, 'tests/unit/documents/mapper-golden.test.ts'],
  {
    stdio: 'inherit',
    env: { ...process.env, UPDATE_GOLDEN: '1' },
  },
);
process.exit(result.status ?? 1);
