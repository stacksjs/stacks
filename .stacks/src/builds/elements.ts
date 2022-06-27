import type { ViteConfig } from '../core'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import alias from '../../../config/alias'
import library from '../../../config/library'
import { defineConfig, Stacks } from '../core'
import { resolve } from 'path'

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core'],
  },

  plugins: [
    Stacks(),
  ],

  build: buildOptions(),
}

export function buildOptions(entry?: string): ViteBuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../../components/index.ts')

  return {
    lib: {
      entry,
      name: library.WEB_COMPONENTS_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `index.mjs`

        if (format === 'cjs')
          return `index.cjs`

        // if (format === 'iife')
        //   return 'index.iife.js'

        return `index.?.js`
      },

      // sourcemap: true,
      // minify: false,;
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
