import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
// import { alias } from '../packages/core/src'
import Vue from '@vitejs/plugin-vue'
// import Unocss from 'unocss/vite'
// import path from 'path'
// import { VUE_PACKAGE_NAME } from '../config/constants'
//
const config: UserConfig = {
  base: '/play/',

  resolve: {
    dedupe: ['vue'],
    // alias,
  },

  optimizeDeps: {
    exclude: ['@vueuse/core', 'vue', 'unocss'],
    // include: ['@vueuse/core', 'vue', 'unocss', 'vite', 'fs', '@unocss/inspector', 'crypto', 'url']
  },

  plugins: [
    Vue({
      customElement: false,
    }),

    // Unocss({
    //   configFile: path.resolve(__dirname, '../packages/core/src/config/unocss.ts'),
    //   // mode: 'vue-scoped', // or 'shadow-dom'
    // }),
  ],

  build: {
    // outDir: '../interactive/public/play',
    emptyOutDir: true,
    rollupOptions: {
      external: ['@vueuse/core', 'vue', 'unocss'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },

      input: [
        './index.html',
      ],
    },
  },
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
