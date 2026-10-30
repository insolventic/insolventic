import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  {
    // `no-console` donde YA se migro al logger (H-4 / R-2).
    //
    // Por que no es global: quedan ~250 `console.*` en el resto de src/, asi
    // que la regla a nivel de proyecto dejaria `npm run lint` en rojo y el
    // invariante del proyecto es 0 warnings. La lista crece a medida que cada
    // modulo se migra, y asi lo migrado no se puede desmigrar sin que el lint
    // avise.
    //
    // Pendientes de sumar a esta lista, cada uno con su PR:
    //   - src/hooks/use-session-timeout.ts y
    //     src/components/auth/session-timeout-provider.tsx (rama
    //     fix/session-timeout-sin-console)
    //   - src/lib/google-drive.ts (rama fix/retry-drive)
    //   - src/features/document/actions.ts (46 llamadas) y
    //     actions-generation.ts (9): no entraron todavia.
    //
    // src/scripts/** queda exceptuado a proposito: son scripts de linea de
    // comandos, donde la consola ES la salida del programa.
    files: ['src/lib/email.ts', 'src/lib/html-to-pdf.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // Test files legitimately need dynamic require() for conditional
    // mocking and Function-typed helpers. Relax these rules for the
    // test tree only — production code still enforces them.
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default eslintConfig;
