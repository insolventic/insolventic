/**
 * Test de guardia: contrato Zod de entrada <-> modelo `Case` de Prisma.
 *
 * `createCase`/`updateCase` hacen `data: { ...rest }`, así que TODA clave que
 * el Zod de entrada acepte y que la action no extraiga antes del spread viaja
 * tal cual a `prisma.case.create/update`. Si esa clave no es un campo de
 * `Case`, Prisma responde "Unknown argument" — y lo hace en cada envío, porque
 * el wizard manda todos sus valores por defecto.
 *
 * Así se rompió la creación de casos desde el 2026-04-01 (notificationCity,
 * otherCauseDetail, apoderados…) sin que ningún test lo viera: el test de
 * integración mockea Prisma y el E2E nunca envía el wizard.
 *
 * La lista de claves que la action extrae se LEE del código fuente de
 * actions.ts (no se duplica aquí), así que no puede quedar desactualizada.
 */

import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  createCaseFormSchema,
  updateCaseSchema,
} from '@/features/case/schemas';

const caseModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Case');
const CASE_FIELDS = new Set((caseModel?.fields ?? []).map((f) => f.name));

const ACTIONS_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/features/case/actions.ts'),
  'utf8',
);

/** Claves que la action extrae del payload antes de `...rest`. */
function keysExtractedBeforeSpread(parseMarker: string): Set<string> {
  const parseAt = ACTIONS_SOURCE.indexOf(parseMarker);
  if (parseAt === -1) throw new Error(`No encontré "${parseMarker}"`);
  const open = ACTIONS_SOURCE.indexOf('const {', parseAt);
  const close = ACTIONS_SOURCE.indexOf('...rest', open);
  if (open === -1 || close === -1) {
    throw new Error(`No pude aislar el destructuring tras "${parseMarker}"`);
  }
  const block = ACTIONS_SOURCE.slice(open, close);
  return new Set(
    [...block.matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*),\s*$/gm)].map((m) => m[1]),
  );
}

const orphanKeys = (zodKeys: string[], extracted: Set<string>): string[] =>
  zodKeys.filter((k) => !extracted.has(k) && !CASE_FIELDS.has(k)).sort();

describe('Contrato Zod de entrada <-> modelo Case', () => {
  it('el DMMF de Prisma expone el modelo Case completo (guarda contra un pase vacío)', () => {
    expect(CASE_FIELDS.size).toBeGreaterThan(250);
    expect(CASE_FIELDS.has('apoderados')).toBe(true);
    expect(CASE_FIELDS.has('notificationCity')).toBe(true);
    expect(CASE_FIELDS.has('otherCauseDetail')).toBe(true);
  });

  it('createCase: toda clave que llega a case.create() es un campo de Case', () => {
    const extracted = keysExtractedBeforeSpread('createCaseFormSchema.parse');
    // Sanidad: si el regex no extrajera nada, todo parecería huérfano.
    expect(extracted.has('debtorId')).toBe(true);
    expect(extracted.has('apoderados')).toBe(true);

    const orphans = orphanKeys(
      Object.keys(createCaseFormSchema.shape),
      extracted,
    );

    expect(orphans).toEqual([]);
  });

  it('updateCase: toda clave que llega a case.update() es un campo de Case', () => {
    const extracted = keysExtractedBeforeSpread('updateCaseSchema.parse');
    expect(extracted.has('id')).toBe(true);

    const orphans = orphanKeys(Object.keys(updateCaseSchema.shape), extracted);

    expect(orphans).toEqual([]);
  });
});
