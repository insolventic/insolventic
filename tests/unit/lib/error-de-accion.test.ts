/**
 * N6 (auditoría 2026-10-27): qué mensaje de error llega al cliente.
 *
 * Antes los `catch` devolvían `error.message`: con un `ZodError`, el JSON
 * completo en inglés; con un error de Prisma o de red, el detalle interno.
 */
const mockLoggerError = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    error: (...a: unknown[]) => mockLoggerError(...a),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  ErrorDeNegocio,
  esErrorDeNegocio,
  mensajeDeError,
} from '@/lib/error-de-accion';
import { CaseAccessError } from '@/features/case/case-access';
import { createCaseFormSchema } from '@/features/case/schemas';

const GENERICO = 'Error al crear el caso';

beforeEach(() => mockLoggerError.mockClear());

describe('mensajeDeError', () => {
  it('un ErrorDeNegocio llega tal cual y no se registra como error', () => {
    const e = new ErrorDeNegocio('No tiene permisos para: Ver deudores');
    expect(mensajeDeError(e, GENERICO)).toBe(
      'No tiene permisos para: Ver deudores',
    );
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('un error de validación da su primer mensaje, no el JSON', () => {
    const r = createCaseFormSchema.safeParse({ type: 'INSOLVENCY' });
    expect(r.success).toBe(false);
    const mensaje = mensajeDeError(r.error, GENERICO);
    expect(mensaje).not.toMatch(/^\s*\[/);
    expect(mensaje.length).toBeLessThan(200);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('los mensajes propios del schema tienen prioridad sobre el locale', () => {
    const schema = z.object({
      debtorId: z.string().min(1, 'El deudor es requerido'),
    });
    const r = schema.safeParse({ debtorId: '' });
    expect(mensajeDeError(r.error, GENERICO)).toBe('El deudor es requerido');
  });

  it('los mensajes por defecto de Zod salen en español', () => {
    const r = z.object({ a: z.string() }).safeParse({});
    const mensaje = mensajeDeError(r.error, GENERICO);
    expect(mensaje).not.toMatch(/Invalid input|expected/);
    expect(mensaje).toMatch(/inválid/i);
  });

  describe('un error de Prisma o de red NUNCA llega al cliente', () => {
    const internos: [string, Error][] = [
      [
        'Prisma (restricción única)',
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`caseNumber`,`tenantId`)',
          { code: 'P2002', clientVersion: '6.19.3' },
        ),
      ],
      [
        'Prisma (conexión)',
        new Prisma.PrismaClientInitializationError(
          "Can't reach database server at `ep-xxx.neon.tech:5432`",
          '6.19.3',
        ),
      ],
      ['red', new TypeError('fetch failed: ECONNRESET 10.0.0.7:443')],
      [
        'un bug',
        new Error("Cannot read properties of undefined (reading 'id')"),
      ],
    ];

    it.each(internos)('%s → genérico y registrado', (_tipo, error) => {
      const mensaje = mensajeDeError(error, GENERICO, 'create-case');
      expect(mensaje).toBe(GENERICO);
      expect(mensaje).not.toContain(error.message);
      expect(mockLoggerError).toHaveBeenCalledWith(GENERICO, error, {
        action: 'create-case',
      });
    });

    it('un valor que no es Error también da el genérico', () => {
      expect(mensajeDeError('texto suelto', GENERICO)).toBe(GENERICO);
      expect(mensajeDeError(undefined, GENERICO)).toBe(GENERICO);
    });
  });
});

describe('esErrorDeNegocio', () => {
  it('reconoce la clase y el nombre', () => {
    expect(esErrorDeNegocio(new ErrorDeNegocio('x'))).toBe(true);
    const copia = new Error('x');
    copia.name = 'ErrorDeNegocio';
    expect(esErrorDeNegocio(copia)).toBe(true);
    expect(esErrorDeNegocio(new Error('x'))).toBe(false);
  });

  it('CaseAccessError es un error de negocio: su mensaje llega al cliente', () => {
    const e = new CaseAccessError('forbidden');
    expect(esErrorDeNegocio(e)).toBe(true);
    expect(mensajeDeError(e, GENERICO)).toBe(
      'No tienes permisos para acceder a este caso',
    );
  });
});

describe('las acciones lanzan sus mensajes como ErrorDeNegocio', () => {
  // Desde N6 los catch devuelven el genérico para cualquier Error que no sea
  // de negocio. Un `throw new Error('No tiene permisos…')` nuevo en una acción
  // perdería su mensaje en silencio; este guardián lo impide.
  it('ningún archivo de acciones tiene throw new Error(', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const raiz = path.join(process.cwd(), 'src', 'features');
    const conThrowGenerico: string[] = [];
    for (const feature of fs.readdirSync(raiz)) {
      const dir = path.join(raiz, feature);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const archivo of fs.readdirSync(dir)) {
        if (!/^actions(-[a-z-]+)?\.ts$/.test(archivo)) continue;
        const fuente = fs.readFileSync(path.join(dir, archivo), 'utf8');
        if (/throw new Error\(/.test(fuente)) {
          conThrowGenerico.push(`${feature}/${archivo}`);
        }
      }
    }
    expect(conThrowGenerico).toEqual([]);
  });
});
