import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Deno-runtime Edge Functions have their own global scope (Deno.serve, npm:
  // imports) that this browser/Node-oriented config doesn't model — excluded
  // rather than adding a third globals profile for 16 files with no shared
  // build tooling of their own.
  { ignores: ['dist', 'supabase/functions'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
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
      // Flags the standard useEffect(() => { load() }, []) data-fetching pattern
      // used throughout this app's pages — idiomatic here, not a bug, and noisy
      // enough to bury the exhaustive-deps warnings this config is actually for.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['api/**/*.ts', '*.config.ts', '*.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
)
