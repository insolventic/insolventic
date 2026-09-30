-- AlterTable
ALTER TABLE "LegalProcess" ADD COLUMN     "processTypeOther" TEXT,
ADD COLUMN     "courtEmail" TEXT;

-- AlterTable
ALTER TABLE "procesos_judiciales" ADD COLUMN     "tipo_proceso_otro" TEXT,
ADD COLUMN     "juzgado_correo" TEXT;
