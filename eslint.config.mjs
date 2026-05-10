// Flat ESLint config — single source of truth for the whole repo.
//
// Layout:
//   1. ignores              — generated/build/vendor paths
//   2. base TS rules        — applied everywhere
//   3. frontend overlay     — React + browser globals
//   4. node overlay         — services + packages (no React)
//   5. prettier             — disables stylistic rules Prettier owns
//
// Severity philosophy:
//   - "error" for actual bugs and unsafe patterns
//   - "warn"  for style nits that shouldn't block CI
//   - off    for rules that fight the existing codebase without value

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // ── 1. Globally-ignored paths ─────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      // local OTel SDK mirrors created by `npm install` in each service.
      // They contain compiled .js shipped from packages/observability/dist
      // and do not need to be linted as source.
      'services/*/obs/**',
      // generated Prisma artifacts
      '**/prisma/migrations/**',
      // shipped configs / schemas don't need lint
      '**/.prisma/**',
      'observability/grafana/**',
      // dashboards are JSON schema, not source code
      '*.config.js',
    ],
  },

  // ── 2. Base JS + TS rules everywhere ──────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Bug-finders — keep at error
      'no-debugger': 'error',
      // Off: superseded by `simple-import-sort/imports` and conflicts with
      // `consistent-type-imports`, which legitimately splits value vs type
      // imports onto separate lines.
      'no-duplicate-imports': 'off',
      'no-throw-literal': 'error',
      '@typescript-eslint/no-floating-promises': 'off', // type-aware; opt in per-package later
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off', // delegated to unused-imports below
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Imports — sorted, no duplicates, no unused
      'simple-import-sort/imports': [
        'warn',
        {
          // Custom groups so node:built-ins, third-party, internal aliases,
          // and relative imports each get their own block separated by a blank line.
          groups: [
            // 1. Side-effect & built-in node imports (`import 'foo'`, `import 'node:fs'`)
            ['^\\u0000', '^node:'],
            // 2. External packages (anything not starting with . or our scope)
            ['^@?\\w'],
            // 3. Internal monorepo packages
            ['^@games-platform/'],
            // 4. Parent imports
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // 5. Same-folder imports & types
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // 6. Style imports
            ['^.+\\.s?css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          // Allow the conventional `_unused` rest-spread destructure pattern
          // we use when stripping fields like `secret` before sending state.
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Style nits — warn, don't error
      'no-console': 'off', // services use console.* via the shared logger; that's intentional
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
      curly: ['warn', 'multi-line'],
    },
  },

  // ── 3. Frontend overlay ───────────────────────────────────────────────
  {
    files: ['frontend/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // We use the new JSX transform (Vite + React 18) — `import React` is unnecessary
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Apostrophes in text are noisy to fix and not actually broken
      'react/no-unescaped-entities': 'warn',
      // Allow inline styles — this codebase intentionally uses them on
      // animated UI primitives where CSS-in-JS would be overkill.
      'react/no-unknown-property': 'warn',
      // PropTypes aren't useful with TS
      'react/prop-types': 'off',
      // Ref escape hatches in framer-motion components are fine
      'react/display-name': 'off',
    },
  },

  // ── 4. Node services + packages overlay ───────────────────────────────
  {
    files: ['services/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Node services log to stdout via the shared logger; raw console is fine.
      'no-console': 'off',
    },
  },

  // ── 5. JS config files (flat configs, vite config) — relaxed ──────────
  {
    files: ['**/*.config.{js,mjs,cjs,ts}', '**/vite.config.ts', '**/eslint.config.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // ── 6. Prettier MUST be last so it disables stylistic rules ───────────
  prettier,
);
