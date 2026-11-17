/**
 * Guarda de destino de las capturas del manual.
 *
 * El seed de capturas BORRA y recrea la base completa (`prisma db push
 * --force-reset`). Por eso solo corre contra UN destino exacto: host
 * `127.0.0.1`, puerto `54330`, base `insolventic_manual_test` (el contenedor
 * del README). Es más estricta que la guarda del seed de la app
 * (`src/prisma/seed-guard.ts`), que acepta cualquier base local con `e2e`,
 * `test` o `smoke` en el nombre: la base de desarrollo y la de los E2E en
 * 127.0.0.1:54329 cumplen eso, y no se tocan nunca.
 *
 * Lógica pura, sin Prisma: se evalúa antes de abrir cualquier conexión.
 */

export const HOST_BASE_MANUAL = '127.0.0.1';
export const PUERTO_BASE_MANUAL = '54330';
export const BASE_MANUAL = 'insolventic_manual_test';

const VARIABLES = ['DATABASE_URL', 'DIRECT_URL'] as const;

export interface DestinoBase {
  url: string;
  host: string;
  puerto: string;
  base: string;
}

function evaluar(nombre: string, valor: string): DestinoBase {
  let parsed: URL;
  try {
    parsed = new URL(valor);
  } catch {
    throw new Error(`Abortado: ${nombre} no es una URL válida.`);
  }
  const destino = {
    url: valor,
    host: parsed.hostname,
    puerto: parsed.port || '5432',
    base: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  };
  if (
    destino.host !== HOST_BASE_MANUAL ||
    destino.puerto !== PUERTO_BASE_MANUAL ||
    destino.base !== BASE_MANUAL
  ) {
    throw new Error(
      `Abortado: ${nombre} apunta a ${destino.host}:${destino.puerto}/${destino.base}. ` +
        `Las capturas solo corren contra ${HOST_BASE_MANUAL}:${PUERTO_BASE_MANUAL}/${BASE_MANUAL} ` +
        '(el seed la borra entera). Nunca producción, Preview ni la base de desarrollo.',
    );
  }
  return destino;
}

/**
 * Lanza si `DATABASE_URL` (y `DIRECT_URL`, si está definida) no apuntan
 * exactamente a 127.0.0.1:54330/insolventic_manual_test. Devuelve el destino.
 */
export function assertBaseDeCapturas(env: NodeJS.ProcessEnv): DestinoBase {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `Abortado: falta DATABASE_URL. Las capturas solo corren contra ` +
        `postgresql://…@${HOST_BASE_MANUAL}:${PUERTO_BASE_MANUAL}/${BASE_MANUAL}.`,
    );
  }
  let destino: DestinoBase | undefined;
  for (const nombre of VARIABLES) {
    const valor = env[nombre];
    if (!valor) continue;
    const d = evaluar(nombre, valor);
    if (nombre === 'DATABASE_URL') destino = d;
  }
  return destino!;
}
