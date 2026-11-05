/**
 * Unit Tests: el `release` que la app le reporta a Sentry (O-1).
 *
 * Sin `withSentryConfig()` —desactivado a propósito— no hay debug ids en el
 * bundle, así que el único emparejamiento posible entre un stack trace
 * minificado y el código es el **release**: los eventos tienen que reportar
 * exactamente el mismo nombre con el que el CI subió los mapas. Si esto
 * devuelve algo distinto del SHA del commit, el dashboard sigue mostrando
 * `chunks/740-79d2c44d906524ae.js:1:48213` y nadie se entera, porque no falla
 * nada: simplemente no hay mapa.
 */

import { clientSentryRelease, serverSentryRelease } from '@/lib/sentry-release';

const SHA = '9d558229ab4c1e0f5d7a3b2c4e6f8a0b1c2d3e4f';

describe('serverSentryRelease', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa el SHA del commit que expone Vercel', () => {
    delete process.env.SENTRY_RELEASE;
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;

    expect(serverSentryRelease()).toBe(SHA);
  });

  it('SENTRY_RELEASE manda, para fijarlo a mano', () => {
    process.env.SENTRY_RELEASE = 'local-debug';
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;

    expect(serverSentryRelease()).toBe('local-debug');
  });

  it('sin ninguna de las dos devuelve undefined, no un release basura', () => {
    delete process.env.SENTRY_RELEASE;
    delete process.env.VERCEL_GIT_COMMIT_SHA;

    // `''` crearía un release sin nombre en el proyecto de Sentry y
    // `'unknown'` juntaría los errores de todos los deploys que no lo tengan.
    expect(serverSentryRelease()).toBeUndefined();
  });

  it('una variable vacía cuenta como ausente', () => {
    // Vercel define la variable vacía cuando el proyecto no expone las
    // variables de sistema; eso NO es un release.
    delete process.env.SENTRY_RELEASE;
    process.env.VERCEL_GIT_COMMIT_SHA = '';

    expect(serverSentryRelease()).toBeUndefined();
  });
});

describe('clientSentryRelease', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa la variante NEXT_PUBLIC_, que es la única que llega al navegador', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = SHA;

    expect(clientSentryRelease()).toBe(SHA);
  });

  it('no mira la variable del servidor: no estaría en el bundle', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
    delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;

    expect(clientSentryRelease()).toBeUndefined();
  });

  it('cliente y servidor coinciden cuando Vercel expone las dos', () => {
    // Es la condición de la que depende todo: si difieren, la mitad de los
    // eventos no encuentra sus mapas.
    delete process.env.SENTRY_RELEASE;
    delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = SHA;

    expect(clientSentryRelease()).toBe(serverSentryRelease());
  });
});
