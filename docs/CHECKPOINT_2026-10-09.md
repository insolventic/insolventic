# Checkpoint de estado — INSOLVENTIC — 2026-10-09

> Sesión larga: revisión y merge de los 4 PRs de la noche anterior, promoción a
> `main`, y una cadena de 4 PRs nuevos que salió de un hallazgo encontrado al
> revisar. El hallazgo —§2— es lo importante de este documento.

## 1. Resumen de una línea

El branding por centro **nunca eligió por centro**: los mapas por tenant se
keyeaban por el slug y recibían un cuid. Sin impacto visible porque los dos
centros comparten assets. Corregido en `#128`, con los guardianes que lo
habrían atrapado.

## 2. El hallazgo: `Case.tenantId` es un cuid, no el slug

### Qué pasaba

`branding-assets.ts` (PR `#121`, ya promovido a `main`) keyea su mapa por el
**slug** del centro: `armonia` | `constructores-paz`. Es la clave correcta —
legible, estable entre entornos, la misma que usan el selector de login y
`centro-conciliacion.ts`.

Pero el mapper recibía `Case.tenantId`, que **no es el slug**. El recorrido real
del dato:

1. El login recibe el slug del formulario y busca el tenant con
   `where: { slug }`.
2. El JWT se firma con ese slug.
3. `authenticateUser()` lee el slug del token, vuelve a resolver el tenant por
   slug y devuelve **`tenantId: tenant.id`** — el cuid.
4. `createCase` persiste ese cuid en `Case.tenantId`. Y no podría ser otra cosa:
   la FK `Case_tenantId_fkey` referencia `Tenant("id")`, con
   `id String @id @default(cuid())`.

Resultado: `CARPETA_POR_TENANT[cuid]` daba `undefined` y el branding caía
**siempre** a `CARPETA_POR_DEFECTO`.

### Confirmado contra producción

Consulta de solo lectura sobre Neon el 2026-10-09:
`SELECT id, slug FROM "Tenant";` → los `id` son cuids (`cmluzsnr…`,
`cmluztyrq…`) y **no** coinciden con el slug.

Es decir: no era un riesgo latente, el branding por centro no funcionó nunca.

### Impacto real: ninguno visible

Los dos centros apuntan a la carpeta de Constructores de Paz **a propósito y de
forma temporal** (Armonía todavía no entregó sus assets), así que el valor que
devolvía el fallback es el mismo que habría devuelto el mapa. **Ningún documento
salió con el branding equivocado por esta causa**, porque todavía no hay dos
juegos de assets.

Lo que estaba roto era la capacidad de elegir: el día que Armonía tuviera su
carpeta, sus documentos habrían seguido saliendo con los assets del otro centro
— exactamente el bug que `#121` decía arreglar.

### Por qué ningún test lo atrapó

Porque **todos le pasaban el slug a mano**:

- Los fixtures unitarios construían el caso con `tenantId: 'constructores-paz'`,
  un valor que producción nunca produce.
- El test de `tests/db` comparaba contra `brandingRef(asset, stored.tenantId)`,
  o sea contra el mismo valor equivocado: **pasaba por construcción**.

Y un detalle que vale registrar porque es la lección: a ese test de `tests/db`
se le había hecho, el mismo día, un arreglo para que "tuviera dientes" — que
detectaba si el `tenantId` **se perdía**, pero no si su **formato** nunca
coincidía con el mapa. Verificar contra un fixture no es verificar contra
producción.

### El arreglo (`#128`)

- `CASE_GENERATION_INCLUDE` pide `tenant: { select: { slug: true } }`. Todos los
  caminos que alimentan al mapper pasan por `fetchCaseForGeneration`, así que un
  solo include cubre producción.
- `placeholders/tenant-slug.ts`: `tenantSlugDelCaso()` prefiere `tenant.slug`.
- `mapBrandingAssets` y `mapMembreteCentro` eligen por slug.

### Los guardianes que quedaron

Dos niveles, porque uno solo no alcanza:

| Guardián                      | Qué frena                                                     |
| ----------------------------- | ------------------------------------------------------------- |
| `FORMA_DE_SLUG` (sin dígitos) | cuids y tags con números (`e2edocs-m2k3j4`)                   |
| `esSlugDeCentroConocido()`    | identificadores inventados con forma válida (`tenant-golden`) |

Un filtro de forma permisivo **no sirve**: se escribió primero como
`^[a-z][a-z0-9-]*$` y el propio test lo cazó, porque un cuid es minúsculas y
alfanumérico y pasa. El guardián fuerte es la pertenencia al mapa, que no se
puede imitar desde un fixture.

Además, los fixtures pasaron a la **forma de producción** (`tenantId` = cuid +
`tenant.slug`): `makeCase` (base de los 404 escenarios del golden), los dos
`makeCase` locales de `prepare-template` y `oficio-por-juzgado`, y los overrides
de `branding-assets.test` y `membrete-centro.test`, que ahora overridean la
relación y no `tenantId`.

