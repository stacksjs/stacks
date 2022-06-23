import { alias, defineConfig } from '@ow3/stacks'

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
