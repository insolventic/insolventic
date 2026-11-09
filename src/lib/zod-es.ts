/**
 * Mensajes de Zod en español para todo el proyecto (N6, auditoría 2026-10-27).
 *
 * `z.config` es global y se lee al validar, así que basta con que este módulo
 * se importe antes del primer `parse`. Lo importan los `schemas.ts` de cada
 * feature (cliente y servidor) y `error-de-accion.ts`.
 *
 * Solo cambia los mensajes por defecto: un `.min(1, 'El deudor es requerido')`
 * conserva su texto. Viene con `zod` (sin dependencias nuevas).
 */
import { z } from 'zod';

z.config(z.locales.es());
