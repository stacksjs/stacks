import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../core'
import { defineConfig } from '../core'
import alias from '../../../config/alias'
// import library from '../../../config/library'

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    alias,
  },

  build: buildOptions(),
}

export function buildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/cli'),

    lib: {
      entry: resolve(__dirname, '../cli/index.ts'),
      name: 'artisan',
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        // if (format === 'iife')
        //     return `index.iife.js`

        return 'index.?.js'
      },
    },

    // sourcemap: true,
    // minify: false,
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