### Lo que lo destapó (y no fue leer el código)

Tres fixtures distintos mentían sobre la forma de producción en la misma cadena,
los tres en verde. Lo que los fue destapando:

- **`test:db` corriendo de verdad** contra Postgres (posible recién tras `#127`,
  §3). Fue el que atrapó que, con fail-closed, el membrete habría apagado la
  generación **para los dos centros** en producción.
- **El golden master comparando el hash del HTML renderizado** (`h`), que
  detectó 60 renders cambiados por un detalle del fixture XSS.

Las dos redes tienen en común que no dependen de que el fixture sea honesto.

## 3. El pozo de Docker Hub (`#127`)

El job de E2E falló dos veces seguidas en "Initialize containers":
`toomanyrequests: You have reached your unauthenticated pull rate limit` al
hacer `docker pull postgres:16-alpine`. El límite es por IP del runner —
compartida—, así que no se arregla reintentando.

Lo grave no era el rojo: cuando ese paso falla, **todos los siguientes quedan
`skipped`**, incluido `test:db`, que es el gate de los PRs que tocan la base. El
gate quedaba a merced de una lotería externa, y un `skipped` se lee parecido a un
`passed` de un vistazo.

Resuelto usando el **PostgreSQL preinstalado del runner** (Ubuntu 24.04 trae
16.15, el mismo major; servicio deshabilitado por defecto). Sin secretos nuevos
ni dependencia de registries externos. Dos detalles que hacían falta: `CREATEDB`
en el rol (el guardián del replay de migraciones crea y borra una base por
corrida) y `OWNER` en la base (desde PG 15 el schema `public` pertenece a
`pg_database_owner`).

## 4. Qué quedó mergeado en `dev` hoy

| PR     | Qué                                                              |
| ------ | ---------------------------------------------------------------- |
| `#124` | Limpieza de los 23 warnings de ESLint a 0                        |
| `#123` | Falso positivo de `useAuth` que spameaba Sentry                  |
| `#122` | El historial de migraciones se puede replayear desde cero        |
| `#121` | Branding por centro (infraestructura)                            |
| `#127` | CI: Postgres preinstalado del runner en vez de service container |
| `#128` | El mapper elige por slug, no por `Case.tenantId` (§2)            |
| `#126` | Membrete por centro, fase 1 (footer y resolución)                |

`main` fue promovido hoy hasta `7e900ec` (los cuatro primeros). Lo de `#126`,
`#127` y `#128` está en `dev` y **todavía no promovido**.

## 5. Lo que depende de personas

**Armonía está pausada**: no genera documentos hasta que lleguen sus datos. Es
una decisión tomada a conciencia (`#126`) — un error visible antes que un
documento que afirme algo falso sobre una habilitación ante un juzgado. Lo que
falta:

| Dato                          | Ocurrencias en plantillas | Detalle                                                                                                            |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Nombre a secas + denominación | 141                       | Llegó la denominación completa, no el nombre corto                                                                 |
| Operadora (nombre y cargo)    | 86                        | Ítem 12 de `PENDIENTES_DECISION_LEGAL.md`                                                                          |
| Las **dos** resoluciones      | 43                        | Llegó una (0858 del 01/11/2016); las plantillas afirman dos habilitaciones distintas, y el sello menciona 656/2016 |
| Los 3 assets de imagen        | —                         | Requisitos en `BRANDING_POR_CENTRO_2026-09-30.md` §4                                                               |

## 6. Hallazgos abiertos que no se cerraron hoy

- **Deriva entre el historial de migraciones y `schema.prisma`**: 30 statements
  (3 tablas, 5 columnas, 14 índices, 7 FKs, 1 DropEnum). Inventariada en
  `BRECHA_CONOCIDA` con guardián bidireccional. Anotada como ítem de Fase 3 en
  `CLAUDE.md`; necesita Neon y elegir entre catch-up idempotente o baseline.
- **Bloqueo de autoría de Vercel**: cada push a `dev`/`main` que deba disparar
  deploy sigue necesitando el amend manual a `Insolventic`. `CLAUDE.md` lo tiene
  anotado como pendiente (vincular la cuenta de `MaxitoJM` al proyecto).
- **`§4` de `RUNBOOK_ENV_VARS.md`** quedó desactualizado al aislar Preview con su
  propio branch de Neon: está escrito para un solo branch. Marcado con
  `⟨VERIFICAR⟩` en §2 de ese runbook.

## Referencias

- Branding por centro, inventario y plan: `docs/BRANDING_POR_CENTRO_2026-09-30.md`
- Datos de membrete que faltan: `docs/PENDIENTES_DECISION_LEGAL.md` §5, ítems 11 y 12
- Variables de entorno y aislamiento de Preview: `docs/RUNBOOK_ENV_VARS.md`
- Checkpoint anterior: `docs/CHECKPOINT_2026-09-28.md`
