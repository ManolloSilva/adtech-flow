import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output, coverage, and the MSW service worker — the last is generated
    // by `npx msw init` and is not our source.
    // NOTE: `src/mocks` is deliberately *not* ignored. It is hand-written source
    // (handlers, demand partners, worker bootstrap) and must stay linted.
    ignores: ['dist', 'coverage', 'public/mockServiceWorker.js'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Accessibility (WCAG 2.1 AA) is a hard requirement per docs/design-system.md §4.
      // Static JSX attributes are analysable without type information:
      //   jsx-a11y/no-static-element-interactions
      //   jsx-a11y/click-events-have-key-events
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='addEventListener'] > Literal[value=/^(click|dblclick|mousedown|mouseup)$/]",
          message:
            'Attach mouse listeners via React props and pair them with onKeyDown/onKeyUp for keyboard parity (WCAG 2.1 AA).',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}', '**/*.test.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Vendored shadcn/ui primitives co-locate their `cva()` variant map with the
    // component. That is the upstream convention, so exempt only this directory
    // rather than relaxing the rule for the whole codebase.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);