import { resolve } from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import type { UserConfig } from 'vite'
// import { alias } from '../../alias'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    dedupe: ['vue'],
    // alias,
  },

  plugins: [
    Vue(),

    Unocss({
      mode: 'shadow-dom',
      configFile: resolve(__dirname, 'unocss.config.js'),
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'hello-world-elements',
      formats: ['cjs', 'es', 'iife'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'hello-world-elements.mjs'

        if (format === 'umd')
          return 'hello-world-elements.cjs'

        if (format === 'iife')
          return 'hello-world-elements.global.js'

        return 'hello-world-elements.?.js'
      },
    },

    // sourcemap: true,
    // minify: false,
  },
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
