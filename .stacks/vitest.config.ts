import alias from 'stacks/alias'
import { defineConfig } from '.'

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
