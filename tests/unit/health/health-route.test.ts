/**
 * Unit Tests — src/app/api/health/route.ts (A-5, auditoría 2026-08-25).
 *
 * Contrato que consume el smoke test post-deploy:
 *   - 200 cuando la BD responde
 *   - 503 cuando no responde (para que el smoke test falle el deploy)
 *   - nunca filtra detalles de infraestructura
 */

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQueryRaw = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
}));

import { GET, HEAD } from '@/app/api/health/route';
import { logger } from '@/lib/logger';

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and status ok when the database responds', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 503 and status degraded when the database fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
  });

  it('reports a database failure to the logger (llega a Sentry)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await GET();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('base de datos'),
      expect.any(Error),
      expect.objectContaining({ action: 'health.database' }),
    );
  });

  it('never leaks infrastructure details in the response', async () => {
    mockQueryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 db-prod-armonia'),
    );

    const response = await GET();
    const raw = JSON.stringify(await response.json());

    // Ni el mensaje del driver, ni hosts, ni credenciales, ni stack.
    expect(raw).not.toContain('ECONNREFUSED');
    expect(raw).not.toContain('10.0.0.5');
    expect(raw).not.toContain('db-prod-armonia');
    expect(raw).not.toContain('postgres');
    expect(raw).not.toContain('stack');
  });

  it('is never cached', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();

    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});

describe('HEAD /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with an empty body when healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await HEAD();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('returns 503 when the database fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('down'));

    const response = await HEAD();

    expect(response.status).toBe(503);
  });
});
