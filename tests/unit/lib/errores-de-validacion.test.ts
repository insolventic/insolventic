/**
 * `erroresDeValidacion`: un `ZodError` en texto legible y por campo.
 *
 * El `message` de un `ZodError` (Zod 4) es el JSON de sus issues; las acciones
 * de deudor lo devolvían tal cual y el diálogo "Crear Nuevo Deudor" lo mostraba.
 */
import { z } from 'zod';

import { erroresDeValidacion } from '@/lib/errores-de-validacion';
import { createDebtorSchema } from '@/features/debtor/schemas';

describe('erroresDeValidacion', () => {
  it('el mensaje de un ZodError es JSON: el helper da el texto del issue', () => {
    const r = z
      .object({ address: z.string().min(1, 'La dirección es requerida') })
      .safeParse({ address: '' });
    expect(r.success).toBe(false);
    // Lo que se le mostraba al usuario.
    expect(r.error!.message).toMatch(/^\[\s*\{/);

    expect(erroresDeValidacion(r.error)).toEqual({
      error: 'La dirección es requerida',
      fieldErrors: { address: 'La dirección es requerida' },
    });
  });

  it('un mensaje por campo (el primero) y rutas anidadas con punto', () => {
    const schema = z.object({
      name: z.string().min(1, 'El nombre es requerido').min(3, 'Muy corto'),
      debts: z.array(z.object({ amount: z.number().positive('Monto > 0') })),
    });
    const r = schema.safeParse({ name: '', debts: [{ amount: -1 }] });
    const legible = erroresDeValidacion(r.error);

    expect(legible?.fieldErrors).toEqual({
      name: 'El nombre es requerido',
      'debts.0.amount': 'Monto > 0',
    });
    expect(legible?.error).toBe('El nombre es requerido');
  });

  it('con el schema real de alta de deudor: dirección, ciudad y departamento', () => {
    const r = createDebtorSchema.safeParse({
      name: 'Ana Pérez',
      idNumber: '1234567',
      idType: 'CC',
      email: 'ana@example.com',
      phone: '3001234567',
      address: '',
      city: '',
      department: '',
      occupation: 'Empleado',
      monthlyIncome: 0,
    });
    const legible = erroresDeValidacion(r.error);

    expect(legible?.fieldErrors).toMatchObject({
      address: 'La dirección es requerida',
      city: 'La ciudad es requerida',
      department: 'El departamento es requerido',
    });
    expect(JSON.stringify(legible)).not.toMatch(/"code"|too_small|"origin"/);
  });

  it('reconoce un ZodError por su forma (otra copia de la clase)', () => {
    const copia = Object.assign(new Error('[{"x":1}]'), {
      name: 'ZodError',
      issues: [{ path: ['email'], message: 'Email inválido', code: 'custom' }],
    });
    expect(erroresDeValidacion(copia)).toEqual({
      error: 'Email inválido',
      fieldErrors: { email: 'Email inválido' },
    });
  });

  it('devuelve null si no es un error de validación', () => {
    expect(erroresDeValidacion(new Error('Prisma: conexión'))).toBeNull();
    expect(erroresDeValidacion('texto')).toBeNull();
    expect(erroresDeValidacion(undefined)).toBeNull();
  });
});
