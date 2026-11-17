/**
 * Genera las figuras del manual de usuario.
 *
 *   npx tsx scripts/manual-capturas/capturar.ts [--seccion 4.1] [--build]
 *
 * Ver README.md en esta carpeta. Resumen del flujo:
 *  1. Guarda: aborta si DATABASE_URL no es localhost/insolventic_manual_test.
 *  2. Seed: recrea la base y siembra los datos sintéticos (seed.ts).
 *  3. Servidor: `next start` en el puerto 3100 con el build de producción
 *     (sin overlay de desarrollo ni botones de solo-desarrollo) y con todas las
 *     integraciones externas apagadas: credenciales de Drive, Sentry, SMTP y
 *     Upstash vacías, y un proxy inexistente para cualquier salida HTTP.
 *  4. Navegador: Chromium sin interfaz, 1440×900 a escala 2, es-CO,
 *     America/Bogota, tema claro, movimiento reducido y reloj congelado en la
 *     fecha ancla.
 *  5. Secciones: cada una captura y anota sus figuras.
 */

import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import { prepararPagina } from './anotaciones';
import {
  CENTRO,
  ESCALA,
  FECHA_ANCLA,
  LOCALE,
  PUERTO,
  RAIZ_REPO,
  URL_BASE,
  VIEWPORT,
  ZONA_HORARIA,
} from './config';
import { assertBaseDeCapturas } from './guarda-base';
import { sembrar, type ResultadoSeed } from './seed';
import { seccion041CrearCaso } from './secciones/04-1-crear-caso';

export interface Contexto {
  contexto: BrowserContext;
  seed: ResultadoSeed;
  /** Abre una pestaña nueva ya preparada para capturar. */
  nuevaPagina: () => Promise<Page>;
  /** Inicia sesión como el usuario del rol indicado y espera el dashboard. */
  iniciarSesion: (
    page: Page,
    rol: keyof ResultadoSeed['usuarios'],
  ) => Promise<void>;
}

type Seccion = (ctx: Contexto) => Promise<void>;

const SECCIONES: Record<string, Seccion> = {
  '4.1': seccion041CrearCaso,
};

/** CLI de Next invocado con este mismo `node`: sin shell ni `npx`. */
const NEXT_CLI = path.join(
  RAIZ_REPO,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

function argumentos(): { secciones: string[]; build: boolean } {
  const args = process.argv.slice(2);
  const secciones: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seccion' && args[i + 1])
      secciones.push(...args[++i].split(','));
  }
  return {
    secciones: secciones.length ? secciones : Object.keys(SECCIONES),
    build: args.includes('--build'),
  };
}

/** Entorno del servidor: base de capturas y ninguna integración externa. */
function entornoServidor(url: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    TZ: ZONA_HORARIA,
    DATABASE_URL: url,
    DIRECT_URL: url,
    JWT_SECRET: randomBytes(32).toString('base64url'),
    APP_URL: URL_BASE,
    NEXTAUTH_URL: URL_BASE,
    GOOGLE_DRIVE_CLIENT_ID: '',
    GOOGLE_DRIVE_CLIENT_SECRET: '',
    GOOGLE_DRIVE_FOLDER_ID: '',
    GOOGLE_DRIVE_REDIRECT_URI: '',
    GOOGLE_DRIVE_REFRESH_TOKEN: '',
    SENTRY_DSN: '',
    NEXT_PUBLIC_SENTRY_DSN: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    CRON_SECRET: '',
    ALERTS_EMAIL_ENABLED: 'false',
    // Cualquier salida HTTP(S) del servidor va a un puerto cerrado.
    HTTP_PROXY: 'http://127.0.0.1:9',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: 'localhost,127.0.0.1,::1',
  };
}

async function esperarServidor(servidor: ChildProcess): Promise<void> {
  const limite = Date.now() + 120_000;
  while (Date.now() < limite) {
    if (servidor.exitCode !== null)
      throw new Error('El servidor terminó antes de quedar listo.');
    try {
      const r = await fetch(`${URL_BASE}/login`);
      if (r.ok) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`El servidor no respondió en ${URL_BASE} en 120 s.`);
}

async function main(): Promise<void> {
  const { secciones, build } = argumentos();
  const desconocidas = secciones.filter((s) => !SECCIONES[s]);
  if (desconocidas.length) {
    throw new Error(
      `Secciones sin script: ${desconocidas.join(', ')}. Disponibles: ${Object.keys(SECCIONES).join(', ')}`,
    );
  }

  const { url } = assertBaseDeCapturas(process.env);
  const env = entornoServidor(url);

  if (build) {
    execFileSync(process.execPath, [NEXT_CLI, 'build'], {
      cwd: RAIZ_REPO,
      env,
      stdio: 'inherit',
    });
  } else if (!existsSync(path.join(RAIZ_REPO, '.next', 'BUILD_ID'))) {
    throw new Error(
      'No hay build de producción. Correr con --build (o `npm run build`).',
    );
  }

  console.log('› Recreando la base de capturas…');
  const seed = await sembrar(process.env);

  console.log(`› Levantando la app en ${URL_BASE}…`);
  // El log de la app va a un archivo: en local registra, como es de esperar,
  // los fallos de Drive y SMTP (no hay credenciales) y ensuciaría la consola.
  const rutaLog = path.join(tmpdir(), 'manual-capturas-app.log');
  const log = openSync(rutaLog, 'w');
  console.log(`  (log de la app: ${rutaLog})`);
  const servidor = spawn(
    process.execPath,
    [NEXT_CLI, 'start', '-p', String(PUERTO)],
    {
      cwd: RAIZ_REPO,
      env,
      stdio: ['ignore', log, log],
    },
  );

  let browser: Browser | undefined;
  try {
    await esperarServidor(servidor);

    // --lang: los campos de fecha nativos muestran dd/mm/aaaa, no dd/mm/yyyy.
    browser = await chromium.launch({ args: [`--lang=${LOCALE}`] });
    const contexto = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: ESCALA,
      locale: LOCALE,
      timezoneId: ZONA_HORARIA,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      baseURL: URL_BASE,
    });
    await contexto.clock.setFixedTime(FECHA_ANCLA);

    const ctx: Contexto = {
      contexto,
      seed,
      nuevaPagina: async () => {
        const page = await contexto.newPage();
        page.on('load', () => void prepararPagina(page).catch(() => undefined));
        return page;
      },
      iniciarSesion: async (page, rol) => {
        await page.goto(`/login?db=${CENTRO.slug}`);
        await page.fill('input[type="email"]', seed.usuarios[rol].email);
        await page.fill('input[type="password"]', seed.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
      },
    };

    for (const s of secciones) {
      console.log(`› Sección ${s}`);
      await SECCIONES[s](ctx);
    }
    console.log('✓ Figuras generadas en docs/manual-usuario/img/');
  } finally {
    await browser?.close();
    if (process.platform === 'win32' && servidor.pid) {
      execFileSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      servidor.kill('SIGTERM');
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
