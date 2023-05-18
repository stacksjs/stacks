import { defineWorkspace } from 'vitest/config'
import { alias } from '@stacksjs/alias'
import { frameworkPath } from '@stacksjs/path'

// todo: https://github.com/vitest-dev/vscode/issues/151

export default defineWorkspace([
  frameworkPath('core/**'),
  frameworkPath('stacks/**'),

  {
    // root: projectPath(),

    resolve: {
      alias,
    },

    optimizeDeps: {
      entries: [],
    },

    test: {
      globals: true,
      exclude: ['**/src/**', '**/node_modules/**', '**/samples/**', 'out/**'],
      // coverage: {
      //   provider: 'istanbul',
      //   reportsDirectory: projectPath('./tests/unit/coverage'),
      // },
    },
  },
])
