import { defineConfig } from 'vitest/config'
import { projectPath } from './core/path/src'
import { alias } from './core/alias/src'

export default defineConfig({
  root: '..',

  optimizeDeps: {
    entries: [],
  },

  resolve: {
    alias,
  },

  test: {
    globals: true,
    coverage: {
      provider: 'istanbul',
      reportsDirectory: projectPath('./tests/unit/coverage'),
    },
  },
})
