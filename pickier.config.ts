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
    noConsole: 'warn',
    noUnusedCapturingGroup: 'off',
  },
  pluginRules: {
    'ts/no-top-level-await': 'off',
    'no-super-linear-backtracking': 'off',
  },
}

export default config
