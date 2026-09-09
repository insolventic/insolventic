/**
 * Security Tests: Content-Security-Policy (A-7, auditoría 2026-08-25).
 *
 * El bug: `connect-src` solo permitía 'self' + Google, así que el navegador
 * bloqueaba los envíos del SDK de Sentry y ningún error de frontend llegaba
 * al dashboard. La CSP debe incluir el origen de ingest derivado del DSN,
 * sin aflojar el resto de las directivas.
 */

import {
  buildContentSecurityPolicy,
  getSentryIngestOrigin,
} from '@/lib/csp';

const DSN = 'https://abc123@o4507.ingest.us.sentry.io/4508';

function directive(csp: string, name: string): string {
  const found = csp
    .split('; ')
    .find((d) => d.startsWith(name + ' ') || d === name);
  return found ?? '';
}

describe('getSentryIngestOrigin', () => {
  it('derives the ingest origin from a well-formed DSN', () => {
    expect(getSentryIngestOrigin(DSN)).toBe('https://o4507.ingest.us.sentry.io');
  });

  it('supports DSNs without a region segment', () => {
    expect(getSentryIngestOrigin('https://k@o1.ingest.sentry.io/2')).toBe(
      'https://o1.ingest.sentry.io',
    );
  });

  it('returns null for empty/undefined DSN', () => {
    expect(getSentryIngestOrigin(undefined)).toBeNull();
    expect(getSentryIngestOrigin('')).toBeNull();
  });

  it('returns null for a malformed DSN instead of throwing', () => {
    expect(getSentryIngestOrigin('not-a-url')).toBeNull();
    expect(getSentryIngestOrigin('ftp://o1.ingest.sentry.io/2')).toBeNull();
  });
});

describe('buildContentSecurityPolicy', () => {
  it('allows the Sentry ingest origin in connect-src when a DSN is set', () => {
    const csp = buildContentSecurityPolicy(DSN);

    expect(directive(csp, 'connect-src')).toContain(
      'https://o4507.ingest.us.sentry.io',
    );
  });

  it('keeps self and the Google origins in connect-src', () => {
    const connect = directive(buildContentSecurityPolicy(DSN), 'connect-src');

    expect(connect).toContain("'self'");
    expect(connect).toContain('https://drive.google.com');
    expect(connect).toContain('https://www.googleapis.com');
  });

  it('does not widen connect-src when there is no DSN', () => {
    const connect = directive(
      buildContentSecurityPolicy(undefined),
      'connect-src',
    );

    expect(connect).toBe(
      "connect-src 'self' https://drive.google.com https://www.googleapis.com",
    );
    expect(connect).not.toContain('sentry.io');
  });

  it('never allows a wildcard connect-src', () => {
    const connect = directive(buildContentSecurityPolicy(DSN), 'connect-src');
    expect(connect).not.toContain('*');
  });

  it('preserves the hardening directives', () => {
    const csp = buildContentSecurityPolicy(DSN);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(directive(csp, 'img-src')).toContain('https://drive.google.com');
  });

  it('adds the Sentry origin only to connect-src, not to script-src', () => {
    const csp = buildContentSecurityPolicy(DSN);
    expect(directive(csp, 'script-src')).not.toContain('sentry.io');
    expect(directive(csp, 'default-src')).not.toContain('sentry.io');
  });
});
