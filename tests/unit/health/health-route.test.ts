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

/** Request sin header de detalle (el caso público). */
function publicRequest(): Request {
  return new Request('http://localhost:3000/api/health');
}

/** Request con el header de detalle. */
function requestWithToken(token: string): Request {
  return new Request('http://localhost:3000/api/health', {
    headers: { 'x-health-token': token },
  });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and status ok when the database responds', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET(publicRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns 503 and status degraded when the database fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET(publicRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
  });

  it('reports a database failure to the logger (llega a Sentry)', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await GET(publicRequest());

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

    const response = await GET(publicRequest());
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

    const response = await GET(publicRequest());

    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});

describe('GET /api/health — detalle del deploy (gateado por header)', () => {
  const TOKEN = 'secreto-de-health-para-tests';

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    process.env.HEALTH_DETAILS_TOKEN = TOKEN;
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456';
    process.env.VERCEL_GIT_COMMIT_REF = 'dev';
    process.env.VERCEL_ENV = 'preview';
  });

  afterEach(() => {
    delete process.env.HEALTH_DETAILS_TOKEN;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    delete process.env.VERCEL_ENV;
  });

  it('never exposes the deployed commit to an anonymous request', async () => {
    const response = await GET(publicRequest());
    const body = await response.json();

    expect(body.deployment).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('abc123def456');
  });

  it('returns commit, branch and version with a valid token', async () => {
    const response = await GET(requestWithToken(TOKEN));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deployment.commit).toBe('abc123def456');
    expect(body.deployment.branch).toBe('dev');
    expect(body.deployment.deploymentEnv).toBe('preview');
    expect(body.deployment.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('rejects a wrong token of the same length (sin filtrar por timing)', async () => {
    const wrong = 'x'.repeat(TOKEN.length);
    const response = await GET(requestWithToken(wrong));
    const body = await response.json();

    expect(body.deployment).toBeUndefined();
  });

  it('rejects a token of a different length', async () => {
    const response = await GET(requestWithToken('corto'));
    const body = await response.json();

    expect(body.deployment).toBeUndefined();
  });

  it('fails closed when HEALTH_DETAILS_TOKEN is not configured', async () => {
    delete process.env.HEALTH_DETAILS_TOKEN;

    // Aun mandando un header, sin secreto configurado no se expone nada:
    // un token vacío en el server no debe volver todo público.
    const response = await GET(requestWithToken(''));
    const body = await response.json();

    expect(body.deployment).toBeUndefined();
  });

  it('keeps serving the health contract when details are requested', async () => {
    const response = await GET(requestWithToken(TOKEN));
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
  });

  it('reports the deployment as unknown when Vercel vars are absent', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_REF;

    const response = await GET(requestWithToken(TOKEN));
    const body = await response.json();

    expect(body.deployment.commit).toBe('unknown');
    expect(body.deployment.branch).toBe('unknown');
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
