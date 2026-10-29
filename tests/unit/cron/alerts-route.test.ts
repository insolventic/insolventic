/**
 * Unit Tests — src/app/api/cron/alerts/route.ts
 *
 * These tests exercise the HTTP surface of the cron endpoint:
 *   - 503 when CRON_SECRET is unset (fail closed, don't run scans).
 *   - 401 when Authorization header is missing / malformed / wrong token.
 *   - 200 (ok=true) when the Bearer token matches, with the expected JSON shape.
 *   - Per-tenant error isolation: a failing scan doesn't break the other tenant.
 *   - Response always includes a `requestId` for log correlation.
 *   - El presupuesto de ejecución: `maxDuration` declarado y un deadline
 *     interno que corta ANTES de ese techo (O-2).
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('@/lib/email', () => ({
  emailService: {
    sendAlertEmail: jest.fn().mockResolvedValue(true),
  },
}));

// El cron reporta por el logger (único punto hacia Sentry).
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Keep the scanners under control — we don't want to re-exercise their full
// behaviour here, we just need to know the route wires them correctly.
jest.mock('@/features/notification/alerts', () => ({
  scanUpcomingHearings: jest.fn(),
  scanOverduePayments: jest.fn(),
}));

import {
  scanUpcomingHearings,
  scanOverduePayments,
} from '@/features/notification/alerts';
import { GET, POST, maxDuration } from '@/app/api/cron/alerts/route';
import { logger } from '@/lib/logger';

const mockedHearings = scanUpcomingHearings as jest.MockedFunction<
  typeof scanUpcomingHearings
>;
const mockedPayments = scanOverduePayments as jest.MockedFunction<
  typeof scanOverduePayments
>;

function req(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = token;
  return new Request('http://localhost/api/cron/alerts', { headers });
}

describe('cron alerts route', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHearings.mockResolvedValue({
      tenantId: 'armonia',
      created: 0,
      skipped: 0,
      errors: 0,
    });
    mockedPayments.mockResolvedValue({
      tenantId: 'armonia',
      created: 0,
      skipped: 0,
      errors: 0,
    });
  });

  afterAll(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(req('Bearer anything'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/CRON_SECRET/);
    expect(body.requestId).toEqual(expect.any(String));
    expect(mockedHearings).not.toHaveBeenCalled();
    expect(mockedPayments).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.requestId).toEqual(expect.any(String));
    expect(mockedHearings).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is malformed', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const res = await GET(req('not-a-bearer-token'));
    expect(res.status).toBe(401);
    expect(mockedHearings).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is wrong', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const res = await GET(req('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    expect(mockedHearings).not.toHaveBeenCalled();
  });

  it('returns 401 when tokens differ only in length (constant-time compare safe)', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    // Same prefix but shorter — timingSafeEqual requires equal lengths, our
    // helper short-circuits safely on mismatched lengths.
    const res = await GET(req('Bearer test-cron'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with the expected JSON shape on valid Bearer token', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const res = await POST(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.requestId).toEqual(expect.any(String));
    expect(typeof body.durationMs).toBe('number');
    expect(body.totalCreated).toBe(0);
    expect(body.totalErrors).toBe(0);
    expect(Array.isArray(body.hearings)).toBe(true);
    expect(Array.isArray(body.payments)).toBe(true);
    // Runs for every configured tenant (currently 2).
    expect(mockedHearings).toHaveBeenCalledTimes(2);
    expect(mockedPayments).toHaveBeenCalledTimes(2);
  });

  it('isolates per-tenant failures — one tenant failing does not break the others', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    mockedHearings
      .mockRejectedValueOnce(new Error('tenant 1 blew up'))
      .mockResolvedValueOnce({
        tenantId: 'constructores-paz',
        created: 1,
        skipped: 0,
        errors: 0,
      });

    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Failed tenant reported as errors=1, successful one passes through.
    expect(body.totalErrors).toBeGreaterThanOrEqual(1);
    expect(body.totalCreated).toBeGreaterThanOrEqual(1);
    // Both tenants were still attempted.
    expect(mockedHearings).toHaveBeenCalledTimes(2);
    expect(mockedPayments).toHaveBeenCalledTimes(2);
  });

  it('reporta por el logger el fallo de un tenant, con action, tenant y requestId', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    const boom = new Error('tenant 1 blew up');
    mockedHearings.mockRejectedValueOnce(boom).mockResolvedValueOnce({
      tenantId: 'constructores-paz',
      created: 0,
      skipped: 0,
      errors: 0,
    });

    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      boom,
      expect.objectContaining({
        action: 'cron.alerts.scanUpcomingHearings',
        tenantId: expect.any(String),
        // El mismo requestId que la respuesta, para correlacionar log y respuesta.
        requestId: body.requestId,
      }),
    );
  });
});

/**
 * O-2 — Presupuesto de ejecución.
 *
 * La ruta tenía un deadline interno de 60 s pero NO exportaba `maxDuration`,
 * así que la plataforma la cortaba en el default del plan (10 s en Hobby) y
 * nada de lo que hay después del corte existía en la práctica: ni el break por
 * `deadline`, ni el flag `timedOut`, ni la respuesta agregada que el runbook
 * manda revisar. El export es lo único que mueve ese techo, y el deadline
 * interno solo sirve si queda estrictamente por debajo de él.
 */
