/**
 * k6 Load Test — Insolventic
 *
 * Runs against a staging/local URL. Set BASE_URL via env or .env.test.
 * Usage:
 *   k6 run --env BASE_URL=https://staging.insolventic.com tests/load/k6.config.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/k6.config.js
 *
 * Scenarios:
 *   1. smoke    — 1 VU × 30s  (sanity check, default)
 *   2. average  — 10 VUs × 2m (typical concurrent users)
 *   3. peak     — 50 VUs × 1m (peak load, Black Friday / semester start)
 *
 * Activate a scenario: k6 run -e SCENARIO=average tests/load/k6.config.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ────────────────────────────────────────────────
// Custom metrics
// ────────────────────────────────────────────────
const errorRate = new Rate('http_error_rate');
const loginDuration = new Trend('login_duration_ms', true);
const casesPageDuration = new Trend('cases_page_duration_ms', true);
const reportsDuration = new Trend('reports_page_duration_ms', true);

// ────────────────────────────────────────────────
// Scenario definitions
// ────────────────────────────────────────────────
const SCENARIOS = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { scenario: 'smoke' },
  },
  average: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'average' },
  },
  peak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'peak' },
  },
};

const selectedScenario = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: {
    [selectedScenario]: SCENARIOS[selectedScenario],
  },
  thresholds: {
    // 95th percentile must be under 3s for API routes
    http_req_duration: ['p(95)<3000'],
    // Error rate below 1%
    http_error_rate: ['rate<0.01'],
    // Login p95 < 2s
    login_duration_ms: ['p(95)<2000'],
    // Cases page p95 < 3s
    cases_page_duration_ms: ['p(95)<3000'],
  },
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT = __ENV.E2E_TENANT || 'armonia';
const EMAIL = __ENV.E2E_EMAIL || 'beatriz.malavera@insolventic.com';
const PASSWORD = __ENV.E2E_PASSWORD || '123456';

function loginAndGetCookies() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD, tenant: TENANT }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    },
  );
  loginDuration.add(Date.now() - start);
  errorRate.add(res.status >= 400);

  check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: has set-cookie': (r) => !!r.headers['Set-Cookie'],
  });

  return http.cookieJar();
}

// ────────────────────────────────────────────────
// Main scenario
// ────────────────────────────────────────────────
export default function escenarioPrincipal() {
  const jar = loginAndGetCookies();

  // Cases list
  const casesStart = Date.now();
  const casesRes = http.get(`${BASE_URL}/cases?db=${TENANT}`, {
    jar,
    tags: { name: 'cases-list' },
  });
  casesPageDuration.add(Date.now() - casesStart);
  errorRate.add(casesRes.status >= 400);
  check(casesRes, { 'cases: status 200': (r) => r.status === 200 });

  sleep(1);

  // Reports
  const reportsStart = Date.now();
  const reportsRes = http.get(`${BASE_URL}/reports?db=${TENANT}`, {
    jar,
    tags: { name: 'reports' },
  });
  reportsDuration.add(Date.now() - reportsStart);
  errorRate.add(reportsRes.status >= 400);
  check(reportsRes, { 'reports: status 200': (r) => r.status === 200 });

  sleep(1);

  // Dashboard (cached, should be fast)
  const dashRes = http.get(`${BASE_URL}/dashboard?db=${TENANT}`, {
    jar,
    tags: { name: 'dashboard' },
  });
  errorRate.add(dashRes.status >= 400);
  check(dashRes, { 'dashboard: status 200': (r) => r.status === 200 });

  sleep(2);
}
