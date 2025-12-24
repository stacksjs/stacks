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
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },

  pluginRules: {
    // Markdown rules
    'markdown/heading-increment': 'error',
    'markdown/no-empty-links': 'error',
  },

  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/fixtures/**',
    '**/coverage/**',
    '**/cdk.out/**',
    '**/.git/**',
    '**/storage/framework/cache/**',
    '**/storage/framework/server/storage/**',
  ],
}

export default config
