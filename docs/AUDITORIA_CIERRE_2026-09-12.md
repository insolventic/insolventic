# Auditoría de cierre pre-producción — INSOLVENTIC

**Fecha:** 2026-09-12
**Base auditada:** `main` = `dev` = `d2f7cef` (Semanas 1–3 en producción)
**Modo:** solo lectura. No se modificó ningún archivo de código, configuración ni base de datos.
**Comparable con:** `docs/AUDITORIA_INTEGRAL_PRE_LAUNCH.md` (2026-09-02), misma escala de severidad.

---

## 1. Resumen ejecutivo

De los **9 hallazgos Altos** de la auditoría original, **2 se cerraron** con el trabajo de esta sesión, **1 bajó de severidad** y **6 siguen exactamente igual**. A ellos se suman **2 hallazgos Críticos nuevos** y **3 Altos nuevos** encontrados en los módulos que nunca se habían mirado.

El hallazgo más grave es nuevo y no estaba en ninguna auditoría previa: **las 65 plantillas llevan la identidad de un solo centro de conciliación escrita a mano**. El sistema es multi-tenant y sirve a dos centros.

### Matriz de severidad

| Origen | 🔴 Crítico | 🟠 Alto | 🟡 Medio | Total |
| ---------------------------------- | ---------: | ------: | -------: | ----: |
| Nuevos (Fases 1.1 y 3)             | 2 | 3 | 2 | 7 |
| Heredados, sin cambios (Fase 1.2)  | 0 | 6 | 0 | 6 |
| Heredados, severidad reducida      | 0 | 0 | 1 | 1 |
| **Total abierto**                  | **2** | **9** | **3** | **14** |
| Cerrados esta sesión               | — | 2 | — | 2 |

---

## 2. 🔴 CRÍTICO — Identidad del centro escrita a mano en las 65 plantillas

**Evidencia:** barrido de las 65 plantillas de `templates/`.

| Dato del centro, escrito a mano | Plantillas afectadas |
| ------------------------------- | -------------------: |
| Dirección (`Calle 74 No. 15-80…`) | 61 / 65 |
| Web y correo (`constructoresdepaz.com…`) | 61 / 65 |
| Teléfono (`311 811 7520`) | 60 / 65 |
| `Lonja de Propiedad Raíz…` | 59 / 65 |
| `CONSTRUCTORES DE PAZ` | 57 / 65 |
| Nombre de la operadora | 45 / 65 |
| `RESOLUCIÓN 1459 DE 2003` | 42 / 65 |

**Las 65 plantillas contienen al menos uno de esos datos. Ninguna menciona a Armonía.**

**Impacto.** Producción atiende dos centros (18 expedientes en Constructores de Paz, 10 en Armonía, según §8 del checkpoint). Cada documento que genera Armonía sale con el nombre, la resolución de habilitación, la dirección, el teléfono y la operadora **de otro centro**. Son documentos que se radican ante juzgados.

**Y no se puede arreglar solo editando plantillas.** El mecanismo no existe:

- El mapper produce un único placeholder relacionado: `OPERADOR`. No hay `NOMBRE_CENTRO`, `RESOLUCION_CENTRO`, `DIRECCION_CENTRO`, `TELEFONO_CENTRO` ni equivalentes.
- El modelo `ConciliationCenter` (`schema.prisma`) tiene 8 columnas: `id`, `tenantId`, `code`, `displayName`, `driveFolderName`, `isActive`, `createdAt`, `updatedAt`. **No guarda dirección, teléfono, correo, web, resolución ni operadora.**
- `placeholder-mapper.ts` no referencia `ConciliationCenter` ni una sola vez.

**Alcance real del arreglo:** ampliar el modelo, poblarlo para los dos centros, exponer los placeholders en el mapper y sustituir el texto fijo en 65 archivos. No es una corrección menor.

---

## 3. 🔴 CRÍTICO — Deriva de esquema sin verificar en 10 modelos

**No pude ejecutar esta verificación.** El `.env` local apunta a `localhost/insolventic_e2e`, no a producción, y no tengo credenciales de la base real.

**Consultar la base local habría reproducido el error que ya costó meses.** Esa base se construyó con `db push`, así que tiene todas las columnas; es exactamente el motivo por el que el bug de `/cases` se diagnosticó mal dos veces (§8 del checkpoint). **El método por diff contra migraciones tampoco sirve**: para `Case` predijo 186 columnas faltantes cuando eran 29.

El único método fiable es comparar contra `information_schema.columns` de la base real.

### Columnas declaradas (lado que sí se puede calcular)

