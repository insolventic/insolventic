-- Firmas de las plantillas, fuera del repositorio. Aditiva: una tabla nueva
-- y su índice único; no toca ninguna tabla existente. Rollback: DROP TABLE
-- "imagenes_privadas" (nada más depende de ella).

-- CreateTable
CREATE TABLE "imagenes_privadas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imagenes_privadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imagenes_privadas_tenantId_tipo_key" ON "imagenes_privadas"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "imagenes_privadas" ADD CONSTRAINT "imagenes_privadas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

