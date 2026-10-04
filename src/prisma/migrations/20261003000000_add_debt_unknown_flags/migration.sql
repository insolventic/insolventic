-- Tres banderas en `Debt` para las casillas "Desconozco" del formulario de
-- acreedores (tasa de interés, fecha de otorgamiento, fecha de vencimiento).
--
-- POR QUÉ
--   El wizard ofrece esas tres casillas desde siempre y escriben el literal
--   'DESCONOZCO' en el campo. `createCase` hacía `parseFloat('DESCONOZCO')`
--   (NaN) y `new Date('DESCONOZCO')` (Invalid Date), y Prisma rechazaba la
--   inserción: marcar cualquiera de las tres reventaba la creación del caso.
--   Peor, como las deudas se creaban después del caso y fuera de transacción,
--   quedaba un expediente con el número de radicado consumido y cero
--   acreedores. Hallazgo T4 de docs/VERIFICACION_E2E_DOCUMENTOS_2026-10-03.md.
--
-- POR QUÉ UNA BANDERA Y NO NULL
--   Las dos fechas ya son opcionales, así que NULL solo significa "no lo
--   llenó". Lo que el documento tiene que decir es otra cosa: que el deudor
--   manifestó bajo juramento no conocer el dato (art. 539 CGP). En un
--   documento legal no es lo mismo "no aplica" que "no se informó" — el mismo
--   criterio que ya seguía `noCoDebtor`.
--
-- SEGURIDAD
--   Migración puramente aditiva: tres columnas nuevas con DEFAULT false. No
--   toca ninguna fila existente ni ninguna columna existente, y no puede
--   perder datos. `interestRate` sigue siendo Float NOT NULL (se guarda 0
--   cuando la bandera está en true, y ese 0 nunca se imprime).
--
--   Ninguna fila de producción puede tener hoy el estado "desconocido": la
--   única vía para marcarlo era la que fallaba, así que no hay nada que
--   rellenar hacia atrás.

ALTER TABLE "Debt"
  ADD COLUMN "interest_rate_unknown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "grant_date_unknown"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "due_date_unknown"      BOOLEAN NOT NULL DEFAULT false;
