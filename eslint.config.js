import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['docs/**/*.js'],
    ignores: ['docs/vite.config.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['docs/vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['docs/public/appearance.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    ignores: ['dist/**', 'dist-docs/**', 'node_modules/**'],
  },
];
