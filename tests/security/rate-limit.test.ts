/**
 * Security Tests: Rate Limiting
 * Validates in-memory rate limiting protects against brute-force attacks.
 */

import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMIT_CONFIGS,
  _resetRateLimitStore,
} from '@/lib/rate-limit';

describe('Rate Limiting — src/lib/rate-limit.ts', () => {
  beforeEach(() => {
    _resetRateLimitStore();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', () => {
      const config = { windowMs: 60000, maxAttempts: 3 };
      const key = 'test:allow';

      const r1 = checkRateLimit(key, config);
      expect(r1.allowed).toBe(true);
      expect(r1.remainingAttempts).toBe(2);

      const r2 = checkRateLimit(key, config);
      expect(r2.allowed).toBe(true);
      expect(r2.remainingAttempts).toBe(1);

      const r3 = checkRateLimit(key, config);
      expect(r3.allowed).toBe(true);
      expect(r3.remainingAttempts).toBe(0);
    });

    it('should block requests exceeding the limit', () => {
      const config = { windowMs: 60000, maxAttempts: 2 };
      const key = 'test:block';

      checkRateLimit(key, config); // 1
      checkRateLimit(key, config); // 2 (limit reached)

      const blocked = checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingAttempts).toBe(0);
      expect(blocked.resetInMs).toBeGreaterThan(0);
    });

    it('should track different keys independently', () => {
      const config = { windowMs: 60000, maxAttempts: 1 };

      checkRateLimit('user:192.168.1.1', config);
      const blocked = checkRateLimit('user:192.168.1.1', config);
      expect(blocked.allowed).toBe(false);

      // Different IP should still be allowed
      const allowed = checkRateLimit('user:10.0.0.1', config);
      expect(allowed.allowed).toBe(true);
    });

    it('should reset after window expires', () => {
      const config = { windowMs: 1, maxAttempts: 1 }; // 1ms window
      const key = 'test:expire';

      checkRateLimit(key, config);

      // Wait for window to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait 5ms
      }

      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(true);
    });

    it('should return correct resetInMs value', () => {
      const config = { windowMs: 60000, maxAttempts: 1 };
      const key = 'test:resetin';

      checkRateLimit(key, config);
      const blocked = checkRateLimit(key, config);

      expect(blocked.resetInMs).toBeGreaterThan(0);
      expect(blocked.resetInMs).toBeLessThanOrEqual(60000);
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

  describe('Brute-force simulation', () => {
    it('should block login brute-force after 5 attempts', () => {
      const key = getRateLimitKey('login', '192.168.1.100');
      const config = RATE_LIMIT_CONFIGS.login;

      for (let i = 0; i < 5; i++) {
        const r = checkRateLimit(key, config);
        expect(r.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const blocked = checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
    });

    it('should block password reset abuse after 3 attempts', () => {
      const key = getRateLimitKey('forgotPassword', '192.168.1.200');
      const config = RATE_LIMIT_CONFIGS.forgotPassword;

      for (let i = 0; i < 3; i++) {
        checkRateLimit(key, config);
      }

      const blocked = checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
    });
  });
});
