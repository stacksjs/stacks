import type { PickierConfig } from 'pickier'

const config: PickierConfig = {
  verbose: false,

  ignores: [
    '**/.git/**',
    '**/.stx/**',
    '**/.stx-serve/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/pantry/**',
    '**/storage/framework/cache/**',
    '**/storage/framework/core/**/dist/**',
    '**/storage/framework/defaults/ide/**',
  ],

  lint: {
    extensions: ['ts', 'js', 'json', 'md', 'yaml', 'yml'],
    reporter: 'stylish',
    cache: false,
    maxWarnings: -1,
  },

  format: {
    extensions: ['ts', 'js', 'json', 'md', 'yaml', 'yml'],
    indent: 2,
    quotes: 'single',
    semi: false,
    trimTrailingWhitespace: true,
    maxConsecutiveBlankLines: 1,
    finalNewline: 'one',
  },

  rules: {
    noDebugger: 'error',
    noConsole: 'off',
  },

  pluginRules: {
    'markdown/code-block-style': 'off',
    'markdown/descriptive-link-text': 'off',
    'markdown/link-image-reference-definitions': 'off',
    'markdown/no-duplicate-heading': 'off',
    'markdown/no-emphasis-as-heading': 'off',
    'markdown/no-inline-html': 'off',
    'markdown/reference-links-images': 'off',
    'markdown/single-title': 'off',
    'no-super-linear-backtracking': 'off',
    'publint/bin-file-not-executable': 'off',
    'style/brace-style': 'off',
    'style/max-statements-per-line': 'off',
    'style/quotes': 'off',
    'ts/no-top-level-await': 'off',
  },
}

export default config
