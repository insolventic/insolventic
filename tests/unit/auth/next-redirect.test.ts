/**
 * Unit Tests: isNextRedirectError (src/lib/next-redirect.ts).
 *
 * Reconoce el error de `redirect()` por su `digest` (contrato de Next), nunca
 * por su `message`.
 */

// Las formas reales de Next, no fabricadas a mano: si una actualización cambia
// el formato del digest, estos tests avisan.
import { getRedirectError } from 'next/dist/client/components/redirect';

import { isNextRedirectError } from '@/lib/next-redirect';

describe('isNextRedirectError', () => {
  describe('es una redirección', () => {
    it.each([
      ['redirect() push', () => getRedirectError('/dashboard', 'push', 307)],
      ['redirect() replace', () => getRedirectError('/login', 'replace', 307)],
      ['permanentRedirect()', () => getRedirectError('/nuevo', 'push', 308)],
    ])('%s', (_label, make) => {
      expect(isNextRedirectError(make())).toBe(true);
    });

    it('sin depender del message (el mock compartido del repo lo pone con la URL)', () => {
      const error = Object.assign(new Error('NEXT_REDIRECT:/dashboard'), {
        digest: 'NEXT_REDIRECT;push;/dashboard;307;',
      });

      expect(isNextRedirectError(error)).toBe(true);
    });
  });

  describe('NO es una redirección', () => {
    it('un error común, aunque su message sea "NEXT_REDIRECT"', () => {
      expect(isNextRedirectError(new Error('NEXT_REDIRECT'))).toBe(false);
    });

    it.each([
      ['notFound() de Next', 'NEXT_HTTP_ERROR_FALLBACK;404'],
      ['prefijo sin separador', 'NEXT_REDIRECTX;push;/x;307;'],
      ['digest vacío', ''],
    ])('digest de otro tipo: %s', (_label, digest) => {
      expect(
        isNextRedirectError(Object.assign(new Error('x'), { digest })),
      ).toBe(false);
    });

    it('un digest que no es string', () => {
      expect(isNextRedirectError({ digest: 42 })).toBe(false);
      expect(isNextRedirectError({ digest: null })).toBe(false);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['un string', 'NEXT_REDIRECT;push;/x;307;'],
      ['un número', 42],
    ])('un valor que no es objeto: %s', (_label, value) => {
      expect(isNextRedirectError(value)).toBe(false);
    });
  });
});
