# Implementación Semana 1 — Seguridad Crítica

**Rama:** `fix/semana-1-seguridad-critica` (desde `origin/dev` @ `c53fbc5`) · **Fecha:** 2026-08-26
**Referencia:** `docs/AUDITORIA_PREPRODUCCION_2026-08-25.md` (hallazgos C-1, C-2, A-3, A-1, M-9)
**Estado final:** tsc ✅ · eslint sin warnings nuevos ✅ · jest **480/480** ✅ (447 base + 33 nuevos/actualizados) · `next build` ✅

> Nota de contexto: la auditoría se hizo sobre `main` (`854e694`); `dev` está adelante de `main` solo con commits de docs y de CI (migración a la integración nativa de Vercel). Verifiqué que los 5 hallazgos seguían intactos en `dev` antes de tocar nada. Ninguna discrepancia con la auditoría.

## Commits (uno por hallazgo, en orden de ejecución)

| Commit | Hallazgo | Título |
|---|---|---|
| `bfdeb47` | C-1 | fix(security): gate de auth del middleware — matching exacto de rutas públicas |
| `9e037be` | C-2 | fix(security): cerrar el registro público autoservicio |
| `a9a1e4d` | A-3 | fix(auth): no devolver los JWT en el body de login/refresh |
| `c507501` | A-1 | chore(deps): npm audit fix — Next 15.5.20 → 15.5.24 |
| `9cb8d65` | M-9 | fix(security): guard server-side en las 6 páginas sin protección |

No hubo push a `main` ni merge alguno. La rama quedó local (`git push -u origin fix/semana-1-seguridad-critica` cuando lo decidas). No se ejecutó ninguna migración ni comando de escritura contra base de datos alguna.

---

## 1. C-1 — Middleware de auth (código muerto)

**Archivos:** `src/middleware.ts` · `tests/security/middleware-auth-gate.test.ts` (nuevo)

- `PUBLIC_ROUTES` movido a scope de módulo y matching reemplazado por `pathname === route || pathname.startsWith(route + '/')`, expuesto como `isPublicRoute()` (exportado para test). Con esto, la redirección a login, el check de "sin permisos" y el RBAC por ruta (`getRoutePermissions()`) vuelven a ejecutarse.
- `JWT_SECRET` pasó de validarse en import a **lazy-init con caché**, mismo patrón que `auth.ts`/`email.ts` (era el mismo patrón que rompió los builds entre abril y julio).
- **Headers `x-user-*` eliminados**: grep exhaustivo confirmó cero consumidores en `src/` (solo el propio middleware los seteaba). Se propaga únicamente `x-request-id` (correlación de logs).
- **Tests (25):** rutas públicas vs. protegidas (incluye la regresión exacta del bug: `/dashboard`, `/cases`, etc. dejaban de ser "públicas"), sin cookie → redirect a `/login?redirect=…`, token inválido → login, permisos vacíos → `error=no-permissions`, usuario sin el gate de `/audit-log` → `/dashboard`, usuario con permiso pasa, ausencia de headers `x-user-*`, y autenticado en `/login` → `/dashboard`. Sin el fix, los tests de comportamiento fallan por construcción (con el matching viejo ninguna ruta redirige).

## 2. C-2 — Cierre del registro público

**Archivos:** `src/features/auth/actions.ts` · `src/middleware.ts` · `src/app/register/page.tsx` · `src/app/login/components/login-form.tsx` · `src/app/forgot-password/components/forgot-password-form.tsx` · tests de middleware y de auth-actions

