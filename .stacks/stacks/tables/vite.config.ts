import { defineConfig } from 'vite'

// import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // plugins: [vue()],
  server: {
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      external: ['vue', 'vue-demi', 'chalk', 'cac', 'human-signals', 'node-ray', 'node:url'],
      output: {
        // exports: 'named',
        globals: {
          'vue': 'Vue',
          'vue-demi': 'vue-demi',
        },
      },
    },

    sourcemap: true,
    minify: true,
  },
})
