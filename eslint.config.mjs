import js from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { FORBIDDEN_LAYERS, FORBIDDEN_PACKAGES } from './architecture-rules.mjs';

/** Traduce las reglas de capas al formato de patrones de `no-restricted-imports`. */
const restrictedImportsFor = (layer) => [
  'error',
  {
    patterns: [
      {
        group: [
          ...FORBIDDEN_PACKAGES[layer].map((pkg) => (pkg.endsWith('/') ? `${pkg}*` : pkg)),
          ...FORBIDDEN_LAYERS[layer].map((target) => `**/${target}/**`),
        ],
        message: `La capa "${layer}" debe permanecer independiente del framework (ver CLAUDE.md).`,
      },
    ],
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  plugins.typescriptEslint,
  ...configs.base.recommended,
  ...configs.node.recommended,
  ...configs.base.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // ESM nativo (nodenext): los imports relativos exigen extensión explícita.
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
      // Airbnb prohíbe for...of por el costo de transpilar a ES5; aquí corre nativo en Node 26.
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      // Exports nombrados: un concepto por archivo, imports explícitos.
      'import-x/prefer-default-export': 'off',
      // Nest usa clases con decoradores y constructores de solo inyección.
      'class-methods-use-this': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: { 'no-restricted-imports': restrictedImportsFor('core') },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: { 'no-restricted-imports': restrictedImportsFor('infrastructure') },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts', '*.config.ts', '*.mjs'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
      // En tests y configuración la E/S síncrona es más simple y no bloquea nada relevante.
      'n/no-sync': 'off',
      // Los fakes de los puertos se agrupan en un solo archivo de soporte.
      'max-classes-per-file': 'off',
    },
  },
  prettierConfig,
);
