# Plan de despliegue en dos tiempos — PR #40

> Documento de planificación. No ejecuta nada — describe los pasos exactos para cuando decidas promover #40 a `main`. Ver `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §6 (el diseño exige este orden) y `docs/CHECKPOINT_2026-09-28.md` §7 (por qué existe: separar el código que deja de usar `rejection`/`withdrawal` de la migración que borra esas columnas, para no reproducir el incidente de `apoyo_*` al revés — ver la sección "Por qué el orden importa" más abajo).

---

## 0. Antes de tocar nada: qué debe estar cerrado

- [ ] #40 revisado y mergeado a `dev` (por vos).
- [ ] `dev` sano: suite completa, `tsc`, `eslint` en verde sobre el commit que vas a promover (protocolo de siempre).
- [x] **Hallazgo del §1.1 (histórico), resuelto**: el commit que retira `rejection`/`withdrawal` del código (`f8cb595`) no incluía el fix del archivo de plantilla movido a medias (`92b13c2`) — promover el "paso 1" literal hasta `f8cb595` habría sacado `inasistencia-deudor` a producción sin generar nada (`ARCHIVO-NO-ENCONTRADO`). Resuelto **sin tocar la rama de #40**: el fix vive ahora, además, en `deploy/pr40-paso1` (cherry-pick sobre `f8cb595`), que es la rama que hay que promover en el despliegue 1 — ver §1.

---

## 1. Las dos fuentes que definen los pasos

### Paso 1 — rama `deploy/pr40-paso1` (código que deja de usar `rejection`/`withdrawal`, ya con el fix de plantilla incluido)

> **⚠️ Esta rama es una fotografía, no un estado permanente.** Se actualizó por última vez el **2026-09-28**, trayendo el `dev` de ese momento (`3eccc72`) con un merge normal. Si pasó tiempo entre esa fecha y el despliegue real, **`dev` va a haber avanzado** (nuevos merges, nuevos fixes) y esta rama va a estar desactualizada otra vez. **No asumas que sigue vigente sin revisar** — repetí el paso 0 de §3 (traer `dev` actual con un merge, correr toda la verificación) antes de promover, seas vos o cualquier otra sesión de Claude Code ejecutando este plan más adelante.

```
git log --oneline origin/deploy/pr40-paso1 | head -6
be9f9da test(casos): sacar updateCasePhase de WHOLE_ROW_ALLOWED (misma causa que en #40)
90340da test(documentos): regenerar golden master tras traer dev a deploy/pr40-paso1
11f7e37 test(documentos): actualizar mapper-merge-order tras el merge de dev (misma causa que en #40)
d8fbb0b merge: traer dev actual a deploy/pr40-paso1 antes del despliegue 1
3eccc72 ci(pr.yml): correr quality-checks tambien en push a dev   <- HEAD de dev al momento de este merge
...
f60ea85 fix(documentos): mover Auto Cierre por Inasistencia del Deudor a la carpeta de Fracaso
f8cb595 refactor(fases): retirar rejection y withdrawal del codigo y del schema (paso 5, fase de expansion)
```

Esta rama **no es la de #40** — es una rama nueva, creada específicamente para este despliegue, sin tocar `feat/fases-nuevas-case-phases` (que sigue intacta, con su propio historial y su propio CI, para cuando la mergees a `dev` como PR normal). Se construyó así (ver §1.1 para el porqué del cherry-pick, y §3 para el paso de re-sincronización):

```bash
# Construcción original (una sola vez)
git checkout -b deploy/pr40-paso1 f8cb595   # el commit real de #40 que retira rejection/withdrawal del código
git cherry-pick 92b13c2                     # el fix de la plantilla, cherry-pickeado desde la rama de #40
git push -u origin deploy/pr40-paso1

# Re-sincronización (repetir cada vez que se retome este plan, antes de promover)
git checkout deploy/pr40-paso1 && git pull --ff-only
git merge origin/dev --no-ff -m "merge: traer dev actual a deploy/pr40-paso1 antes del despliegue 1"
# resolver el conflicto de DESISTIMIENTO en placeholder-mapper.ts si aparece (ver §1.1 — es el mismo, siempre)
# correr suite completa, tsc, eslint y golden master (npm run test:golden:update si hace falta regenerar)
git push origin deploy/pr40-paso1   # nunca --force: esta rama solo avanza, no se reescribe
```

