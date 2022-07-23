import alias from 'stacks/src/alias'
import { defineConfig } from 'stacks/src'

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
