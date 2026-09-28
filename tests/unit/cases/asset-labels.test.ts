/**
 * Unit Tests: etiquetas del formulario de bienes (src/features/case/asset-labels.ts).
 *
 * La captura de bienes está duplicada en dos pantallas (alta y edición de
 * caso), así que estos rótulos son la única fuente compartida entre ambas.
 * Lo que se fija acá es el contrato de producto, no el detalle de render.
 */

import {
  ASSET_TYPE_INMUEBLE,
  isInmueble,
  assetValueLabel,
} from '@/features/case/asset-labels';

describe('asset-labels', () => {
  describe('isInmueble', () => {
    it('reconoce el literal que usan los bloques condicionales de los formularios', () => {
      expect(ASSET_TYPE_INMUEBLE).toBe('INMUEBLE');
      expect(isInmueble('INMUEBLE')).toBe(true);
    });

    it('trata como mueble cualquier otro tipo del select', () => {
      for (const tipo of [
        'VEHICULO',
        'EQUIPO',
        'MUEBLE',
        'JOYA',
        'DINERO',
        'ACCION',
        'CUENTA_COBRAR',
        'OTRO',
      ]) {
        expect(isInmueble(tipo)).toBe(false);
      }
    });

    it('no explota cuando todavía no se eligió tipo', () => {
      // El tipo arranca en '' y `useWatch` puede devolver undefined en el
      // primer render, antes de que el usuario toque el select.
      expect(isInmueble(undefined)).toBe(false);
      expect(isInmueble(null)).toBe(false);
      expect(isInmueble('')).toBe(false);
    });
  });

  describe('assetValueLabel', () => {
    it('en inmuebles pide el valor comercial', () => {
      // Es el valor que la Solicitud de Insolvencia imprime como
      // "Valor Comercial o estimado" en la fila {{INMUEBLE_VALOR}}.
      expect(assetValueLabel('INMUEBLE')).toBe('Valor comercial ($)');
    });

    it('en muebles mantiene el rótulo genérico', () => {
      expect(assetValueLabel('VEHICULO')).toBe('Valor ($)');
      expect(assetValueLabel('JOYA')).toBe('Valor ($)');
    });

    it('sin tipo elegido usa el rótulo genérico', () => {
      expect(assetValueLabel(undefined)).toBe('Valor ($)');
    });
  });
});