`f8cb595`: `schema.prisma` deja de declarar los dos campos; `schemas.ts` los saca de `caseSchema`/`createCaseSchema`/`updateCaseSchema`; los diálogos de creación/edición de caso dejan de leerlos y escribirlos; `seed.ts` y los fixtures de test se actualizan. **Las columnas siguen existiendo en la base** (`NOT NULL DEFAULT false`) — el propio mensaje del commit lo dice: "el código viejo y el nuevo conviven sin problema" porque nadie deja de escribir un valor requerido (el default lo cubre).

`f60ea85`: rename puro (`git mv`, 0 inserciones/0 borrados), cherry-pick verificado sin conflicto de `92b13c2`. Ver §1.1.

**Esta es la rama que se promueve a `main` en el despliegue 1** (§3), no un commit suelto de la rama de #40 — pero **siempre después de re-sincronizarla**, no tal cual quedó el 2026-09-28.

### Paso 2 — rama `feat/fases-nuevas-case-phases` completa (PR #40), mergeada a `dev` y de ahí a `main`

La migración vive en la rama de #40, sin cambios:

```
e559b28 feat(db): migracion que retira las columnas rejection y withdrawal de Case (paso 5, fase de contraccion)
```

Archivo: `src/prisma/migrations/20260930000000_drop_rejection_withdrawal_from_case/migration.sql`.

Contenido (verificado, no resumido de memoria):

1. Un bloque `DO $$ ... $$` que cuenta, por columna, cuántos casos la tienen en `true`; si alguna da más de 0, **aborta con `RAISE EXCEPTION`** citando cuántos casos y cuál columna, sin tocar nada (Postgres corre el DDL en una transacción).
2. Recién después, `ALTER TABLE "Case" DROP COLUMN IF EXISTS "rejection", DROP COLUMN IF EXISTS "withdrawal"`.

El propio encabezado del archivo (comentario SQL) ya trae la query de verificación de solo lectura y el rollback manual — citados tal cual en §4 y §5 de este documento para no depender de que alguien vaya a buscarlos.

**El paso 2 no sale de `deploy/pr40-paso1`.** Sale de mergear #40 completa (con `92b13c2` en su posición original, más todo lo que se agregó después: la regeneración del golden master, el test de invariante de plantillas, el fix de `case-reads-select.test.ts`, etc.) a `dev` como PR normal, y de ahí promover `dev` a `main` de la forma de siempre. Para ese momento, `92b13c2` ya no aporta nada nuevo — su contenido ya está en producción desde el despliegue 1 vía `f60ea85` — pero no hace falta sacarlo de la rama de #40 ni tratarlo de forma especial: un merge normal reconcilia dos ramas que renombraron el mismo archivo al mismo destino sin generar conflicto (ver §1.1).

### 1.1 Por qué se resolvió con una rama nueva (cherry-pick) y no reordenando la rama de #40

