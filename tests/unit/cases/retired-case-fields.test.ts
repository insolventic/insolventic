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

describe('migración que retira rejection y withdrawal', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');

  const dir = path.join(process.cwd(), 'src', 'prisma', 'migrations');
  const name = fs
    .readdirSync(dir)
    .find((d) => d.endsWith('_drop_rejection_withdrawal_from_case'));
  const raw = name
    ? fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8')
    : '';
  // Solo el SQL ejecutable: sin los comentarios `-- ...` del encabezado.
  const sql = raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

  it('existe y es posterior a la última migración previa', () => {
    expect(name).toBeDefined();
    // Solo migraciones ANTERIORES a esta (no "todas menos esta"): una
    // migración más nueva que se agregue después (como la que borra el
    // Formulario Definitivo muerto) no debe volver falso este test.
    const previous = fs
      .readdirSync(dir)
      .filter((d) => /^\d{14}_/.test(d) && d !== name && d < name!)
      .sort()
      .pop()!;
    expect(name! > previous).toBe(true);
  });

  it('borra exactamente estas dos columnas de "Case", con IF EXISTS', () => {
    const drops = sql.match(/DROP COLUMN[^,;]*/g) ?? [];
    expect(drops).toEqual([
      'DROP COLUMN IF EXISTS "rejection"',
      'DROP COLUMN IF EXISTS "withdrawal"',
    ]);
    expect(sql).toMatch(/ALTER TABLE "Case"/);
  });

  it('no hace nada más destructivo (ni tablas, ni filas, ni otras columnas)', () => {
    expect(sql).not.toMatch(
      /DROP TABLE|TRUNCATE|DELETE FROM|ALTER COLUMN|RENAME/i,
    );
    expect((sql.match(/ALTER TABLE/g) ?? []).length).toBe(1);
  });

  it('aborta antes del DROP si algún caso tiene alguna de las dos en true', () => {
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/IS TRUE/);
    // La guarda va antes del DROP.
    expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(
      sql.indexOf('DROP COLUMN'),
    );
  });
});
