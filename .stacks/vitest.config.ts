import { defineConfig } from 'vitest/config'
import { alias } from '@stacksjs/alias'

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
    },
  },
})
