/**
 * `setupFiles` de `npm run test:db`: corre ANTES de que cualquier test importe el
 * cliente de Prisma y aborta si DATABASE_URL no es una base local de prueba.
 * La lógica (y sus tests) vive en db-guard.ts.
 */
import { assertSafeTestDatabase } from './db-guard';

assertSafeTestDatabase();
