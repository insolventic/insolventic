import 'dotenv/config';
import { spawn } from 'child_process';

type DatabaseKey = 'armonia' | 'constructores';

function resolveDatabaseUrl(databaseKey: DatabaseKey): string | undefined {
  if (databaseKey === 'armonia') {
    return process.env.DATABASE_URL_ARMONIA || process.env.DATABASE_URL;
  }
  if (databaseKey === 'constructores') {
    return (
      process.env.DATABASE_URL_CONSTRUCTORES_PAZ || process.env.DATABASE_URL
    );
  }
  return undefined;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

async function main() {
  const [, , databaseKeyArg, ...prismaArgs] = process.argv;

  assert(
    databaseKeyArg === 'armonia' || databaseKeyArg === 'constructores',
    'Usage: tsx src/scripts/run-prisma.ts <armonia|constructores> <prisma args...>',
  );

  const databaseKey = databaseKeyArg as DatabaseKey;
  const databaseUrl = resolveDatabaseUrl(databaseKey);

  assert(
    databaseUrl,
    `Missing environment variable for ${databaseKey}. Please set ${
      databaseKey === 'armonia'
        ? 'DATABASE_URL_ARMONIA'
        : 'DATABASE_URL_CONSTRUCTORES_PAZ'
    } (or fallback DATABASE_URL) in your .env file.`,
  );

  // Propagate env and override DATABASE_URL for Prisma
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  } as NodeJS.ProcessEnv;

  const child = spawn('npx', ['prisma', ...prismaArgs], {
    stdio: 'inherit',
    shell: true,
    env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start Prisma process:', err);
    process.exit(1);
  });
}

main();
