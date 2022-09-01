import alias from './src/core/alias'
import { defineConfig } from './src/core'

export default defineConfig({
  optimizeDeps: {
    entries: [],
  },

  resolve: {
    alias,
  },

  test: {
    isolate: false,
  },
})
