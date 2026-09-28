import type { NextConfig } from 'next';

import { buildContentSecurityPolicy } from './src/lib/csp';

/** Ver el comentario de la clave `webpack` más abajo. */
const ignoreOptionalEncodingRequire: NonNullable<NextConfig['webpack']> = (
  config,
  { webpack },
) => {
  config.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /^encoding$/,
      contextRegExp: /html-to-docx[\\/]dist$/,
    }),
  );
  return config;
};

const nextConfig: NextConfig = {
  // @opentelemetry/api is reached via observability.ts's dynamic
  // `import('@sentry/nextjs')`; without withSentryConfig() wiring up file
  // tracing for it, @vercel/nft misses one of its internal files
  // (build/src/api/context.js) when packaging serverless functions, which
  // fails the Vercel deploy with ENOENT. Externalizing it makes Next.js
  // resolve it from node_modules at runtime instead of trying to trace it.
  serverExternalPackages: ['@opentelemetry/api'],

  // `next build` avisaba en cada corrida:
  //   Module not found: Can't resolve 'encoding'
  //   ./node_modules/html-to-docx/dist/html-to-docx.esm.js
  //
  // Es inocuo y se silencia sin instalar nada. html-to-docx publica un dist ya
  // empaquetado que trae node-fetch@2 inlineado, y node-fetch@2 hace
  //   try { convert = require('encoding').convert } catch (e) {}
  // porque `encoding` es una peer dependency OPCIONAL. Webpack ve ese require
  // estático y avisa aunque esté dentro de un try/catch.
  // `encoding` solo lo usa node-fetch en textConverted() (conversión de charset
  // de la respuesta); html-to-docx únicamente descarga imágenes remotas con
  // `response.buffer()`, así que jamás se ejecuta. Instalarlo sumaría un paquete
  // sin ningún efecto.
  //
  // IgnorePlugin conserva el comportamiento de runtime: sin el módulo, webpack ya
  // generaba un `throw` MODULE_NOT_FOUND que ese try/catch traga. Solo se acota
  // a ESE require (contexto html-to-docx/dist): cualquier otro módulo faltante
  // seguirá avisando.
  //
  // Solo se declara bajo webpack (`next build`, lo que corre Vercel): Turbopack
  // (`next dev --turbopack`) no emite ese aviso, y con la clave `webpack`
  // presente Next imprimiría "Webpack is configured while Turbopack is not".
  // Next fija process.env.TURBOPACK antes de cargar esta config.
  webpack: process.env.TURBOPACK ? undefined : ignoreOptionalEncodingRequire,

  // ===========================================================================
  // ⛔ NUNCA CONFIGURAR `CI_SKIP_BUILD_TYPECHECK` EN VERCEL. ⛔
  //
  // QUÉ HACE
  // Desactiva la comprobación de tipos y de ESLint que `next build` ejecuta
  // como parte del build. NADA MÁS: el bundling y la validación de sintaxis
  // siguen corriendo igual.
  //
  // POR QUÉ EXISTE
  // El type-check de este proyecto necesita >2 GB de heap: `tsc` instancia
  // ~277.000 tipos, de los cuales ~22% vienen del cliente generado de Prisma
  // (el modelo `Case` tiene 283 campos, y Prisma genera Select/Include/Where/
  // Create/Update con esa aridad). El worker de `next build` en los runners de
  // GitHub Actions se queda en ~2050 MB y moría con
  // "FATAL ERROR: Ineffective mark-compacts near heap limit".
  // Medido: el build sin type-check cabe en 1024 MB; con él necesita >2048.
  //
  // En CI esa comprobación es REDUNDANTE: el job `quality-checks` de
  // .github/workflows/pr.yml ya corre `npx tsc --noEmit` sobre el mismo commit
  // en un step propio, y ese step sí bloquea el merge. Aquí solo se evita
  // pagarla dos veces.
  //
  // EN VERCEL SERÍA UN AGUJERO
  // Vercel es el único sitio donde se compila lo que llega a producción, y ahí
  // NO hay un `tsc --noEmit` previo que haga de red. Si esta variable se
  // definiera en Vercel, un error de tipos llegaría a producción sin que nada
  // lo detuviera.
  //
  // DOBLE CANDADO — y por qué la comparación es contra el string 'true'
  // Se exigen DOS condiciones. La segunda es la que protege de un despiste:
  //   - GitHub Actions define CI='true' (string exacto).
  //   - Vercel define CI='1' cuando el proyecto tiene activado "Automatically
  //     expose System Environment Variables".
  // La comparación es ESTRICTA contra 'true', así que en Vercel es false
  // aunque alguien añadiera CI_SKIP_BUILD_TYPECHECK por error.
  //
  // ⚠️ NO relajar esta comparación. Cambiar `=== 'true'` por algo como
  // `Boolean(process.env.CI)` o `!= null` haría que el candado dejara de
  // funcionar en Vercel y degradaría los dos candados a uno solo.
  // ===========================================================================
  typescript: {
    ignoreBuildErrors:
      process.env.CI === 'true' && process.env.CI_SKIP_BUILD_TYPECHECK === '1',
  },
  eslint: {
    ignoreDuringBuilds:
      process.env.CI === 'true' && process.env.CI_SKIP_BUILD_TYPECHECK === '1',
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // connect-src incluye el origen de ingest de Sentry derivado
            // del DSN — sin él el navegador bloquea los envíos (A-7).
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
