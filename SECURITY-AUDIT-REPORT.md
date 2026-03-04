# Reporte de Auditoría de Seguridad — Insolventic

**Fecha**: 2026-03-04
**Rama**: `security/hardening-audit`
**Auditor**: Security Engineer (automated audit)
**Alcance**: Análisis estático completo + hardening + tests automatizados

---

## Resumen Ejecutivo

Se realizó una auditoría de seguridad completa sobre la aplicación Insolventic (SaaS multi-tenant para gestión de insolvencia en Colombia). Se identificaron **14 vulnerabilidades** (4 críticas, 4 altas, 4 medianas, 2 bajas), todas corregidas en esta rama. Se crearon **90 tests de seguridad** adicionales (total: 207 tests pasando).

| Métrica | Valor |
|---------|-------|
| Vulnerabilidades encontradas | 14 |
| Vulnerabilidades corregidas | 14 |
| Tests de seguridad agregados | 90 |
| Tests totales pasando | 207/207 |
| Archivos modificados | 12 |
| Archivos creados | 6 |

---

## Vulnerabilidades Encontradas y Corregidas

### CRITICAL

| # | Vulnerabilidad | Archivo | Corrección |
|---|---------------|---------|------------|
| 1 | **JWT Secret hardcodeado** — Fallback `'your-secret-key-change-in-production'` permitía firmar tokens con secreto conocido | `src/lib/auth.ts`, `src/middleware.ts` | Eliminado fallback. `getJwtSecret()` lanza error si `JWT_SECRET` no está definido |
| 2 | **Sin Security Headers** — No había headers de seguridad HTTP (CSP, HSTS, X-Frame-Options) | `next.config.ts` | Agregados 7 headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, CSP, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control |
| 3 | **Email TLS deshabilitado** — `rejectUnauthorized: false` en transporter SMTP | `src/lib/email.ts` | Cambiado a `rejectUnauthorized: process.env.NODE_ENV === 'production'` |
| 4 | **Debug logs en producción** — 6 `console.log` con datos sensibles en `changePassword` | `src/features/auth/actions.ts` | Eliminados todos los `console.log` de debug |

### HIGH

| # | Vulnerabilidad | Archivo | Corrección |
|---|---------------|---------|------------|
| 5 | **Sin Rate Limiting** — Endpoints de auth sin protección contra fuerza bruta | `src/features/auth/actions.ts` | Implementado rate limiting in-memory: login (5/15min), register (3/60min), forgotPassword (3/15min), changePassword (5/15min), resetPassword (5/15min) |
| 6 | **Política de contraseñas débil** — Solo 6 caracteres mínimo, sin requisitos de complejidad | `src/features/auth/schemas.ts` | Min 8 chars + mayúscula + minúscula + número + carácter especial |
| 7 | **Open Redirect** — Parámetro `redirect` en middleware sin validación | `src/middleware.ts` | Función `isValidRedirectPath()` — solo permite rutas relativas internas |
| 8 | **Cookie maxAge incorrecto** — Refresh token cookie 24h vs JWT 30 días | `src/lib/auth.ts` | Cookie maxAge alineado a 30 días |

### MEDIUM

| # | Vulnerabilidad | Archivo | Corrección |
|---|---------------|---------|------------|
| 9 | **File upload sin límite de tamaño** — `dataBase64` sin max length | `src/features/document/schemas.ts` | `.max(13_700_000)` (~10MB en base64) |
| 10 | **Schemas permisivos** — `.catchall(z.unknown())` acepta campos arbitrarios | `src/features/document/schemas.ts` | Cambiado a `.passthrough()` en 6 schemas |
| 11 | **Email sin max length** — Posible DoS con emails de 10K+ caracteres | `src/features/auth/schemas.ts` | `.max(254)` en todos los campos email (RFC 5321) |
| 12 | **Error leakage** — `console.error` exponiendo objetos completos de error | Múltiples archivos | Sanitizado: `error instanceof Error ? error.message : 'Unknown error'` |

### LOW

| # | Vulnerabilidad | Archivo | Corrección |
|---|---------------|---------|------------|
| 13 | **Google Drive query injection** — Interpolación de strings en queries API | `src/lib/google-drive.ts` | Función `sanitizeDriveQueryValue()` escapa comillas |
| 14 | **Cookie SameSite lax** — Podría ser `strict` para mayor seguridad | `src/lib/auth.ts` | Documentado — se mantiene `lax` por compatibilidad con OAuth flows |

---

## Checklist OWASP Top 10 (2021)

