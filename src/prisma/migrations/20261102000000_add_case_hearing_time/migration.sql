-- La audiencia vigente (`hearingDate`) no tenía hora: la única columna de hora
-- era `firstHearingTime`, de la primera audiencia. Sin esto, una reprogramación
-- no podía guardar a qué hora es la nueva cita.
--
-- Columna nueva y anulable: no reescribe filas ni bloquea lecturas, y las filas
-- que ya existen siguen resolviendo su hora por `firstHearingTime`
-- (ver `audienciaVigente` en src/features/calendar/audiencia.ts).
ALTER TABLE "Case" ADD COLUMN "hearingTime" TEXT;
