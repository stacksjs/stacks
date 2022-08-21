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

  build: cliBuildOptions(),
}

export function cliBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/cli'),

    lib: {
      entry: resolve(__dirname, '../cli/index.ts'),
      name: 'artisan',
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'artisan.mjs'

        return 'artisan.?.js'
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
