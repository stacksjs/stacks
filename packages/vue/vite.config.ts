import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
// import { buildVueComponents as vueComponents, plugins } from '../composables/src/stacks'
import { resolve } from 'pathe'
// import { Stacks, resolveOptions } from '../core/src'
// import { VUE_PACKAGE_NAME } from '../../config/constants'
import Vue from '@vitejs/plugin-vue'
// import { alias } from '../core/src'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@ow3/hello-world-composable': resolve(__dirname, '../composables/src/index.ts'),
      '@ow3/hello-world-vue': resolve(__dirname, './src/index.ts'),
    },
  },

  plugins: [
    Vue()
  ],

  optimizeDeps: {
    // exclude: ['path', 'fs', 'url', 'crypto']
    exclude: ['@vueuse/core', 'vue', 'unocss', 'vite', '@vitejs/plugin-vue', 'pathe', 'fs', '@unocss/inspector', 'crypto', 'url']
  },

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'my-lib',
      fileName: format => `my-lib.${format}.js`,
    },

    rollupOptions: {
      // external: [
      // '@vueuse/core', 'vue', 'unocss', 'vite', '@vitejs/plugin-vue', 'pathe', 'fs', '@unocss/inspector', 'crypto', 'url'
      // ],
      external: ['vue', 'pathe', 'fs', 'url', 'crypto'],

      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },

    // sourcemap: true,
    // minify: true,
  },
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  // // eslint-disable-next-line no-console
  // console.log('config is', config)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
