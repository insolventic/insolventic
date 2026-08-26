import type { NextConfig } from 'next';

import { buildContentSecurityPolicy } from './src/lib/csp';

const nextConfig: NextConfig = {
  // @opentelemetry/api is reached via observability.ts's dynamic
  // `import('@sentry/nextjs')`; without withSentryConfig() wiring up file
  // tracing for it, @vercel/nft misses one of its internal files
  // (build/src/api/context.js) when packaging serverless functions, which
  // fails the Vercel deploy with ENOENT. Externalizing it makes Next.js
  // resolve it from node_modules at runtime instead of trying to trace it.
  serverExternalPackages: ['@opentelemetry/api'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // connect-src incluye el origen de ingest de Sentry derivado
            // del DSN — sin él el navegador bloquea los envíos (A-7).
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
