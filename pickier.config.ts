import type { PickierConfig } from 'pickier'

const config: PickierConfig = {
  lint: {
    extensions: ['ts', 'js', 'vue', 'json', 'yaml', 'md'],
  },

  format: {
    extensions: ['ts', 'js', 'vue', 'json', 'yaml', 'md'],
    indent: 2,
    quotes: 'single',
    semi: false,
    trailingComma: true,
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
    '**/node_modules/**',
    '**/dist/**',
    '**/fixtures/**',
    '**/coverage/**',
    '**/cdk.out/**',
    '**/.git/**',
    '**/storage/framework/cache/**',
    '**/storage/framework/server/storage/**',
    // Generated ORM model files
    '**/storage/framework/orm/src/models/**',
    '**/storage/framework/orm/src/routes/**',
    // Generated actions and requests
    '**/storage/framework/actions/**',
    '**/storage/framework/requests/**',
    '**/storage/framework/defaults/actions/**',
    // Temp and generated type files
    '**/temp/**',
    '**/storage/framework/types/**',
  ],
}

export default config
