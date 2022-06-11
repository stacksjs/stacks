import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
// import { Stacks, resolveOptions, buildVueComponents as vueComponents } from '../core/src'
import { resolve } from 'pathe'
import { Stacks, resolveOptions } from '../core/src'
import { VUE_PACKAGE_NAME } from '../../config/constants'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: resolveOptions,

  plugins: [
    Stacks(),
  ],

  // build: vueComponents(),
  build: {
    lib: {
      entry: resolve(__dirname, './src/index.ts'),
      name: 'hello-world-vue',
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'hello-world-vue.mjs'

        if (format === 'cjs')
          return 'hello-world-vue.cjs'

        // if (format === 'iife')
        //     return `hello-world-vue.global.js`

        return 'hello-world-vue.?.js'
      },
    },

    rollupOptions: {
      external: ['vue', '@vueuse/core'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },

    // sourcemap: true,
    // minify: false,
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
