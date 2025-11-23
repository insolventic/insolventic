-- Migration to consolidate creditor types
-- Convert "Entidad Financiera" type to "FINANCIAL" type for consistency

UPDATE "Creditor"
SET "type" = 'FINANCIAL'
WHERE "type" = 'Entidad Financiera';
