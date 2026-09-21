/**
 * Regresión: `rejection` y `withdrawal` se retiraron del modelo Case
 * (Paso 5 de docs/DISENO_FASES_NUEVAS_2026-09-11.md, §6): la fase es la única
 * fuente de verdad de un Rechazo o un Retiro. Ninguna lógica los leía y solo
 * los escribía el formulario de edición (siempre en `false`, sin control
 * visible). Este test evita que reaparezcan como campo del modelo, del contrato
 * Zod o del formulario, donde competirían con la fase.
 */

import { Prisma } from '@prisma/client';

import {
  caseSchema,
  createCaseSchema,
  createCaseFormSchema,
  updateCaseSchema,
} from '@/features/case/schemas';

const RETIRED = ['rejection', 'withdrawal'] as const;

describe('campos retirados del modelo Case: rejection y withdrawal', () => {
  it('el modelo Prisma Case ya no los declara', () => {
    const caseModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === 'Case',
    );
    expect(caseModel).toBeDefined();
    const fields = caseModel!.fields.map((f) => f.name);

    for (const name of RETIRED) expect(fields).not.toContain(name);
    // Y el resto del ciclo de vida del caso sigue ahí (no se retiró de más).
    expect(fields).toContain('phase');
    expect(fields).toContain('inadmissionDate');
    expect(fields).toContain('resultDate');
    expect(fields).toContain('resultType');
  });

  it.each([
    ['caseSchema', caseSchema],
    ['createCaseSchema', createCaseSchema],
    ['createCaseFormSchema', createCaseFormSchema],
    ['updateCaseSchema', updateCaseSchema],
  ])('%s ya no los declara', (_nombre, schema) => {
    const keys = Object.keys(schema.shape);

    for (const name of RETIRED) expect(keys).not.toContain(name);
    // Sanidad: sigue siendo el schema del caso completo, no uno vacío
    // (updateCaseSchema no lleva caseNumber, pero sí `type` y `debtorId`).
    expect(keys).toContain('type');
    expect(keys.length).toBeGreaterThan(50);
  });
});
