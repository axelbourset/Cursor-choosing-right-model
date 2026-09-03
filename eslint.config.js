import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig(
  { ignores: ['dist', 'node_modules', 'data', 'docs', '**/*.cjs'] },
  js.configs.recommended,
  // Type-checked tier: without it, no-floating-promises, no-unsafe-*, no-deprecated,
  // no-unnecessary-condition, restrict-template-expressions and no-base-to-string are all
  // switched off — which is how a tooltip shipped rendering a null price as "$null".
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Build and lint config sit outside both tsconfig projects; the default project
        // gives them type information rather than silently unlinting them.
        projectService: {
          allowDefaultProject: [
            'eslint.config.js',
            'vite.config.ts',
            'vite.plugins.ts',
            'vitest.setup.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // House style, and the skill's default: `type` unless declaration merging is needed.
      // stylisticTypeChecked ships the opposite preference.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // Numbers in templates are fine and pervasive here. null, undefined, objects and
      // `any` stay errors — that is the setting that catches rendering a null price.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "LogicalExpression[operator='??'][right.value=0]",
          message:
            'Never default a metric or price to 0. null means "not measured" (PRD C08/C11). Render an em dash instead.',
        },
        {
          selector: "LogicalExpression[operator='||'][right.value=0]",
          message:
            'Never default a metric or price to 0. null means "not measured" (PRD C08/C11). Render an em dash instead.',
        },
      ],
    },
  },
  {
    // Tests assert on fixture data they construct themselves, so a non-null assertion is a
    // statement about the fixture, not a claim about untrusted input. Async test bodies
    // without an await are just vitest's signature.
    files: ['**/*.test.ts', '**/*.test.tsx', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // This file is plain JS and lints itself, so `import.meta.dirname` has no Node types
    // here. Scoped to the one rule rather than dropping type-aware linting for the file.
    files: ['eslint.config.js'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
)
