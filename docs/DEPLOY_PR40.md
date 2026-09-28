# Plan de despliegue en dos tiempos — PR #40

> Documento de planificación. No ejecuta nada — describe los pasos exactos para cuando decidas promover #40 a `main`. Ver `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §6 (el diseño exige este orden) y `docs/CHECKPOINT_2026-09-28.md` §7 (por qué existe: separar el código que deja de usar `rejection`/`withdrawal` de la migración que borra esas columnas, para no reproducir el incidente de `apoyo_*` al revés — ver la sección "Por qué el orden importa" más abajo).

---

## 0. Antes de tocar nada: qué debe estar cerrado

- [ ] #40 revisado y mergeado a `dev` (por vos).
- [ ] `dev` sano: suite completa, `tsc`, `eslint` en verde sobre el commit que vas a promover (protocolo de siempre).
- [ ] **Hallazgo a resolver antes de promover — ver §1.1**: el commit que retira `rejection`/`withdrawal` del código (`f8cb595` en la rama de #40) **no incluye** el fix del archivo de plantilla movido a medias (`92b13c2`, ya en la rama). Si promovés el "paso 1" tal como está hoy el historial, sale a producción con el mismo bug que encontré: `inasistencia-deudor` no genera nada (`ARCHIVO-NO-ENCONTRADO`) porque el archivo físico no se movió. Necesitás reordenar (rebase) o cherry-pickear ese fix a un commit anterior al de la migración antes de definir el punto de corte del "paso 1". Sin este paso, no se repite el incidente de `apoyo_*` en las columnas — pero sí uno nuevo, silencioso, en un documento de Fracaso.

---

## 1. Los dos commits que definen los pasos

Identificados en la rama `feat/fases-nuevas-case-phases` (PR #40), tal como está hoy (2026-09-28). Si mergeás #40 con `--merge` (tiene su propio merge commit interno, igual que #34/#41 en esta sesión), estos SHA se preservan intactos en `dev`; si en algún momento se rebasea o squashea, hay que re-identificarlos por su **mensaje/nombre de archivo**, no asumir que el hash sigue siendo el mismo — las referencias de abajo dan ambos.

### Paso 1 — código que deja de usar `rejection`/`withdrawal`

```
f8cb595 refactor(fases): retirar rejection y withdrawal del codigo y del schema (paso 5, fase de expansion)
```

Qué cambia: `schema.prisma` deja de declarar los dos campos; `schemas.ts` los saca de `caseSchema`/`createCaseSchema`/`updateCaseSchema`; los diálogos de creación/edición de caso dejan de leerlos y escribirlos; `seed.ts` y los fixtures de test se actualizan. **Las columnas siguen existiendo en la base** (`NOT NULL DEFAULT false`) — el propio mensaje del commit lo dice: "el código viejo y el nuevo conviven sin problema" porque nadie deja de escribir un valor requerido (el default lo cubre).

### Paso 2 — la migración que borra las columnas

```
e559b28 feat(db): migracion que retira las columnas rejection y withdrawal de Case (paso 5, fase de contraccion)
```

Archivo: `src/prisma/migrations/20260920000000_drop_rejection_withdrawal_from_case/migration.sql`.

Contenido (verificado, no resumido de memoria):

1. Un bloque `DO $$ ... $$` que cuenta, por columna, cuántos casos la tienen en `true`; si alguna da más de 0, **aborta con `RAISE EXCEPTION`** citando cuántos casos y cuál columna, sin tocar nada (Postgres corre el DDL en una transacción).
2. Recién después, `ALTER TABLE "Case" DROP COLUMN IF EXISTS "rejection", DROP COLUMN IF EXISTS "withdrawal"`.

El propio encabezado del archivo (comentario SQL) ya trae la query de verificación de solo lectura y el rollback manual — citados tal cual en §4 y §5 de este documento para no depender de que alguien vaya a buscarlos.

### 1.1 Por qué el paso 1, tal como está hoy, no alcanza

`4a6dbc3` (commit anterior a `f8cb595`, también parte de #40) reclasifica la plantilla `rechazo-inasistencia` → `inasistencia-deudor` **en el config** (`templates-config.ts`), pero nunca mueve el archivo físico de `templates/insolvency/Tipos de Rechazo/` a la carpeta nueva. Lo until encontré porque el golden master (infraestructura que no existía cuando se creó la rama de #40) comparó por primera vez su código contra un baseline real. Con `generateOnFailure: true`, esa plantilla fallaría en silencio (`ARCHIVO-NO-ENCONTRADO`) en cuanto un caso pasara a Fracaso con ese subtipo — y esto **ya está roto hoy en la rama**, antes de la migración, nada tiene que ver con el paso 2.

El fix (`92b13c2`, `git mv` puro, sin tocar contenido) vive en la rama de #40 pero **después** de `e559b28` en el historial. Si el "paso 1" se promueve literalmente hasta `f8cb595`, este bug viaja a producción igual. Antes de fijar el punto de corte real:

- Reordená (rebase interactivo) para que `92b13c2` quede antes de `f8cb595`, o
- Cherry-pickeá `92b13c2` sobre el commit que efectivamente vayas a usar como tope del paso 1.

Los otros commits que agregué hoy sobre la rama de #40 (fix de fechas de Desistimiento, regeneración del golden master, test de invariante de plantillas, ajuste de `case-reads-select.test.ts`) no tienen esta urgencia — son mejoras de robustez, no bugs que se disparen en producción apenas se despliega — pero conviene el mismo tratamiento (adelantarlos al paso 1) ya que tampoco dependen de la migración.

---

## 2. Por qué el orden importa (y no al revés)

El `buildCommand` de `vercel.json` corre `prisma migrate deploy` **antes** de `next build`, gateado por `$VERCEL_ENV=production`:

```
npx prisma generate && ( [ "$VERCEL_ENV" != "production" ] || npx prisma migrate deploy ) && next build
```

El deployment **anterior** sigue sirviendo tráfico durante todo el tiempo que tarda el build nuevo. Si el código y la migración llegaran juntos, durante esa ventana el código VIEJO (que todavía usa `include`, no `select`, y por lo tanto trae todas las columnas escalares de `Case`) seguiría consultando `rejection`/`withdrawal` — que la migración ya borró. Mismo tipo de incidente que `apoyo_*` (`CHECKPOINT_2026-09-09.md` §8), pero al revés: ahí faltaban columnas que el código esperaba; acá sobra código que espera columnas que ya no están.

Promoviendo primero el commit que deja de usar las columnas (código viejo y nuevo conviven porque el `DEFAULT false` cubre los inserts sin ellas) y **recién con ese deployment ya sirviendo tráfico** promoviendo la migración, no hay ventana en la que el código activo consulte algo inexistente.

---

## 3. Los dos despliegues, paso a paso

### Despliegue 1 — código

1. Fijar el commit exacto de corte (ver §1.1 — probablemente no es `f8cb595` literal, sino el resultado de reordenar/cherry-pickear `92b13c2` antes).
2. Confirmar autoría (§6) del commit que va a quedar como HEAD de este push.
3. Push a `main` (fast-forward si el punto de corte es ancestro directo de `main`; si no, el mecanismo exacto depende de cómo haya quedado el historial tras el paso 1 de arriba).
4. Verificar el deploy (§4) **antes** de tocar nada del paso 2.

### Despliegue 2 — migración

1. Antes de promover nada: correr la query de solo lectura de §5 contra producción (Neon) para confirmar `0` y `0`. Si da distinto de cero, **no promover** — la migración va a abortar sola (eso es lo que la guarda hace), pero mejor saberlo antes que durante un build.
2. Traer a `main` el resto de los commits de `dev` hasta incluir `e559b28` (y todo lo posterior: docs del diccionario de datos, y cualquier otro fix que haya quedado después en la rama).
3. Confirmar autoría (§6) del commit que va a quedar como HEAD de este segundo push — **es un push nuevo, necesita su propia verificación**, no alcanza con la del despliegue 1.
4. Push a `main`.
5. Verificar el deploy (§4), y además el Build Log específicamente por la migración (§4.2).

---

## 4. Cómo verificar que un despliegue terminó bien antes de arrancar el siguiente

Mismo método que cerró el incidente de `DIRECT_URL` (`CHECKPOINT_2026-09-09.md` §10/§12: "cerrado con evidencia directa del Build Log, no por inferencia").

### 4.1 Para cualquiera de los dos despliegues

1. Estado del deployment: `success`, no `error`/`queued` colgado. (Vía dashboard de Vercel o `vercel inspect` — recordar que la cuenta `MaxitoJM` no es miembro de `insolventics-projects`, issue #7; puede hacer falta la cuenta `Insolventic` para ver el Build Log.)
2. Smoke test post-deploy (ya automatizado, `Smoke Test (post-deploy)` en Actions — ver que corrió y dio verde sobre el sha correcto):
   - `/api/health` → `ok`, `database.status: ok`.
   - `/` pública → 200.
   - `/cases` sin sesión → redirige a login.
3. `/api/health` en vivo, a mano, si hay dudas: debe responder `{"status":"ok",...}`.

### 4.2 Específico del despliegue 2 (la migración)

En el Build Log:

- Debe decir que encontró la migración `20260920000000_drop_rejection_withdrawal_from_case` y la aplicó (no "No pending migrations to apply" — si dice eso, la migración no corrió, algo no se promovió como se esperaba).
- **Sin `P1002`** ("database server was reached but timed out") — el error que en su momento reveló el problema de `-pooler` vs `directUrl`. Si aparece, la migración no llegó a ejecutarse.
- Sin ningún error de la guarda (`RAISE EXCEPTION ... caso(s) lo tienen en true`) — si aparece, el deploy de Production queda en `error` (el `&&` del buildCommand corta antes de `next build`) y **no hay nada que revertir**: la transacción de Postgres ya abortó sola, las columnas siguen ahí. Hay que investigar esos casos puntuales antes de reintentar.

Verificación adicional de que `/cases` sigue andando después de este despliegue puntual: la vista de casos ya no debería referenciar `rejection`/`withdrawal` en ningún lado (si el paso 1 se promovió bien, esto ya se cumplía desde el despliegue 1).

---

## 5. Rollback

**Prisma no tiene migraciones "down"**; el propio archivo de la migración deja escrito el DDL manual para revertir, que reproduzco acá porque no vale la pena ir a buscarlo bajo presión:

```sql
ALTER TABLE "Case"
  ADD COLUMN "rejection"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "withdrawal" BOOLEAN NOT NULL DEFAULT false;
```

Como el diseño confirma que todos los valores eran `false` (verificado por la propia guarda de la migración antes de dejarla correr), volver a agregarlas con ese default no pierde información — es exactamente el estado en el que estaban.

Query de solo lectura para confirmar el supuesto **antes** de promover el despliegue 2 (si preferís no esperar a que la guarda de la migración lo haga por vos):

```sql
SELECT count(*) FILTER (WHERE rejection)  AS rejection_true,
       count(*) FILTER (WHERE withdrawal) AS withdrawal_true
FROM "Case";  -- debe dar 0 y 0
```

Rollback del **despliegue 1** (código): revertir a `main`'s commit anterior es el camino normal de cualquier rollback de código en este proyecto — no tiene nada especial por ser parte de este plan, salvo que debe hacerse **antes** de promover el despliegue 2, nunca después (si el código ya se revirtió pero la migración ya corrió, el código viejo vuelve a intentar leer columnas que ya no existen — el mismo problema que este plan entero busca evitar, ahora por rollback en vez de por despliegue).

---

## 6. Autoría del commit de punta (bloqueo de Vercel, plan Hobby)

Regla general en `CLAUDE.md` § "Autoría de commits" y § Session 3: el plan Hobby de Vercel bloquea (`Blocked`) el deployment de la integración nativa si el autor del commit **HEAD** del push no está vinculado a la cuenta dueña del proyecto. La cuenta autorizada es `Insolventic <insolvenic@gmail.com>`.

**Esto aplica a los dos despliegues por separado** — cada push a `main` es un evento de deploy independiente con su propio commit HEAD; verificar la autoría del despliegue 1 no cubre al despliegue 2.

Antes de cada uno de los dos pushes:

```bash
git log -1 --format="%an <%ae>%n%s%n---%n%b"
```

Si el autor no es `MaxitoJM <maxitojam@hotmail.com>`, `MaxitoJM <135483965+MaxitoJM@users.noreply.github.com>` ni `Insolventic <insolvenic@gmail.com>`, corregir **antes** del push (nunca tocar `git config user.*` global):

```bash
git commit --amend --author="Insolventic <insolvenic@gmail.com>" --no-verify
```

Si el commit de punta natural de alguno de los dos despliegues ya tiene autor válido (por ejemplo, si vos mismo mergeaste el último commit desde GitHub y quedó con el `noreply` de tu cuenta), no hace falta el `--amend` — la tabla de identidades válidas de `CLAUDE.md` es la misma para ambos despliegues.

### Nota sobre el despliegue 1 específicamente

Si terminaste reordenando/cherry-pickeando commits (§1.1) para fijar el punto de corte del paso 1, el commit resultante de esa reescritura casi seguro te queda autorado como `MaxitoJM` local (`1a`) — vas a necesitar el `--amend` de arriba si ese es el commit que efectivamente empuja a `main`.

### Nota sobre el despliegue 2

Si al traer el resto de `dev` a `main` el mecanismo termina siendo un merge (en vez de un fast-forward puro, posible si el despliegue 1 dejó a `main` con un commit que `dev` no tiene — el propio commit de autoría de Insolventic del despliegue 1), el commit de punta de ese merge es el que necesita la verificación, no ninguno de sus dos padres.

---

## Referencias

- `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §6 — diseño original del despliegue en dos tiempos.
- `docs/CHECKPOINT_2026-09-28.md` §7 — resumen ejecutivo de por qué `main` sigue sin promoción y qué exige #40.
- `docs/CHECKPOINT_2026-09-09.md` §8, §10, §12 — el incidente de `apoyo_*` (mismo patrón, al revés) y el cierre de `DIRECT_URL`/`P1002`, con el mismo método de verificación por Build Log que reutiliza este documento.
- `CLAUDE.md` § "Autoría de commits" y § Session 3 — regla permanente de las dos identidades válidas y el porqué del bloqueo de Vercel.
