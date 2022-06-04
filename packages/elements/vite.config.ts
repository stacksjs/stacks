import { defineConfig } from 'vite'
import { resolve } from 'path'
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
    Vue({
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom elements
          isCustomElement: tag => tag.includes('hello-world'),
        },
      },
    }),

    Unocss({
      mode: 'shadow-dom',
      configFile: resolve(__dirname, 'unocss.config.js'),
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'hello-world-elements',
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'umd')
          return 'index.cjs'

        return 'index.?.js'
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
