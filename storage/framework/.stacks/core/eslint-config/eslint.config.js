// @ts-check
import styleMigrate from '@stylistic/eslint-plugin-migrate'
import stacks from './dist/index.js'

export default stacks(
  {
    vue: true,
    // react: true,
    typescript: true,
    ignores: [
      'fixtures',
      '_fixtures',
    ],
    formatters: true,
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'perfectionist/sort-objects': 'error',
    },
  },
  {
    files: ['src/configs/*.ts'],
    plugins: {
      'style-migrate': styleMigrate,
    },
    rules: {
      'style-migrate/migrate': ['error', { namespaceTo: 'style' }],
    },
  },
)
