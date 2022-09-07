import alias from './src/core/alias'
import { defineConfig } from './src/core'

export default defineConfig({
  root: '..',

  optimizeDeps: {
    entries: [],
  },

  resolve: {
    alias,
  },
})