| Modelo | Tabla real | Declaradas |
| ------------------ | --------------------- | ---------: |
| Case | `Case` | 265 |
| Debtor | `Debtor` | 51 |
| Acreedor | `acreedores` | 35 |
| Bien | `bienes` | 17 |
| Payment | `payments` | 17 |
| Document | `Document` | 15 |
| User | `User` | 12 |
| AuditLog | `audit_logs` | 12 |
| ProcesoJudicial | `procesos_judiciales` | 11 |
| Notification | `notifications` | 10 |
| ConciliationCenter | `ConciliationCenter` | 8 |
| **Total** | | **453** |

> Conteo aproximado (±2 por el tratamiento de relaciones). La cifra que manda es la del SQL.

### Cómo completar la tabla

Ejecutar contra la base de **producción**, en solo lectura, sin leer datos de usuario:

```sql
SELECT table_name, count(*) AS columnas_reales
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('Case','Debtor','acreedores','bienes','payments',
                     'Document','User','audit_logs','procesos_judiciales',
                     'notifications','ConciliationCenter')
GROUP BY table_name ORDER BY table_name;
```

Cualquier modelo cuyo número real sea menor que el declarado tiene deriva, y **cualquier consulta que lo lea sin `select` explícito falla como falló `/cases`**.

**Por qué sigue siendo Crítico:** este defecto ya tumbó una pantalla durante meses sin que nadie lo viera. Nueve modelos siguen sin comprobar.

---

## 4. Fase 1.2 — Revisión de los 9 hallazgos Altos heredados

