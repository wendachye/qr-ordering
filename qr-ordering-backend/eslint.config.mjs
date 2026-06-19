import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Flat config. Non-type-checked ruleset (fast, no `project` wiring) — enough to
// catch real mistakes without drowning an existing codebase in style churn.
// `eslint-config-prettier` is last so formatting is owned by Prettier alone.
export default [
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'prisma.config.ts',
      'prisma/seed.ts',
      'prisma/migrations/**',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node runtime globals (console, process, Buffer, fetch, URL, …) everywhere.
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { import: importPlugin },
    rules: {
      // TypeScript already flags undefined identifiers; no-undef is redundant
      // and misfires on type-only constructs.
      'no-undef': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Pragmatic for an existing codebase: surface but don't block.
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/order': [
        'warn',
        { groups: ['builtin', 'external', 'internal'], 'newlines-between': 'always' },
      ],
    },
  },
  prettier,
];
