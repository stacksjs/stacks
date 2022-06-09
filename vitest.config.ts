import { defineConfig } from 'vite'
import { alias } from './packages/shared/alias'

export default defineConfig({
  optimizeDeps: {
    entries: [],
  },

  resolve: {
    alias,
  },

  // test: {
  //   isolate: false,
  // },
})