| # | Hallazgo | Estado hoy | Evidencia |
| --- | ------------------------------------------------- | ---------- | --------- |
| A-1 | Mutaciones de caso sin visibilidad por fila | 🟠 **Sin cambios** | `assertCaseAccess` no existe: 0 coincidencias en `case/actions.ts` |
| A-2 | Bloqueo optimista opcional y no atómico | 🟠 **Sin cambios** | `schemas.ts:1506` sigue `z.number().int().optional()`. PR #4 movió la lectura dentro de la transacción, pero sigue siendo leer-y-luego-escribir |
| A-3 | Generación por cambio de fase sin `after()` ni lock | 🟠 **Sin cambios** | 0 coincidencias de `claimGenerationRequest`/`after(` en `updateCasePhase` |
| A-4 | `SMMLV_2025` con el valor de 2024 | ✅ **Resuelto** | `SMMLV_BY_YEAR` + `getSmmlv(year)` (PR #4) |
| A-5 | Sin `maxDuration`, Chromium por documento | 🟡 **Reducido a Medio** | `maxDuration = 60` en `cases/page.tsx:6` y `documents/page.tsx:16`. Pero `generate-documents.ts` sigue sin usar `batchHtmlToPdf`, y los lotes de 26 y 77 siguen sin caber (issue #3) |
| A-6 | `DOCUMENT_REQUIREMENTS` permisivo por defecto | 🟠 **Sin cambios** | `generate-documents.ts:137-138` sigue devolviendo `canGenerate: true` cuando no hay reglas |
| A-7 | Sin idempotencia al regenerar documentos | 🟠 **Sin cambios** | `persistence.ts` no persiste `templateId` (0 coincidencias); `archiveSupersededDocument` solo aparece en su propia definición: sigue muerto |
| A-8 | `batchGenerateDocuments` sin lock | ✅ **Resuelto** | `runWithGenerationLock`/`claimGenerationRequest` presentes (PR #4, `kind: 'BATCH'`) |
| A-9 | `globalSearch` sin ningún check de permisos | 🟠 **Sin cambios** | `search/actions.ts` solo llama `authenticateUser()`; ni `P.*` ni scoping por rol |

**Resultado: 2 cerrados, 1 degradado, 6 intactos.** Los seis que siguen abiertos comparten un rasgo: ninguno lo tocó el trabajo de Semana 3, que se concentró en los Críticos.

---

## 5. Fase 3 — Auditoría de los cinco módulos no tocados

### 5.1 Panorama

| Módulo | Líneas | Actions | `authenticateUser` | `console.*` | `logger.` | `catch` | con re-throw |
| -------------- | -----: | ------: | -----------------: | ----------: | --------: | ------: | -----------: |
| Pagos | 1318 | 11 | 11 | 11 | **0** | 11 | **0** |
| Reportes | 456 | 3 | 3 | 3 | **0** | 3 | **0** |
| Calendario | 130 | 1 | 1 | 1 | **0** | 1 | **0** |
| Auditoría | 339 | 4 | 3 | 4 | **0** | 3 | **0** |
| Notificaciones | 972 | 9 (1 interna) | 6 | 6 | **0** | 13 | **0** |

### 5.2 🟠 ALTO — Reportes sin visibilidad por rol

`report/actions.ts` no contiene **ninguna** referencia a `VER_CASOS_PROPIOS`, `operatorId` ni filtro por rol. Scopea por `tenantId` y nada más.

**Impacto:** un rol limitado a ver sus propios expedientes obtiene, vía reportes, los agregados y el detalle de **todos** los casos del centro. Es el mismo vector que A-1, por una puerta distinta.

**Contraste que lo confirma como anomalía, no como norma:** Pagos y Calendario **sí** aplican `VER_CASOS_PROPIOS` / `VER_TODOS_CASOS` / `VER_CASOS_CLIENTE`. Reportes es el único de los tres que no lo hace.

### 5.3 🟠 ALTO — Los fallos de la auditoría se tragan en silencio

`audit-log/actions.ts:96-97`:

```ts
.catch((error) => {
  console.error('Error creating audit log:', error);
```

Si escribir la entrada de auditoría falla, la operación principal continúa y **el fallo solo va a los Runtime Logs de Vercel**. No llega a Sentry y nadie lo ve.

**Impacto:** en un sistema con expedientes legales, el rastro de auditoría puede tener huecos sin que nadie se entere. Y el registro es justamente lo que se consulta cuando hay una disputa sobre quién hizo qué.

> Que la escritura de auditoría no tumbe la operación principal es una decisión defendible. Que su fallo sea **invisible** no lo es.

### 5.4 🟠 ALTO — Cero observabilidad en los cinco módulos

**3.215 líneas, 25 llamadas a `console.*`, 0 a `logger`, 31 bloques `catch` y ninguno re-lanza.** Todos capturan, escriben en consola y devuelven un mensaje genérico.

Es exactamente el patrón que hizo que `/cases` estuviera roto meses sin que apareciera en Sentry (§8 del checkpoint). El roadmap de `CLAUDE.md` ya lo tiene como Fase 2 (~16 h); esta auditoría añade la evidencia de que el problema no es estético.

### 5.5 🟡 MEDIO — `createNotificationForAction` expuesta como endpoint

`notification/actions.ts` lleva `'use server'`, y en Next.js **toda función exportada de un módulo así es un endpoint público**. `createNotificationForAction` no autentica ni valida permisos.

**Explotable en la práctica: no.** Recibe `prisma: PrismaClient` como parámetro, que no se puede serializar a través de la frontera de una server action, así que una llamada remota falla al construirla.

**Pero viola una convención propia del proyecto**, escrita en `CLAUDE.md`: *"Módulos compartidos entre actions van en archivos sin `'use server'`"*. El día que alguien cambie esa firma para quitar el `prisma`, pasa a ser un agujero real sin que nada avise.

### 5.6 🟡 MEDIO — `markAsRead` actualiza sin `tenantId`

Verifica correctamente la propiedad (`notification.userId !== user.id` → rechaza), pero el `update` posterior usa `where: { id: notificationId }` sin `tenantId`. La comprobación previa lo cubre; es defensa en profundidad, no un agujero.

### 5.7 Lo que salió bien

- **Pagos** es el módulo más sólido: 11 de 11 acciones autenticadas, 14 usos de validación zod en el servidor y scoping por rol completo.
- **Calendario**, pese a sus 130 líneas, aplica los tres permisos de visibilidad.
- Ninguno de los cinco módulos genera documentos ni lanza procesos asíncronos sin lock: **el riesgo de generación descontrolada está confinado a los módulos de casos y documentos.**

---

## 6. Prioridades sugeridas

No es una decisión mía; es el orden que propongo para discutirlo.

**Antes de considerar el sistema maduro:**

1. **Identidad del centro en las plantillas** (§2). Es el único hallazgo que produce documentos legalmente incorrectos hoy, en cada generación de uno de los dos centros.
2. **Verificar la deriva de esquema** (§3). La consulta es de minutos; el riesgo que descarta es una caída silenciosa de meses.
3. **`globalSearch`** (A-9). La auditoría original ya lo calificaba de corrección de minutos con impacto alto.
4. **Visibilidad por rol en mutaciones y reportes** (A-1 y §5.2). Comparten solución: un `assertCaseAccess` reutilizable.

**Siguiente tanda:** A-3 (generación por fase sin lock), A-7 (idempotencia), A-2 (bloqueo optimista), y la migración a `logger` de los cinco módulos (§5.4), que conviene hacer junto con §5.3.

**Ya en seguimiento:** issue #3 (lotes grandes, que es lo que queda de A-5) e issue #16.

---

## 7. Alcance de esta auditoría

Lo que **no** cubre, para que no se lea como una revisión completa:

- La Fase 2 quedó **sin ejecutar**: solo se calculó el lado declarado.
- La Fase 3 fue una **revisión estructural** —permisos, validación, manejo de errores, locks—, no una lectura línea por línea de la lógica de negocio de cada módulo.
- No se revisaron los módulos de autenticación, casos ni documentos: ya los cubrieron las auditorías anteriores.
- No se evaluó el frontend más allá de comprobar dónde vive cada validación.
