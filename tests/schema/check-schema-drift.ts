/**
 * Schema Drift Check — Insolventic
 *
 * Validates that the current Prisma schema has no unapplied migrations
 * against the configured database. Designed to run as a pre-deploy gate.
 *
 * Usage (requires a real DATABASE_URL):
 *   npx ts-node tests/schema/check-schema-drift.ts
 *
 * In CI (after prisma db push / migrate deploy):
 *   npx prisma migrate diff \
 *     --from-schema-datasource src/prisma/schema.prisma \
 *     --to-schema-datamodel  src/prisma/schema.prisma \
 *     --exit-code
 *
 * Exit codes:
 *   0 — schema matches database (no drift)
 *   1 — drift detected (migrations missing or schema changed)
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

const SCHEMA_PATH = path.join(__dirname, '../../src/prisma/schema.prisma');

function run(cmd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8' });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; status?: number };
    return {
      stdout: error.stdout ?? '',
      exitCode: error.status ?? 1,
    };
  }
}

function main() {
  console.log('[schema-drift] Checking schema vs database…');

  // 1. Validate schema syntax
  const validateResult = run(`npx prisma validate --schema="${SCHEMA_PATH}"`);
  if (validateResult.exitCode !== 0) {
    console.error('[schema-drift] ❌ Schema validation failed');
    console.error(validateResult.stdout);
    process.exit(1);
  }
  console.log('[schema-drift] ✅ Schema syntax valid');

  // 2. Check for unapplied drift using prisma migrate diff
  // --from-schema-datasource reads the current DB state
  // --to-schema-datamodel reads the local schema file
  // --exit-code exits with 2 if there is a diff
  const diffResult = run(
    `npx prisma migrate diff` +
      ` --from-schema-datasource "${SCHEMA_PATH}"` +
      ` --to-schema-datamodel "${SCHEMA_PATH}"` +
      ` --exit-code`,
  );

  if (diffResult.exitCode === 0) {
    console.log('[schema-drift] ✅ No drift — database matches schema');
    process.exit(0);
  }

  if (diffResult.exitCode === 2) {
    console.error(
      '[schema-drift] ❌ Drift detected — run prisma db push or create a migration:',
    );
    console.error(diffResult.stdout);
    process.exit(1);
  }

  // Any other exit code = unexpected error
  console.error(
    '[schema-drift] ❌ Unexpected error running prisma migrate diff',
  );
  console.error(diffResult.stdout);
  process.exit(1);
}

main();