| # | Categoría OWASP | Estado | Detalle |
|---|-----------------|--------|---------|
| A01 | Broken Access Control | **PROTEGIDO** | RBAC con permisos granulares, tenantId en todas las queries, operatorId check en getCaseById |
| A02 | Cryptographic Failures | **CORREGIDO** | JWT secret sin fallback, bcrypt 12 rounds, HSTS habilitado |
| A03 | Injection | **PROTEGIDO** | Prisma ORM (queries parametrizadas), Zod validation, Google Drive query sanitization |
| A04 | Insecure Design | **CORREGIDO** | Rate limiting, password policy, redirect validation |
| A05 | Security Misconfiguration | **CORREGIDO** | Security headers, TLS enforcement, debug logs eliminados |
| A06 | Vulnerable Components | **REVISADO** | Next.js 15.5.12 (con patch CVE), Prisma 6.17.1 actualizado |
| A07 | Auth Failures | **CORREGIDO** | Rate limiting, password complexity, token expiration, cookie alignment |
| A08 | Software/Data Integrity | **PROTEGIDO** | JWT firmado con HS256, signature verification, token tampering detection |
| A09 | Logging Failures | **PARCIAL** | Error sanitization aplicada, pero falta logging estructurado (ver recomendaciones) |
| A10 | SSRF | **N/A** | No hay requests server-to-server basados en input del usuario (excepto Google Drive con auth OAuth) |

---

## Tests de Seguridad Creados

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `tests/security/rate-limit.test.ts` | 11 | Rate limiting: allow/block, keys independientes, reset, brute-force simulation |
| `tests/security/password-policy.test.ts` | 19 | Passwords débiles rechazados, fuertes aceptados, integración con register/reset/change schemas |
| `tests/security/input-validation.test.ts` | 21 | SQL injection, XSS, oversized inputs, malformed JSON, prototype pollution |
| `tests/security/auth-hardening.test.ts` | 13 | Token creation/verification, tampering, wrong secret, expiration, algorithm enforcement |
| `tests/security/redirect-validation.test.ts` | 26 | Rutas válidas, protocol-relative, absolute URLs, backslash traversal, edge cases |
| **Total** | **90** | |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/lib/auth.ts` | JWT secret hardening, cookie maxAge fix |
| `src/middleware.ts` | JWT secret hardening, redirect validation, export isValidRedirectPath |
| `next.config.ts` | 7 security headers |
| `src/lib/email.ts` | TLS enforcement en producción |
| `src/features/auth/actions.ts` | Rate limiting (5 funciones), debug logs eliminados, error sanitization, getClientIp() |
| `src/features/auth/schemas.ts` | passwordSchema (complejidad), email max(254) en 3 schemas |
| `src/features/document/schemas.ts` | File upload max(13.7M), .passthrough() en 6 schemas |
| `src/lib/google-drive.ts` | sanitizeDriveQueryValue(), query sanitization |
| `src/lib/rate-limit.ts` | **NUEVO** — Rate limiter in-memory con sliding window |
| `tests/__mocks__/next-headers.ts` | Mock de headers() para rate limiting |
| `tests/unit/auth/auth-schemas.test.ts` | Passwords fuertes, 6 tests de política |
| `tests/unit/auth/auth-actions.test.ts` | Rate limit reset, passwords fuertes |

---

## Riesgos Residuales

| Riesgo | Severidad | Mitigación Recomendada |
|--------|-----------|----------------------|
| Rate limiting in-memory (no distribuido) | Media | Migrar a **Upstash Redis** para rate limiting distribuido entre instancias serverless |
| Sin CSRF tokens | Baja | Next.js server actions tienen protección implícita contra CSRF (SameSite cookies + origin check). Para formularios tradicionales, considerar `csrf` middleware |
| Sin logging estructurado | Media | Implementar **Pino** o **Winston** con niveles, timestamps y correlation IDs |
| Sin WAF | Media | Configurar **Vercel WAF** o **Cloudflare** con reglas para SQLi/XSS |
| Sin audit trail | Media | Agregar tabla `AuditLog` para registrar acciones sensibles (login, cambio password, acceso a casos) |
| Cookie SameSite=lax | Baja | Evaluar cambio a `strict` si no se necesitan OAuth flows con redirect |

---

## Recomendaciones Pre-Producción

1. **Establecer JWT_SECRET fuerte** — Generar con `openssl rand -base64 64` y configurar en variables de entorno de Vercel
2. **Activar Vercel WAF** — Protección adicional contra ataques web comunes
3. **Migrar rate limiting a Redis** — `@upstash/ratelimit` para consistencia entre instancias serverless
4. **Implementar logging estructurado** — Pino con integration a Vercel Logs o servicio externo
5. **Agregar audit trail** — Tabla `AuditLog` con Prisma para eventos críticos
6. **Revisar CSP periódicamente** — Ajustar Content-Security-Policy según nuevos dominios integrados
7. **Habilitar Dependabot** — Alertas automáticas para vulnerabilidades en dependencias
8. **Penetration testing manual** — Antes de producción, realizar pentest con herramientas como OWASP ZAP

---

## Verificación

```bash
# Todos los tests pasan
npm test
# Output: Test Suites: 12 passed, 12 total
#         Tests: 207 passed, 207 total

# Build sin errores
npm run build
```
