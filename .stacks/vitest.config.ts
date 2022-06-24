import { alias, defineConfig } from '.'

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
