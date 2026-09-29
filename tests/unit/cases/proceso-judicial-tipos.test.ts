/**
 * Unit Tests: tipos de proceso judicial (src/features/case/proceso-judicial-tipos.ts).
 *
 * La lista la dictó la abogada y NO se deriva de ninguna nomenclatura legal
 * general, así que se fija literal: si alguien la "corrige" contra el Código
 * General del Proceso, este test lo frena.
 *
 * Antes había dos listas hardcodeadas y distintas, una por componente, así que
 * también se vigila que no vuelva a aparecer una tercera.
 */

import fs from 'fs';
import path from 'path';

import {
  TIPOS_PROCESO_JUDICIAL,
  TIPOS_PROCESO_VALUES,
  TIPO_PROCESO_OTROS,
  requiresOtherDetail,
  tipoProcesoLabel,
} from '@/features/case/proceso-judicial-tipos';

describe('tipos de proceso judicial', () => {
  describe('la lista', () => {
    it('son exactamente estos 7, en este orden', () => {
      expect(TIPOS_PROCESO_JUDICIAL.map((t) => [t.value, t.label])).toEqual([
        ['EJECUTIVO', 'Ejecutivo'],
        ['COACTIVO', 'Coactivo'],
        ['RESTITUCION_INMUEBLE', 'Restitución de inmueble'],
        ['PAGO_DIRECTO', 'Pago directo'],
        ['CIVIL_ALIMENTOS', 'Civil/Alimentos'],
        ['LABORAL', 'Laboral'],
        ['OTROS', 'Otros'],
      ]);
    });

    it('"Otros" es el último y es el que habilita el texto libre', () => {
      expect(TIPO_PROCESO_OTROS).toBe('OTROS');
      expect(TIPOS_PROCESO_JUDICIAL.at(-1)!.value).toBe(TIPO_PROCESO_OTROS);
    });

    it('no hay valores repetidos', () => {
      expect(new Set(TIPOS_PROCESO_VALUES).size).toBe(
        TIPOS_PROCESO_VALUES.length,
      );
    });

    it('no quedó ninguna de las dos nomenclaturas anteriores', () => {
      // La lista vieja del componente vivo y la del componente que se borró.
      for (const viejo of [
        'ORDINARIO',
        'ABREVIADO',
        'MONITORIO',
        'VERBAL',
        'OTRO',
        'Ejecutivo singular',
        'Ejecutivo mixto',
      ]) {
        expect(TIPOS_PROCESO_VALUES).not.toContain(viejo);
      }
    });
  });

  describe('requiresOtherDetail', () => {
    it('solo "Otros" pide texto libre', () => {
      expect(requiresOtherDetail(TIPO_PROCESO_OTROS)).toBe(true);
      for (const tipo of TIPOS_PROCESO_VALUES.filter(
        (v) => v !== TIPO_PROCESO_OTROS,
      )) {
        expect(requiresOtherDetail(tipo)).toBe(false);
      }
    });

    it('sin tipo elegido no pide nada', () => {
      expect(requiresOtherDetail(null)).toBe(false);
      expect(requiresOtherDetail(undefined)).toBe(false);
      expect(requiresOtherDetail('')).toBe(false);
    });
  });

  describe('tipoProcesoLabel', () => {
    it('traduce el valor guardado a la etiqueta que se muestra', () => {
      expect(tipoProcesoLabel('RESTITUCION_INMUEBLE')).toBe(
        'Restitución de inmueble',
      );
      expect(tipoProcesoLabel('CIVIL_ALIMENTOS')).toBe('Civil/Alimentos');
    });

    it('en "Otros" muestra el texto que escribió el usuario', () => {
      // Es el punto del cambio: "Otros" por sí solo no dice nada.
      expect(tipoProcesoLabel('OTROS', 'Insolvencia de persona natural')).toBe(
        'Insolvencia de persona natural',
      );
    });

    it('en "Otros" sin texto cae a la etiqueta genérica', () => {
      expect(tipoProcesoLabel('OTROS')).toBe('Otros');
      expect(tipoProcesoLabel('OTROS', '   ')).toBe('Otros');
      expect(tipoProcesoLabel('OTROS', null)).toBe('Otros');
    });

    it('el texto libre no se usa en los tipos que no son "Otros"', () => {
      expect(tipoProcesoLabel('LABORAL', 'algo pegado de antes')).toBe(
        'Laboral',
      );
    });

    it('un valor viejo desconocido se muestra tal cual, no vacío', () => {
      // Filas ya guardadas con alguna de las dos nomenclaturas anteriores.
      expect(tipoProcesoLabel('Ejecutivo singular')).toBe('Ejecutivo singular');
      expect(tipoProcesoLabel('VERBAL')).toBe('VERBAL');
    });

    it('sin tipo devuelve vacío', () => {
      expect(tipoProcesoLabel(null)).toBe('');
      expect(tipoProcesoLabel(undefined)).toBe('');
      expect(tipoProcesoLabel('')).toBe('');
    });
  });

  describe('no hay listas duplicadas en la UI', () => {
    const SECTION = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/cases/components/create-case-dialog/legal-processes-section.tsx',
      ),
      'utf-8',
    );

    it('el formulario recorre la lista compartida en vez de escribir sus SelectItem', () => {
      expect(SECTION).toContain('TIPOS_PROCESO_JUDICIAL.map');
      // Ninguna etiqueta hardcodeada de la lista vieja.
      for (const viejo of ['ORDINARIO', 'ABREVIADO', 'MONITORIO', 'VERBAL']) {
        expect(SECTION).not.toContain(`value="${viejo}"`);
      }
    });

    it('el condicional del texto libre usa el helper, no el literal', () => {
      expect(SECTION).toContain('requiresOtherDetail(');
      expect(SECTION).not.toContain("=== 'OTROS'");
      expect(SECTION).not.toContain("=== 'Otro'");
    });
  });
});
