-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "otherCauseDetail" TEXT,
ADD COLUMN     "notificationCity" TEXT;

-- CreateTable
CREATE TABLE "apoderados" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "nombre_completo" TEXT NOT NULL,
    "tipo_identificacion" TEXT,
    "identificacion" TEXT,
    "tarjeta_profesional" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "existe_poder_otorgado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "apoderados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apoderados_caseId_idx" ON "apoderados"("caseId");

-- AddForeignKey
ALTER TABLE "apoderados" ADD CONSTRAINT "apoderados_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoderados" ADD CONSTRAINT "apoderados_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