describe('cron alerts route — presupuesto de ejecución', () => {
  const ORIGINAL_SECRET = process.env.CRON_SECRET;
  let nowSpy: jest.SpyInstance<number, []>;
  let clock = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    clock = 0;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
    // `clearAllMocks` no borra implementaciones: las fijamos aquí para no
    // heredar la del test anterior (una que mueve el reloj lo cambiaría todo).
    mockedHearings.mockImplementation(async (_prisma, tenantId) => ({
      tenantId,
      created: 0,
      skipped: 0,
      errors: 0,
    }));
    mockedPayments.mockImplementation(async (_prisma, tenantId) => ({
      tenantId,
      created: 0,
      skipped: 0,
      errors: 0,
    }));
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  afterAll(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it('declara maxDuration = 60, el máximo del plan Hobby', () => {
    // Sin este export no hay nada que probar debajo: la función muere a los
    // 10 s. En Pro puede subir hasta 300, y entonces también sube el deadline.
    expect(maxDuration).toBe(60);
  });

  it('una corrida que ya gastó casi todo el presupuesto de la plataforma se corta sola', async () => {
    // Cada escaneo consume el techo de la plataforma menos 1 ms. Con un
    // deadline interno por debajo de ese techo, el chequeo de antes del
    // siguiente escaneo lo ve y corta. Si el deadline fuese igual al techo
    // (el bug), este chequeo no dispararía y la plataforma mataría la
    // función a mitad del escaneo siguiente, sin respuesta ni rastro.
    const step = maxDuration * 1000 - 1;
    mockedHearings.mockImplementation(async (_prisma, tenantId) => {
      clock += step;
      return { tenantId, created: 0, skipped: 0, errors: 0 };
    });
    mockedPayments.mockImplementation(async (_prisma, tenantId) => {
      clock += step;
      return { tenantId, created: 0, skipped: 0, errors: 0 };
    });

    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timedOut).toBe(true);
    expect(body.ok).toBe(false);
    // Cortó dentro del primer tenant: el segundo no se intentó.
    expect(mockedHearings).toHaveBeenCalledTimes(1);
    expect(mockedPayments).not.toHaveBeenCalled();
  });

  it('el camino normal no se marca como timedOut', async () => {
    // Mismo reloj simulado, pero escaneos que no consumen presupuesto.
    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();

    expect(body.timedOut).toBe(false);
    expect(body.ok).toBe(true);
    expect(mockedHearings).toHaveBeenCalledTimes(2);
  });
});