- `registerUser` ahora exige sesión con permiso **`Crear usuarios`** (`requireActionPermission(P.CREAR_USUARIOS)`) como primera instrucción; sin sesión o sin permiso retorna `"El registro público está deshabilitado…"` y loguea `warn`. Esto cierra también la invocación directa de la server action como endpoint (el vector real del hallazgo), no solo la página.
- `/register` salió de `PUBLIC_ROUTES` (el middleware redirige a login) y `page.tsx` ahora hace `redirect('/login')` — doble cierre. **El formulario original se conserva** en `src/app/register/components/register-form.tsx` para una eventual reapertura.
- Links "¿No tienes cuenta? Registrarse" en login y forgot-password reemplazados por el aviso "Solicítala al administrador de tu centro".
- **Flujo admin verificado sin cambios:** `createUser` (`src/features/user/actions.ts`) es un camino independiente, ya gateado por `CREAR_USUARIOS`, con password temporal random + `mustChangePassword: true` + activación vía forgot-password. No se tocó y sus tests siguen verdes.
- **Tests:** 2 nuevos (rechazo sin sesión; rechazo con sesión sin `Crear usuarios` — usa `LAWYER_USER`) que fallan sin el fix, ambos afirmando además que `user.create` nunca se llama. Los 5 tests preexistentes de `registerUser` se actualizaron para correr con sesión de admin (helper `authenticateAsUserAdmin()`: JWT real en cookie mock + lookups de `authenticateUser` encolados con `mockResolvedValueOnce`).

**Decisión documentada:** la reapertura del registro autoservicio queda condicionada a que el "modo cliente" (deudor consultando su propio expediente) se vaya a usar realmente. Si se reabre, requiere: verificación de email obligatoria antes de activar la cuenta **y** vínculo explícito `Debtor ↔ User` (FK) en lugar del matching por string de email. Mientras tanto el modo cliente sigue funcionando para usuarios creados por el admin.

## 3. A-3 — Tokens fuera del body

**Archivos:** `src/features/auth/actions.ts` · `src/features/auth/schemas.ts` · `tests/unit/auth/auth-actions.test.ts`

- `loginUser` y `refreshAccessToken` ya no retornan `accessToken`/`refreshToken`; los campos se eliminaron también de `authResultSchema` (así TypeScript impide reintroducirlos).
- Verificado por grep que **ningún** componente/hook de UI leía los tokens del retorno (todos los usos de `accessToken` en `src/app` son lecturas de cookie server-side).
- **Tests:** el test de login exitoso dejó de afirmar `accessToken` presente; se agregaron 2 tests que afirman body **sin** tokens y cookies httpOnly seteadas/rotadas (login y refresh). Fallan contra el código anterior.

## 4. A-1 — Bump de Next.js + npm audit fix

**Archivos:** `package-lock.json` (solo lockfile; los ranges de `package.json` ya cubrían la patch)

- `npm audit fix` (sin `--force`): **Next 15.5.20 → 15.5.24**, que cierra los advisories high del framework — incluido GHSA-m99w-x7hq-7vfj (DoS en Server Actions, el relevante para esta app) — más fast-uri, ip-address, nanoid, brace-expansion y js-yaml.
- **Quedan 12 vulnerabilidades** (3 moderate, 9 high) que solo se resuelven con `--force`/breaking: `exceljs→uuid` (explícitamente fuera de alcance por tu instrucción), `extract-zip` (vía puppeteer-core), `image-size`, `deepmerge-ts`, `postcss` — todas en rutas de build/dev o dependencias transitivas de librerías que habría que subir de major. Anotadas para una tarea de deps propia.
- Nada rompió con el bump: suite completa verde, `tsc` limpio y **`next build` exitoso** con 15.5.24 (ejecutado dos veces: tras el bump y al final con todo integrado). Prisma client regenerado manualmente (npm no spawnea scripts en esta máquina, se usó `--ignore-scripts`).

## 5. M-9 — Guards server-side en páginas

**Archivos:** `src/lib/auth.ts` · `src/app/{reports,audit-log,calendar,notifications,profile}/page.tsx` · `src/app/documents/page.tsx` + `src/app/documents/components/documents-page-content.tsx` (nuevo) · `tests/security/page-auth-guard.test.ts` (nuevo)

