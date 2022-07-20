import alias from 'stacks/alias'
import { defineConfig } from 'stacks'

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
