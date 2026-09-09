/**
 * Security Tests: Rate Limiting
 *
 * Cubre los dos backends (A-2, auditoría 2026-08-25):
 *  - in-memory por instancia (fallback)
 *  - Upstash Redis (distribuido, compartido entre instancias serverless)
 * y la degradación controlada cuando Redis no está configurado o falla.
 */

// Mock de los SDK de Upstash — el módulo real se importa dinámicamente
// dentro de getLimiter(), así que jest.mock lo intercepta igual.
const mockLimit = jest.fn();
const mockRatelimitCtor = jest.fn();

jest.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    constructor(opts: unknown) {
      mockRatelimitCtor(opts);
    }
    limit = mockLimit;
    static slidingWindow = jest.fn((max: number, window: string) => ({
      kind: 'slidingWindow',
      max,
      window,
    }));
  }
  return { Ratelimit: MockRatelimit };
});

jest.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(public opts: unknown) {}
  },
}));

import {
  checkRateLimit,
  checkRateLimitInMemory,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
  _resetRateLimitStore,
} from '@/lib/rate-limit';

function enableUpstash() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
}

function disableUpstash() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

describe('Rate Limiting — src/lib/rate-limit.ts', () => {
  beforeEach(() => {
    _resetRateLimitStore();
    jest.clearAllMocks();
    disableUpstash();
  });

  afterAll(() => {
    disableUpstash();
  });

  describe('checkRateLimit — fallback in-memory (sin Upstash)', () => {
    it('should allow requests within the limit', async () => {
      const config = { windowMs: 60000, maxAttempts: 3 };
      const key = 'test:allow';

      const r1 = await checkRateLimit(key, config);
      expect(r1.allowed).toBe(true);
      expect(r1.remainingAttempts).toBe(2);

      const r2 = await checkRateLimit(key, config);
      expect(r2.allowed).toBe(true);
      expect(r2.remainingAttempts).toBe(1);

      const r3 = await checkRateLimit(key, config);
      expect(r3.allowed).toBe(true);
      expect(r3.remainingAttempts).toBe(0);
    });

    it('should block requests exceeding the limit', async () => {
      const config = { windowMs: 60000, maxAttempts: 2 };
      const key = 'test:block';

      await checkRateLimit(key, config); // 1
      await checkRateLimit(key, config); // 2 (limit reached)

      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingAttempts).toBe(0);
      expect(blocked.resetInMs).toBeGreaterThan(0);
    });

    it('should track different keys independently', async () => {
      const config = { windowMs: 60000, maxAttempts: 1 };

      await checkRateLimit('user:192.168.1.1', config);
      const blocked = await checkRateLimit('user:192.168.1.1', config);
      expect(blocked.allowed).toBe(false);

      // Different IP should still be allowed
      const allowed = await checkRateLimit('user:10.0.0.1', config);
      expect(allowed.allowed).toBe(true);
    });

    it('should reset after window expires', async () => {
      const config = { windowMs: 1, maxAttempts: 1 }; // 1ms window
      const key = 'test:expire';

      await checkRateLimit(key, config);

      // Wait for window to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait 5ms
      }

      const result = await checkRateLimit(key, config);
      expect(result.allowed).toBe(true);
    });

    it('should return correct resetInMs value', async () => {
      const config = { windowMs: 60000, maxAttempts: 1 };
      const key = 'test:resetin';

      await checkRateLimit(key, config);
      const blocked = await checkRateLimit(key, config);

      expect(blocked.resetInMs).toBeGreaterThan(0);
      expect(blocked.resetInMs).toBeLessThanOrEqual(60000);
    });

    it('marks the result as degraded (protección solo por instancia)', async () => {
      const result = await checkRateLimit('test:degraded', {
        windowMs: 60000,
        maxAttempts: 3,
      });

      expect(result.degraded).toBe(true);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe('checkRateLimit — backend distribuido (Upstash configurado)', () => {
    it('delegates the decision to Redis, not to the in-memory store', async () => {
      enableUpstash();
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 4,
        reset: Date.now() + 60_000,
      });

      const result = await checkRateLimit('login:1.2.3.4', {
        windowMs: 60000,
        maxAttempts: 5,
      });

      expect(mockLimit).toHaveBeenCalledWith('login:1.2.3.4');
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(4);
      expect(result.degraded).toBe(false);
    });

    it('blocks when Redis says the window is exhausted', async () => {
      enableUpstash();
      mockLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const result = await checkRateLimit('login:1.2.3.4', {
        windowMs: 60000,
        maxAttempts: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.resetInMs).toBeGreaterThan(0);
      expect(result.resetInMs).toBeLessThanOrEqual(30_000);
    });

    it('shares the window across instances (in-memory no lo hacía)', async () => {
      enableUpstash();
      // Redis lleva la cuenta global: la 6ª llamada ya viene bloqueada
      // aunque esta "instancia" solo haya visto una.
      mockLimit.mockResolvedValue({
        success: false,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const result = await checkRateLimit(
        getRateLimitKey('login', '9.9.9.9'),
        RATE_LIMIT_CONFIGS.login,
      );

      expect(result.allowed).toBe(false);
      expect(result.degraded).toBe(false);
    });

    it('reuses one limiter per config (no crea cliente por request)', async () => {
      enableUpstash();
      mockLimit.mockResolvedValue({
        success: true,
        remaining: 1,
        reset: Date.now() + 1000,
      });

      const config = { windowMs: 60000, maxAttempts: 5 };
      await checkRateLimit('a', config);
      await checkRateLimit('b', config);
      await checkRateLimit('c', config);

      expect(mockRatelimitCtor).toHaveBeenCalledTimes(1);
    });

    it('falls back to in-memory when Redis throws', async () => {
      enableUpstash();
      mockLimit.mockRejectedValue(new Error('ECONNREFUSED'));

      const config = { windowMs: 60000, maxAttempts: 2 };
      const key = 'test:redis-down';

      const r1 = await checkRateLimit(key, config);
      expect(r1.allowed).toBe(true);
      expect(r1.degraded).toBe(true);

      // El fallback sigue contando: se agota igual dentro de la instancia.
      await checkRateLimit(key, config);
      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('getRateLimitKey', () => {
    it('should create composite key from action and identifier', () => {
      expect(getRateLimitKey('login', '192.168.1.1')).toBe('login:192.168.1.1');
      expect(getRateLimitKey('register', '10.0.0.1')).toBe('register:10.0.0.1');
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have login config with 5 attempts / 15 min', () => {
      expect(RATE_LIMIT_CONFIGS.login.maxAttempts).toBe(5);
      expect(RATE_LIMIT_CONFIGS.login.windowMs).toBe(15 * 60 * 1000);
    });

    it('should have register config with 3 attempts / 60 min', () => {
      expect(RATE_LIMIT_CONFIGS.register.maxAttempts).toBe(3);
      expect(RATE_LIMIT_CONFIGS.register.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have forgotPassword config with 3 attempts / 15 min', () => {
      expect(RATE_LIMIT_CONFIGS.forgotPassword.maxAttempts).toBe(3);
      expect(RATE_LIMIT_CONFIGS.forgotPassword.windowMs).toBe(15 * 60 * 1000);
    });
  });

  describe('checkRateLimitInMemory — fallback expuesto', () => {
    it('always reports degraded', () => {
      const r = checkRateLimitInMemory('direct', {
        windowMs: 1000,
        maxAttempts: 1,
      });
      expect(r.allowed).toBe(true);
      expect(r.degraded).toBe(true);
    });
  });

  describe('Brute-force simulation', () => {
    it('should block login brute-force after 5 attempts', async () => {
      const key = getRateLimitKey('login', '192.168.1.100');
      const config = RATE_LIMIT_CONFIGS.login;

      for (let i = 0; i < 5; i++) {
        const r = await checkRateLimit(key, config);
        expect(r.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
    });

    it('should block password reset abuse after 3 attempts', async () => {
      const key = getRateLimitKey('forgotPassword', '192.168.1.200');
      const config = RATE_LIMIT_CONFIGS.forgotPassword;

      for (let i = 0; i < 3; i++) {
        await checkRateLimit(key, config);
      }

      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
    });
  });
});
