import type { PickierOptions } from 'pickier'

const config: PickierOptions = {
  verbose: false,
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.nuxt/**',
    '**/.output/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.min.css',
    '**/vendor/**',
    // Generated files with inconsistent formatting
    '**/storage/framework/requests/**',
    '**/storage/framework/types/**',
    '**/storage/framework/orm/**',
    '**/storage/framework/actions/**',
    '**/bun-queue/**',
    // Generated declaration files
    '**/*.d.ts',
    '**/temp/**',
  ],
  lint: {
    extensions: ['ts', 'js'],
    reporter: 'stylish',
    cache: true,
    maxWarnings: -1,
  },
  format: {
    extensions: ['ts', 'js', 'json', 'md'],
    trimTrailingWhitespace: true,
    maxConsecutiveBlankLines: 1,
    finalNewline: 'one',
    indent: 2,
    indentStyle: 'spaces',
    quotes: 'single',
    semi: false,
  },
  rules: {
    noDebugger: 'error',
    noConsole: 'off',
    noUnusedCapturingGroup: 'off',
  },
  pluginRules: {
    'ts/no-top-level-await': 'off',
    'no-super-linear-backtracking': 'off',
    'indent': 'off',
    '@stylistic/indent': 'off',
    'style/indent': 'off',
    'quotes': 'off',
    'style/brace-style': 'off',
    'max-statements-per-line': 'off',
  },
}

export default config
