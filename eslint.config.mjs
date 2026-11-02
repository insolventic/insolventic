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
      // docs/ tiene generadores sueltos (docs/gantt/, docs/jira/) que son
      // utilidades de una sola corrida, no codigo del producto. Medido: los 5
      // warnings que da `npx eslint` sobre el arbol de trabajo salen de ahi.
      // En un checkout limpio son 0 porque todavia no estan commiteados, asi
      // que el dia que se commiteen rompen el invariante de CLAUDE.md
      // ("npm run lint debe quedar en 0 warnings") sin que nadie lo haya
      // tocado. Esto lo evita de antemano (H-8).
      'docs/**',
    ],
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