- Nuevo helper `requirePageAuth(redirectPath)` en `lib/auth.ts`: es el patrón inline de `/dashboard`/`/cases` (cookie → `verifyToken` → `redirect('/login?redirect=…')`) factorizado, para no duplicarlo 6 veces. Las 5 páginas ya guardadas **no se tocaron** (quedan con su patrón inline; unificarlas es cosmético y estaba fuera de alcance).
- Aplicado a `/reports`, `/audit-log`, `/calendar`, `/notifications`, `/profile` y `/documents`. Este último era un client component: el contenido se movió íntegro (sin cambios de lógica) a `documents-page-content.tsx` y `page.tsx` quedó como wrapper server con el guard.
- Los `PermissionGuard` client existentes se conservan (UX de "Acceso Denegado" por permiso); el guard nuevo cubre la capa de **autenticación** server-side.
- **Tests (3):** sin cookie → redirect preservando ruta de retorno; token inválido → redirect; token válido → retorna la sesión. Fallan sin el helper.

---

## Decisiones tomadas (y por qué)

1. **Gate de C-2 dentro de `registerUser` y no solo en la página/middleware:** una server action es un endpoint invocable directamente por HTTP; cerrar solo la ruta dejaba el vector abierto. El gate exige `Crear usuarios`, coherente con el flujo admin existente.
2. **Conservar `register-form.tsx` en lugar de borrarlo:** la reapertura del registro está explícitamente contemplada como fase posterior condicionada; borrar y resucitar el formulario sería churn. La página que lo montaba ya no lo importa (queda como código muerto inofensivo y documentado).
3. **Helper `requirePageAuth` en vez de 6 copias inline:** mismo patrón, un solo punto de mantenimiento y testeable de forma aislada. Al ser lógica de auth, lleva sus propios tests.
4. **`isPublicRoute` exportado desde el middleware:** mismo criterio que el `isValidRedirectPath` existente — funciones puras del middleware exportadas para testearse directo.
5. **Eliminar campos de `authResultSchema` (no solo dejar de poblarlos):** el tipo es el contrato; si quedaban como `optional`, nada impedía que un refactor futuro volviera a filtrarlos.
6. **`npm audit fix` con `--ignore-scripts` + `prisma generate` manual:** limitación conocida de esta máquina (npm no spawnea lifecycle scripts); no afecta el lockfile resultante.

## Fuera de alcance — visto de paso, NO tocado

- Los tests preexistentes tienen 3 warnings ESLint propios (`jwtVerify`/`changePassword` importados sin usar en `auth-hardening`, `auth-tokens` y `auth-actions`) — preexistentes en `dev`, van con el quick win de limpieza de warnings (B-1).
- `dev` tiene 14 warnings ESLint en `src` (la auditoría contó 13 sobre `main`); el 14º es preexistente de `dev`, no de esta rama.
- El mensaje de `deleteCase` y otros `catch` siguen devolviendo `error.message` crudo (nota 3.4 de la auditoría) — pendiente.
- `documents-page-content.tsx` heredó el `PermissionGuard` con fallback duplicado del resto de páginas — patrón repetido en 6 lugares, candidato a factorización cosmética futura.
- Las 12 vulnerabilidades npm restantes (todas breaking) — tarea de deps propia.

## Pendiente para tu revisión

1. Revisar los 5 commits en `fix/semana-1-seguridad-critica` (están sin pushear; decidís vos cuándo).
2. **Probar manualmente en preview** antes del merge a `dev`: login/logout, navegación a las 6 páginas ahora guardadas (autenticado y no autenticado), intento de `/register`, y el flujo admin de creación de usuario + activación — los tests cubren la lógica, no el wiring visual.
3. Confirmar si querés comunicar a los centros el cambio de mensaje en login ("Solicítala al administrador de tu centro").
4. Decidir cuándo priorizar la reapertura del registro (o descartarla y, en ese caso, borrar `register-form.tsx` y el describe de `registerUser`).
5. Este archivo y `AUDITORIA_PREPRODUCCION_2026-08-25.md` quedan sin commitear, como pediste.
