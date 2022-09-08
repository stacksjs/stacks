import { resolve } from 'node:path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../plugin'
import { defineConfig } from '../plugin'
import alias from '../core/alias'

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    alias,
  },

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/functions'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../../../config/functions.ts'),
      name: 'functions',
      formats: ['es', 'cjs'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

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
