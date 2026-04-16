/**
 * Unit Tests — src/app/api/cron/alerts/route.ts
 *
 * These tests exercise the HTTP surface of the cron endpoint:
 *   - 503 when CRON_SECRET is unset (fail closed, don't run scans).
 *   - 401 when Authorization header is missing / malformed / wrong token.
 *   - 200 (ok=true) when the Bearer token matches, with the expected JSON shape.
 *   - Per-tenant error isolation: a failing scan doesn't break the other tenant.
 *   - Response always includes a `requestId` for log correlation.
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('@/lib/email', () => ({
  emailService: {
    sendAlertEmail: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/lib/observability', () => ({
  reportError: jest.fn().mockResolvedValue(undefined),
  reportMessage: jest.fn().mockResolvedValue(undefined),
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
import { GET, POST } from '@/app/api/cron/alerts/route';

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
});
