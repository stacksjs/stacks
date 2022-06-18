import { defineConfig } from 'vite'
import { alias } from '../config/alias'

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