`4a6dbc3` (commit de #40, anterior a `f8cb595`) reclasifica la plantilla `rechazo-inasistencia` → `inasistencia-deudor` **en el config** (`templates-config.ts`), pero nunca movió el archivo físico. El fix real (`92b13c2`) quedó, en la rama de #40, **después** de la migración (`e559b28`) en el historial — si el paso 1 se promovía literal hasta `f8cb595`, el bug viajaba a producción.

Se evaluaron dos formas de resolverlo, ambas probadas primero en un worktree descartable (sin tocar la rama real ni pushear nada):

- **Reordenar la rama de #40 (rebase)**: descartado. `--rebase-merges` desde el punto donde arrancó #40 resultó en **85 pasos** (la rama tiene más de una decena de merges de `dev` encadenados), y se confirmó que reproduce, letra por letra, el mismo conflicto de `DESISTIMIENTO` en `placeholder-mapper.ts` que ya se había resuelto una vez al mergear `dev` en #40 — hay que resolverlo a mano de nuevo. Además reescribe el hash de los 85 commits (no solo los posteriores a la migración), lo que exige `--force-with-lease` sobre una rama ya pusheada, con CI corrido y en revisión.
- **Cherry-pick a una rama nueva**: la elegida. `git cherry-pick 92b13c2` sobre `f8cb595` aplica limpio (0 conflictos, verificado) porque es un rename puro que no toca ningún archivo que la migración o el merge de `dev` hayan tocado. Cero force-push, la rama de #40 queda completamente intacta — su propio historial, su CI y su revisión en curso no se ven afectados en absoluto.

Los demás commits que se agregaron hoy sobre la rama de #40 (fix de fechas de Desistimiento, regeneración del golden master, el test de invariante de plantillas, el ajuste de `case-reads-select.test.ts`) se quedan donde están, sin tocar — no son necesarios para el despliegue 1 (no son bugs que se disparen apenas se despliega, son mejoras de robustez) y llegan solos con el despliegue 2, al mergear la rama completa.

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

0. **Re-sincronizar `deploy/pr40-paso1` con el `dev` actual — SIEMPRE, inmediatamente antes de promover, sin importar cuándo se hizo la última vez.** Esta rama debe llevar el `dev` más actualizado posible en el momento real del despliegue, no una foto vieja (decisión explícita — ver el aviso de §1). No asumas que el estado de una sesión anterior (incluida la del 2026-09-28) sigue vigente: revisalo.

   ```bash
   git fetch origin dev deploy/pr40-paso1
   git checkout deploy/pr40-paso1 && git reset --hard origin/deploy/pr40-paso1
   git merge origin/dev --no-ff -m "merge: traer dev actual a deploy/pr40-paso1 antes del despliegue 1"
   ```

   Si aparece un conflicto: en todas las veces que se hizo este merge hasta ahora fue siempre el mismo, en `mapExtendedDates` (`src/features/document/placeholder-mapper.ts`), entre la lógica de `DESISTIMIENTO` de #40 y los stubs muertos que `dev` va sacando de a poco (ver el historial de esta misma sección de código: Hallazgo 2, PR #24, y este merge). Si es ese, resolver combinando ambos lados (la lógica de `resultDate` de #40 + el comentario/limpieza del lado de `dev`) — **no** descartar ninguno de los dos a ciegas. Si es un conflicto distinto, describirlo antes de resolverlo (no asumir que es "el de siempre").

   Después del merge, **repetir toda la verificación, no solo compilar**:
   - Suite completa (`npx jest --ci`), `tsc --noEmit`, `eslint`.
   - Golden master (`tests/unit/documents/mapper-golden.test.ts`) y, si hace falta regenerarlo, `npm run test:golden:update` — revisar el diff resultante antes de commitear: en todas las veces anteriores fueron exactamente dos causas (el fix de `*_DESISTIMIENTO` y el rename `rechazo-inasistencia`→`inasistencia-deudor`, ya presente en esta rama), nunca nada más. Si aparece un tercer tipo de diferencia, frenar y describirlo.
   - `tests/unit/cases/case-reads-select.test.ts`: si falla, es porque `updateCasePhase` volvió a aparecer en `WHOLE_ROW_ALLOWED` tras traer una versión más vieja de `dev` — sacarlo de la lista de nuevo (`updateCasePhase` de #40 no lee la fila entera).
   - Confirmar además que la rama **sigue sin la migración** — un merge de `dev` nunca debería introducirla, pero es gratis confirmarlo:
     ```bash
     grep -n "rejection\|withdrawal" src/prisma/schema.prisma   # sin resultados
     ls src/prisma/migrations/ | grep drop_rejection            # sin resultados
     ```

   Recién con todo esto en verde, push (`git push origin deploy/pr40-paso1`, nunca `--force`: esta rama solo avanza).

1. Punto de partida: `origin/deploy/pr40-paso1`, ya re-sincronizada por el paso 0. Confirmar con `git log -1 --format="%H %ai" origin/deploy/pr40-paso1` que el commit de punta es de **hoy** (o de la fecha real del despliegue), no de una sesión anterior.
2. Confirmar autoría (§6) del commit de punta.
3. Promover: `main` no es ancestro de `deploy/pr40-paso1` (esta rama arranca en un punto de `dev` bastante posterior a `main`, que sigue en `d2f7cef` del 2026-09-12), así que **no es un fast-forward simple** — va a traer todo lo que `dev` tenía al momento de la re-sincronización del paso 0, además del código de fases nuevas. Si eso incluye más de lo que se quiere promover en este momento, es una decisión aparte, anterior a este plan.
4. Verificar el deploy (§4) **antes** de tocar nada del paso 2.

### Despliegue 2 — migración

1. Antes de promover nada: correr la query de solo lectura de §5 contra producción (Neon) para confirmar `0` y `0`. Si da distinto de cero, **no promover** — la migración va a abortar sola (eso es lo que la guarda hace), pero mejor saberlo antes que durante un build.
2. Mergear #40 (rama `feat/fases-nuevas-case-phases`, completa, sin tocar) a `dev` como PR normal — con el mismo protocolo de verificación de siempre (CI en verde, suite/`tsc`/`eslint` sobre `dev` después del merge).
3. Promover `dev` a `main`. Como `main` quedó en `f60ea85` (con un commit — el cherry-pick — que `dev` no tiene en esa forma exacta, aunque sí tiene el mismo cambio vía `92b13c2` en su lugar original), esto **va a ser un merge, no un fast-forward puro**. Se espera que reconcilie sin conflicto real: ambos lados terminan queriendo el mismo archivo en la misma carpeta (mismo caso que un rename idéntico de los dos lados, sin contenido en disputa).
4. Confirmar autoría (§6) del commit de punta de ese merge — **es un push nuevo, necesita su propia verificación**, no alcanza con la del despliegue 1.
5. Push a `main`.
6. Verificar el deploy (§4), y además el Build Log específicamente por la migración (§4.2).

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

- Debe decir que encontró la migración `20260930000000_drop_rejection_withdrawal_from_case` y la aplicó (no "No pending migrations to apply" — si dice eso, la migración no corrió, algo no se promovió como se esperaba).
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

Cada vez que se re-sincroniza `deploy/pr40-paso1` (§3, paso 0), el commit de punta cambia — el merge queda autorado con quien lo haga (normalmente `MaxitoJM` local, `1a`, válido tal cual). Verificar de nuevo en ese momento, no confiar en que la autoría de una sincronización anterior sigue siendo la del commit que efectivamente se va a promover.

### Nota sobre el despliegue 2

Al mergear `dev` (ya con #40 adentro) a `main`, el mecanismo va a ser un merge, no un fast-forward puro — `main` quedó con el cherry-pick de `92b13c2` (vía `deploy/pr40-paso1`), que `dev` no tiene en esa forma exacta (tiene el mismo cambio, pero vía `92b13c2` en su lugar original dentro de la rama de #40). El commit de punta de ese merge es el que necesita la verificación de autoría, no ninguno de sus dos padres.

---

## Referencias

- `docs/DISENO_FASES_NUEVAS_2026-09-11.md` §6 — diseño original del despliegue en dos tiempos.
- `docs/CHECKPOINT_2026-09-28.md` §7 — resumen ejecutivo de por qué `main` sigue sin promoción y qué exige #40.
- `docs/CHECKPOINT_2026-09-09.md` §8, §10, §12 — el incidente de `apoyo_*` (mismo patrón, al revés) y el cierre de `DIRECT_URL`/`P1002`, con el mismo método de verificación por Build Log que reutiliza este documento.
- `CLAUDE.md` § "Autoría de commits" y § Session 3 — regla permanente de las dos identidades válidas y el porqué del bloqueo de Vercel.
