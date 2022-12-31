import { defineConfig } from 'vitest/config'
import { projectPath } from './core/path'
import { alias } from './core/alias'

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
