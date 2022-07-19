import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../core'
import { defineConfig } from '../core'
import alias from '../alias'
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
    outDir: resolve(__dirname, '../../dist/functions'),

    lib: {
      entry: resolve(__dirname, '../../../functions/index.ts'),
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
