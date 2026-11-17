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
import {
  esperarGeneracionesTerminadas,
  restituirUltimosAccesos,
  sembrarDocumentosDeJorge,
} from './base';
import { seccion01Ingreso } from './secciones/01-ingreso';
import { seccion03Dashboard } from './secciones/03-dashboard';
import { seccion041CrearCaso } from './secciones/04-1-crear-caso';
import {
  seccion042Listado,
  seccion0431Papelera,
  seccion044Fases,
} from './secciones/04-casos';
import { seccion06Generacion } from './secciones/06-generacion';
import { seccion08Pagos } from './secciones/08-pagos';
import { seccion10Usuarios } from './secciones/10-usuarios';

export interface Contexto {
  seed: ResultadoSeed;
  /**
   * Abre una pestaña sin sesión, en un contexto de navegador nuevo, ya
   * preparada para capturar (para las pantallas de ingreso).
   */
  nuevaPagina: () => Promise<Page>;
  /**
   * Abre una pestaña con la sesión del rol indicado, en el dashboard. Cada rol
   * tiene su propio contexto de navegador e inicia sesión UNA sola vez por
   * corrida: el login de la app admite 5 intentos cada 15 minutos por IP, y
   * no se desactiva ese límite.
   */
  paginaComo: (rol: keyof ResultadoSeed['usuarios']) => Promise<Page>;
  /**
   * Espera a que terminen las generaciones de documentos en segundo plano
   * (en local fallan por falta de Drive y notifican al terminar). Sin esto,
   * el número de la campana dependería de cuánto tardó el trabajo.
   */
  esperarGeneraciones: () => Promise<void>;
  /** Registra documentos ya generados en el caso de Jorge (enlaces inválidos). */
  sembrarDocumentosDeJorge: () => Promise<void>;
  /** Devuelve el Último acceso de los usuarios a los valores del seed. */
  restituirUltimosAccesos: () => Promise<void>;
}

type Seccion = (ctx: Contexto) => Promise<void>;

/**
 * Secciones en orden canónico (el del manual). Una corrida ejecuta las
 * pedidas más las que requieren, siempre en este orden: así el estado de la
 * base es el mismo cada vez y las figuras salen idénticas.
 */
const SECCIONES: ReadonlyArray<{
  id: string;
  ejecutar: Seccion;
  requiere?: readonly string[];
}> = [
  { id: '1', ejecutar: seccion01Ingreso },
  { id: '3', ejecutar: seccion03Dashboard },
  { id: '4.1', ejecutar: seccion041CrearCaso },
  // El listado y el cambio de fase muestran el caso de Jorge, que crea 4.1.
  { id: '4.2', ejecutar: seccion042Listado, requiere: ['4.1'] },
  { id: '4.3.1', ejecutar: seccion0431Papelera },
  { id: '4.4', ejecutar: seccion044Fases, requiere: ['4.1'] },
  // El generador usa el caso de Jorge; Usuarios cuenta sus casos asignados.
  { id: '6', ejecutar: seccion06Generacion, requiere: ['4.1'] },
  { id: '8', ejecutar: seccion08Pagos },
  { id: '10', ejecutar: seccion10Usuarios, requiere: ['4.1'] },
];
const IDS = SECCIONES.map((s) => s.id);

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
    secciones: secciones.length ? secciones : IDS,
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
  const desconocidas = secciones.filter((s) => !IDS.includes(s));
  if (desconocidas.length) {
    throw new Error(
      `Secciones sin script: ${desconocidas.join(', ')}. Disponibles: ${IDS.join(', ')}`,
    );
  }
  const pedidas = new Set(secciones);
  for (const s of SECCIONES)
    if (pedidas.has(s.id)) for (const r of s.requiere ?? []) pedidas.add(r);
  const aEjecutar = SECCIONES.filter((s) => pedidas.has(s.id));

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
    const navegador = browser;
    const contextos: BrowserContext[] = [];

    const crearContexto = async (): Promise<BrowserContext> => {
      const contexto = await navegador.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: ESCALA,
        locale: LOCALE,
        timezoneId: ZONA_HORARIA,
        colorScheme: 'light',
        reducedMotion: 'reduce',
        baseURL: URL_BASE,
      });
      await contexto.clock.setFixedTime(FECHA_ANCLA);
      contextos.push(contexto);
      return contexto;
    };
    const abrirPagina = async (contexto: BrowserContext): Promise<Page> => {
      const page = await contexto.newPage();
      page.on('load', () => void prepararPagina(page).catch(() => undefined));
      return page;
    };
    const sesiones = new Map<string, BrowserContext>();

    const ctx: Contexto = {
      seed,
      nuevaPagina: async () => abrirPagina(await crearContexto()),
      paginaComo: async (rol) => {
        let contexto = sesiones.get(rol);
        const page = await abrirPagina(
          contexto ?? (contexto = await crearContexto()),
        );
        if (sesiones.has(rol)) {
          await page.goto('/dashboard');
        } else {
          await page.goto(`/login?db=${CENTRO.slug}`);
          await page.fill('input[type="email"]', seed.usuarios[rol].email);
          await page.fill('input[type="password"]', seed.password);
          await page.click('button[type="submit"]');
          await page.waitForURL('**/dashboard');
          sesiones.set(rol, contexto);
        }
        return page;
      },
      esperarGeneraciones: () => esperarGeneracionesTerminadas(url),
      sembrarDocumentosDeJorge: () => sembrarDocumentosDeJorge(url),
      restituirUltimosAccesos: () => restituirUltimosAccesos(url),
    };

    for (const s of aEjecutar) {
      const nota = secciones.includes(s.id) ? '' : ' (requerida)';
      console.log(`› Sección ${s.id}${nota}`);
      await s.ejecutar(ctx);
    }
    for (const c of contextos) await c.close();
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
