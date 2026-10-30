/**
 * El `release` que la app le reporta a Sentry.
 *
 * POR QUÉ EXISTE. Sin `withSentryConfig()` —desactivado a propósito, ver
 * `next.config.ts`— no hay plugin de bundler que inyecte *debug ids* en el
 * bundle y en su source map. La única forma que queda de que Sentry case un
 * stack trace minificado con el código es la clásica: **el release**. Los
 * eventos tienen que reportar exactamente el mismo nombre de release con el
 * que se subieron los mapas, o el dashboard sigue mostrando
 * `chunks/740-79d2c44d906524ae.js:1:48213` (hallazgo O-1 de
 * `docs/AUDITORIA_BLOQUE3_2026-10-27.md`).
 *
 * QUÉ SE USA COMO NOMBRE. El SHA del commit, que es lo único que identifica
 * sin ambigüedad qué código está corriendo:
 *
 *   - En el servidor, `VERCEL_GIT_COMMIT_SHA`.
 *   - En el navegador, `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, porque el valor se
 *     embute en el bundle en tiempo de build y solo las `NEXT_PUBLIC_*` llegan
 *     al cliente.
 *
 * Las dos las provee Vercel cuando el proyecto tiene activado "Automatically
 * expose System Environment Variables" — el mismo requisito que ya tiene
 * `/api/health` para decir qué commit está desplegado. Si está apagado,
 * `/api/health` devuelve `commit: 'unknown'` y esto devuelve `undefined`: el
 * SDK omite el campo y los mapas no casan. Es el primer lugar donde mirar si
 * los stack traces siguen minificados.
 *
 * `SENTRY_RELEASE` / `NEXT_PUBLIC_SENTRY_RELEASE` permiten fijarlo a mano
 * (otro hosting, un build local que se quiera depurar).
 */

/**
 * El release del lado del servidor, o `undefined` si no se puede determinar.
 *
 * `undefined` y no un string vacío ni `'unknown'`: pasarle `release: ''` al SDK
 * crearía un release sin nombre en el proyecto de Sentry, y `'unknown'` juntaría
 * en un mismo release los errores de todos los deploys que no lo tengan.
 */
export function serverSentryRelease(): string | undefined {
  return (
    process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || undefined
  );
}

/** El release del lado del navegador. Mismo criterio. */
export function clientSentryRelease(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    undefined
  );
}
