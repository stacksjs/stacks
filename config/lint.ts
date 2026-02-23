import type { PickierOptions } from 'pickier'

const config: PickierOptions = {
  format: {
    extensions: ['ts', 'js', 'stx', 'json', 'yaml', 'md'],
    indent: 2,
    quotes: 'single',
    semi: false,
  },

  rules: {
    // TypeScript rules
    noDebugger: 'off',
    noConsole: 'off',
  },

  pluginRules: {
    // Disable regexp rules that cause false positives on route definitions
    'regexp/no-unused-capturing-group': 'off',
    'regexp/no-super-linear-backtracking': 'off',
    'regexp/optimal-quantifier-concatenation': 'off',
    // Disable style rules that conflict with common patterns or generated code
    'style/brace-style': 'off',
    'style/max-statements-per-line': 'off',
    'style/quotes': 'off',
    'indent': 'off',
    'quotes': 'off',
    // TypeScript rules
    'ts/no-top-level-await': 'off',
    // Console is intentional in this codebase
    'no-console': 'off',
    // Markdown rules
    'markdown/heading-increment': 'off',
    'markdown/no-empty-links': 'off',
  },

  ignores: [
    '**/fixtures/**',
    '**/coverage/**',
    '**/temp/**',
  ],
}

export default config
