-- Apoderado del acreedor: una fila por FUENTE, y la resolución del conflicto.
--
-- POR QUÉ. Decisión legal del 2026-10-09 (ítem 13 de
-- docs/PENDIENTES_DECISION_LEGAL.md, §6.6): cuando el registro de poderes y el
-- acta de la audiencia no coinciden, el sistema NO debe elegir una fuente por
-- defecto — debe detectar la discrepancia y bloquear la generación. Para poder
-- comparar dos fuentes hay que poder guardarlas por separado, y hasta ahora no
-- había ningún lugar donde guardar el apoderado de un acreedor: `Apoderado` es
-- por caso y del convocante, y `Debt` no tenía el campo.
--
-- ENTERAMENTE ADITIVA, a propósito. Cuatro columnas nullable en `Debt` y una
-- tabla nueva: ninguna fila existente cambia y el código viejo sigue
-- funcionando contra el esquema nuevo. Lo exige la regla de `RUNBOOK.md §2.2`,
-- porque los Preview corren código nuevo contra el esquema viejo (el
-- `migrate deploy` está gateado a `$VERCEL_ENV=production`).
--
-- EL UNIQUE (debt_id, fuente) es la invariante del diseño: cada acreedor tiene
-- como máximo un apoderado por fuente. Sin él, dos filas REGISTRO para el mismo
-- acreedor harían ambigua la comparación que el gate necesita hacer.
--
-- LA CONFIRMACIÓN GUARDA LA FUENTE, NO UN FK a la fila elegida. Un FK habría
-- creado un ciclo de acciones referenciales entre las mismas dos tablas
-- (CASCADE en un sentido, SET NULL en el otro). La fila concreta se busca por
-- (debt_id, fuente), que ya es único.
--
-- `apoderado_confirmado_huella` es la huella de las identificaciones
-- normalizadas de las dos fuentes AL MOMENTO DE CONFIRMAR: si alguna cambia
-- después, deja de coincidir y el conflicto vuelve a bloquear. La confirmación
-- es sobre dos valores concretos, no sobre el acreedor.
--
-- Plan: docs/PLAN_APODERADO_ACREEDOR_CYG_2026-10-10.md (PR 1 de 4).


-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "apoderado_confirmado_at" TIMESTAMP(3),
ADD COLUMN     "apoderado_confirmado_fuente" TEXT,
ADD COLUMN     "apoderado_confirmado_huella" TEXT,
ADD COLUMN     "apoderado_confirmado_por" TEXT;

-- CreateTable
CREATE TABLE "apoderados_acreedor" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "tipo_identificacion" TEXT,
    "identificacion" TEXT,
    "tarjeta_profesional" TEXT,
    "correo" TEXT,
    "telefono" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apoderados_acreedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apoderados_acreedor_debt_id_idx" ON "apoderados_acreedor"("debt_id");

-- CreateIndex
CREATE INDEX "apoderados_acreedor_tenant_id_idx" ON "apoderados_acreedor"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "apoderados_acreedor_debt_id_fuente_key" ON "apoderados_acreedor"("debt_id", "fuente");

-- AddForeignKey
ALTER TABLE "apoderados_acreedor" ADD CONSTRAINT "apoderados_acreedor_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoderados_acreedor" ADD CONSTRAINT "apoderados_acreedor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

