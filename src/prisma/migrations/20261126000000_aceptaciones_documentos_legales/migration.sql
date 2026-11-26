-- Registro de la aceptación de los términos de uso y de la lectura de la
-- política de privacidad (N-G-07). Aditiva: una tabla nueva y sus índices; no
-- toca ninguna tabla existente ni inserta filas (las cuentas existentes quedan
-- "pendientes" y se les pide al próximo ingreso). Sin FK a propósito: ver el
-- comentario del modelo en schema.prisma. Rollback: DROP TABLE
-- "aceptaciones_documentos_legales" (nada depende de ella).

-- CreateTable
CREATE TABLE "aceptaciones_documentos_legales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "requestId" TEXT,
    "aceptadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceptaciones_documentos_legales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aceptaciones_documentos_legales_userId_documento_version_sh_key" ON "aceptaciones_documentos_legales"("userId", "documento", "version", "sha256");

-- CreateIndex
CREATE INDEX "aceptaciones_documentos_legales_tenantId_userId_idx" ON "aceptaciones_documentos_legales"("tenantId", "userId");
