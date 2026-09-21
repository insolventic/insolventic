# Golden master del mapper de placeholders

Red de seguridad de `src/features/document/placeholder-mapper.ts`. Fija la salida
completa del mapper y el HTML de cada plantilla para un conjunto de casos
realistas; es el criterio de aceptación de cualquier refactor del archivo.

| Archivo                | Qué fija                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mapper/<escenario>.json` | Las ~885 claves de `mapCaseToPlaceholders` (y, en conciliación, el contexto de `buildConciliationContext`). Una clave por línea. Los valores de más de 200 caracteres van como `sha256:<12 hex>+<largo>`. |
| `render-hashes.json`   | Por plantilla × escenario: hash de la plantilla, hash del HTML renderizado y los placeholders que la plantilla usa y el mapper no produce.                                     |

Los escenarios están en `tests/helpers/mapper-scenarios.ts` (cada uno documenta
qué combinación cubre y qué colisiones de orden de fusión hace visibles) y los
fixtures en `tests/helpers/mapper-fixtures.ts`.

## Cuando el test falla

- **No esperabas ese cambio** → es una regresión: arreglala o revertí.
- **Es intencional** (arreglo de un bug, campo nuevo, plantilla editada) →
  `npm run test:golden:update` y **leé el diff** de esta carpeta antes de
  commitear: eso es lo que se revisa en el PR.
- Si el mensaje dice "la PLANTILLA cambió, no el mapper", alguien editó un HTML
  de `templates/`: regenerá el golden en el mismo PR que esa edición.

## Determinismo

- La fecha de "hoy" se congela (2026-03-15 12:00 en Bogotá) y la zona horaria del
  proceso es UTC (la fija `tests/global-setup.js`: es la de Vercel y la de CI). El
  mapper depende de la zona del servidor; ver el test `BUG CONOCIDO` en
  `mapper-golden.test.ts`.
- Los valores de los fixtures salen del hash del nombre de cada campo, no de su
  posición: agregar o reordenar columnas del schema no cambia ninguna salida.
- Los montos van como `number` (lo que produce la ruta manual), así que el golden
  es el mismo con o sin el arreglo de `Prisma.Decimal`.

Ver también `mapper-merge-order.test.ts` (orden de fusión y las 21 colisiones).
