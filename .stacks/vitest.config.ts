import { defineConfig } from 'vite'
import { alias } from './config'

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
